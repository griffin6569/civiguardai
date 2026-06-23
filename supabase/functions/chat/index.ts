import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  extractGeminiText,
  generateGeminiContent,
  isGeminiCapacityError,
  messagesToGeminiContents,
  type ChatMessage,
} from "../_shared/gemini.ts";
import {
  filterTrustedReports,
  isTrustedKenyanNewsSource,
} from "../_shared/kenya-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const REPORT_LIMIT = 18;

type NewsArticle = {
  title: string;
  source: string;
  pubDate: string;
  link: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message: ChatMessage) => message?.role === "user" && typeof message?.content === "string")
      ?.content || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: reportsResult, error: reportsError } = await supabase
      .from("reports")
      .select("title, damage_type, severity, status, address, latitude, longitude, created_at, description, reporter_name, ai_confidence, needs_human_review, priority_score")
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT);

    if (reportsError) {
      throw reportsError;
    }

    const reportsData = filterTrustedReports(reportsResult ?? []).filter(isGroundedReport);
    const newsArticles = shouldFetchNews(latestUserMessage) ? await fetchNews() : [];
    const now = new Date();
    const isAdmin = mode === "admin";

    const reportFreshness = reportsData.length
      ? `${reportsData.length} recent verified reports. Newest: ${reportsData[0]?.created_at?.split("T")[0] || "unknown"}`
      : "No verified reports in database";

    const reportTypeSummary = summarizeCounts(
      reportsData.map((report) => report.damage_type || "unknown"),
      "report types",
    );

    const severitySummary = summarizeCounts(
      reportsData.map((report) => report.severity || "unknown"),
      "severity levels",
    );

    const contextData = `
CURRENT GROUNDED EVIDENCE FOR KENYA:
Data retrieved: ${now.toISOString()}

=== SOURCE POLICY ===
- Use only verified citizen reports and verified Kenya news sources
- Do not use alerts, asset registries, maintenance data, or placeholders

=== REPORT DATA ===
- ${reportFreshness}
- Report type summary: ${reportTypeSummary}
- Severity summary: ${severitySummary}

=== RECENT REPORTS (${reportsData.length}) ===
${reportsData.slice(0, 8).map((report) =>
  `- "${report.title}" | Type: ${report.damage_type || "unknown"} | Severity: ${report.severity || "unknown"} | Status: ${report.status || "unknown"} | Location: ${report.address || "N/A"} | Date: ${new Date(report.created_at).toLocaleDateString()}`
).join("\n") || "No grounded reports found"}

=== VERIFIED NEWS (${newsArticles.length}) ===
${newsArticles.map((article) =>
  `- ${article.title} | ${article.source} | ${new Date(article.pubDate).toLocaleDateString()} | ${article.link}`
).join("\n") || "News not fetched or no verified coverage available"}
`;

    const systemPrompt = `You are CiviGuard AI, Kenya's infrastructure evidence assistant.

You must answer using only:
1. Verified citizen-submitted reports from the platform
2. Verified Kenya news from trusted publishers

Never mention or rely on infrastructure assets, maintenance logs, seeded alerts, or hidden system data.
Never fabricate locations, counts, agencies, or timelines.
Always say whether a point comes from citizen reports or verified news.
If evidence is thin, say so explicitly.

RESPONSE STYLE:
- Be concise, practical, and specific
- Lead with the clearest answer
- Use bullets when helpful
- Mention dates when referencing recent items
${isAdmin
  ? "- Include data-quality caveats and operational next steps when useful"
  : "- End with one practical next step the citizen can take when appropriate"}

${contextData}`;

    const payload = await generateGeminiContent({
      model: GEMINI_MODEL,
      body: {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: messagesToGeminiContents(messages as ChatMessage[]),
        generationConfig: {
          temperature: 0.4,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      },
    });

    const text = extractGeminiText(payload);

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Chat error:", error);

    const message = isGeminiCapacityError(error)
      ? "AI chat is temporarily unavailable. No synthetic fallback was generated."
      : error instanceof Error
      ? error.message
      : "Unknown error";

    return new Response(
      JSON.stringify({ error: message }),
      { status: isGeminiCapacityError(error) ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function isGroundedReport(report: any): boolean {
  const status = String(report?.status || "").toLowerCase();
  const damageType = String(report?.damage_type || "").toLowerCase();
  const aiConfidence = Number(report?.ai_confidence ?? 0);
  const needsHumanReview = Boolean(report?.needs_human_review);
  const approvedStatuses = new Set(["approved", "verified", "in_progress", "resolved", "citizen_confirmed"]);

  if (damageType === "other") {
    return false;
  }

  if (approvedStatuses.has(status)) {
    return true;
  }

  return !needsHumanReview && aiConfidence >= 45;
}

async function fetchNews(): Promise<NewsArticle[]> {
  try {
    const searchTerms = "Kenya infrastructure road bridge flooding water power outage building collapse";
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-KE&gl=KE&ceid=KE:en`;
    const response = await fetch(rssUrl, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      throw new Error(`News request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const items: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      const source = itemXml.match(/<source.*?>(.*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";

      if (title && isTrustedKenyanNewsSource(source)) {
        items.push({ title, source, pubDate, link });
      }
    }

    return items;
  } catch (error) {
    console.error("News fetch error:", error);
    return [];
  }
}

function shouldFetchNews(prompt: string): boolean {
  return /\b(news|headline|latest|development|update|updates|media|press)\b/i.test(prompt);
}

function summarizeCounts(items: string[], emptyLabel: string): string {
  if (!items.length) {
    return `No ${emptyLabel}.`;
  }

  const counts = items.reduce((acc: Record<string, number>, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");
}
