import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractGeminiJson,
  generateGeminiContent,
  isGeminiCapacityError,
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

const GEMINI_MODEL = "gemini-3-flash-preview";

type NewsArticle = {
  title: string;
  source: string;
  pubDate: string;
  link: string;
};

type AiPredictionsResponse = {
  data_status?: "ready" | "insufficient_data";
  data_quality_notes?: string[];
  evidence_counts?: {
    trusted_reports: number;
    verified_news_articles: number;
  };
  recommendations: Array<{
    title: string;
    priority: "critical" | "high" | "medium";
    category: string;
    description: string;
    confidence: number;
    confidence_basis: string;
    estimated_impact: string;
    timeline: string;
    budget_estimate: string;
  }>;
  predictions: Array<{
    asset_name: string;
    prediction: string;
    risk_level: "critical" | "high" | "medium" | "low";
    timeframe: string;
    confidence: number;
    preventive_action: string;
    cost_if_ignored: string;
  }>;
  risk_matrix: Array<{
    category: string;
    current_risk: "critical" | "high" | "medium" | "low";
    trend: "worsening" | "stable" | "improving";
    incidents_30d: number;
    projected_incidents_90d: number;
    investment_priority: number;
  }>;
  executive_summary: string;
  trend_analysis: {
    improving_areas: string[];
    declining_areas: string[];
    key_patterns: string[];
    seasonal_risks: string[];
  };
  budget_allocation: Array<{
    category: string;
    recommended_percent: number;
    justification: string;
  }>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type } = await req.json().catch(() => ({ type: "full" }));

    const { data: reportsData, error: reportsError } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportsError) {
      throw reportsError;
    }

    const trustedReports = filterTrustedReports(reportsData ?? []).filter(isGroundedReport);
    const verifiedNews = await fetchVerifiedNews();
    const evidenceCounts = {
      trusted_reports: trustedReports.length,
      verified_news_articles: verifiedNews.length,
    };

    if (!hasAnyEvidence(evidenceCounts)) {
      return jsonResponse(buildInsufficientDataResponse(evidenceCounts));
    }

    const reportsByType = trustedReports.reduce((acc: Record<string, number>, report: any) => {
      const key = String(report.damage_type || "other");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const reportsBySeverity = trustedReports.reduce((acc: Record<string, number>, report: any) => {
      const key = String(report.severity || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const dataContext = JSON.stringify({
      requestType: type,
      reports: trustedReports.slice(0, 100).map((report: any) => ({
        title: report.title,
        damage_type: report.damage_type,
        severity: report.severity,
        status: report.status,
        address: report.address,
        created_at: report.created_at,
        description: report.description,
        ai_confidence: report.ai_confidence,
      })),
      news: verifiedNews,
      summary: {
        totalReports: trustedReports.length,
        totalNewsArticles: verifiedNews.length,
        reportsByType,
        reportsBySeverity,
      },
    });

    const systemPrompt = `You are CiviGuard AI, a Kenya infrastructure intelligence analyst.

Use only these sources:
1. Verified citizen-submitted reports stored in the platform
2. Verified Kenya news articles from trusted news publishers

Do not use asset registries, maintenance logs, alerts, seed data, placeholders, or invented facts.
Do not fabricate locations, incident counts, agencies, or timelines.
If evidence is limited, say so clearly and stay conservative.
Generate useful recommendations from the evidence that exists now; do not require a minimum report count beyond the supplied data.
Every recommendation must include a confidence score from 0-100 based on the available report and news evidence only.
Use lower confidence when there are few reports, no verified news articles, low report AI confidence, vague locations, or mixed signals.`;

    const userPrompt = `Analyze this grounded Kenya infrastructure evidence and return a valid JSON object with these exact top-level keys:

1. "recommendations" - array of 6 objects with operational recommendations, each with confidence and confidence_basis
2. "predictions" - array of 5 objects with forward-looking risk statements based only on report/news patterns
3. "risk_matrix" - array of up to 8 objects with category-level risk tracking
4. "executive_summary" - string with a concise 3-paragraph executive summary
5. "trend_analysis" - object with improving_areas, declining_areas, key_patterns, and seasonal_risks
6. "budget_allocation" - array of 5 objects for investment guidance

For the "predictions" array, use the "asset_name" field as the report cluster, location, or issue theme being discussed.

DATA:
${dataContext}`;

    const payload = await generateGeminiContent({
      model: GEMINI_MODEL,
      body: {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{
          role: "user",
          parts: [{ text: userPrompt }],
        }],
        generationConfig: {
          temperature: 0.25,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: {
              recommendations: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    priority: { type: "STRING", enum: ["critical", "high", "medium"] },
                    category: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
                    confidence_basis: { type: "STRING" },
                    estimated_impact: { type: "STRING" },
                    timeline: { type: "STRING" },
                    budget_estimate: { type: "STRING" },
                  },
                  required: ["title", "priority", "category", "description", "confidence", "confidence_basis", "estimated_impact", "timeline", "budget_estimate"],
                },
              },
              predictions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    asset_name: { type: "STRING" },
                    prediction: { type: "STRING" },
                    risk_level: { type: "STRING", enum: ["critical", "high", "medium", "low"] },
                    timeframe: { type: "STRING" },
                    confidence: { type: "INTEGER", minimum: 0, maximum: 100 },
                    preventive_action: { type: "STRING" },
                    cost_if_ignored: { type: "STRING" },
                  },
                  required: ["asset_name", "prediction", "risk_level", "timeframe", "confidence", "preventive_action", "cost_if_ignored"],
                },
              },
              risk_matrix: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING" },
                    current_risk: { type: "STRING", enum: ["critical", "high", "medium", "low"] },
                    trend: { type: "STRING", enum: ["worsening", "stable", "improving"] },
                    incidents_30d: { type: "INTEGER", minimum: 0 },
                    projected_incidents_90d: { type: "INTEGER", minimum: 0 },
                    investment_priority: { type: "INTEGER", minimum: 1, maximum: 10 },
                  },
                  required: ["category", "current_risk", "trend", "incidents_30d", "projected_incidents_90d", "investment_priority"],
                },
              },
              executive_summary: { type: "STRING" },
              trend_analysis: {
                type: "OBJECT",
                properties: {
                  improving_areas: { type: "ARRAY", items: { type: "STRING" } },
                  declining_areas: { type: "ARRAY", items: { type: "STRING" } },
                  key_patterns: { type: "ARRAY", items: { type: "STRING" } },
                  seasonal_risks: { type: "ARRAY", items: { type: "STRING" } },
                },
                required: ["improving_areas", "declining_areas", "key_patterns", "seasonal_risks"],
              },
              budget_allocation: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING" },
                    recommended_percent: { type: "INTEGER", minimum: 0, maximum: 100 },
                    justification: { type: "STRING" },
                  },
                  required: ["category", "recommended_percent", "justification"],
                },
              },
            },
            required: [
              "recommendations",
              "predictions",
              "risk_matrix",
              "executive_summary",
              "trend_analysis",
              "budget_allocation",
            ],
          },
        },
      },
    });

    const parsed = extractGeminiJson<AiPredictionsResponse>(payload);

    return jsonResponse({
      data_status: "ready",
      data_quality_notes: [
        "AI output is grounded only in trusted citizen reports and verified Kenya news coverage.",
        buildEvidenceQualityNote(evidenceCounts),
      ],
      evidence_counts: evidenceCounts,
      recommendations: normalizeRecommendations(parsed.recommendations, evidenceCounts),
      predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
      risk_matrix: Array.isArray(parsed.risk_matrix) ? parsed.risk_matrix : [],
      executive_summary: parsed.executive_summary || "",
      trend_analysis: {
        improving_areas: Array.isArray(parsed.trend_analysis?.improving_areas) ? parsed.trend_analysis.improving_areas : [],
        declining_areas: Array.isArray(parsed.trend_analysis?.declining_areas) ? parsed.trend_analysis.declining_areas : [],
        key_patterns: Array.isArray(parsed.trend_analysis?.key_patterns) ? parsed.trend_analysis.key_patterns : [],
        seasonal_risks: Array.isArray(parsed.trend_analysis?.seasonal_risks) ? parsed.trend_analysis.seasonal_risks : [],
      },
      budget_allocation: Array.isArray(parsed.budget_allocation) ? parsed.budget_allocation : [],
    });
  } catch (error) {
    console.error("AI predictions error:", error);

    const status = isGeminiCapacityError(error) ? 503 : 500;
    const message = isGeminiCapacityError(error)
      ? "AI analysis is temporarily unavailable. No synthetic fallback was generated."
      : error instanceof Error
      ? error.message
      : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(payload: AiPredictionsResponse) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRecommendations(
  recommendations: AiPredictionsResponse["recommendations"] | undefined,
  evidenceCounts: { trusted_reports: number; verified_news_articles: number },
): AiPredictionsResponse["recommendations"] {
  if (!Array.isArray(recommendations)) {
    return [];
  }

  return recommendations.map((recommendation) => ({
    ...recommendation,
    confidence: clampConfidence(recommendation.confidence ?? calculateEvidenceConfidence(evidenceCounts)),
    confidence_basis: recommendation.confidence_basis || buildEvidenceQualityNote(evidenceCounts),
  }));
}

function calculateEvidenceConfidence(
  evidenceCounts: { trusted_reports: number; verified_news_articles: number },
): number {
  const reportScore = Math.min(evidenceCounts.trusted_reports, 20) * 3;
  const newsScore = Math.min(evidenceCounts.verified_news_articles, 8) * 4;
  return clampConfidence(25 + reportScore + newsScore);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildEvidenceQualityNote(
  evidenceCounts: { trusted_reports: number; verified_news_articles: number },
): string {
  return `Confidence reflects ${evidenceCounts.trusted_reports} trusted citizen reports and ${evidenceCounts.verified_news_articles} verified Kenya news articles available at generation time.`;
}

function isGroundedReport(report: any): boolean {
  const status = String(report?.status || "").toLowerCase();
  const aiConfidence = Number(report?.ai_confidence ?? 0);
  const needsHumanReview = Boolean(report?.needs_human_review);
  const fraudFlag = Boolean(report?.fraud_flag);
  const spamFlag = Boolean(report?.spam_flag);
  const rejectedStatuses = new Set(["dismissed", "rejected"]);
  const approvedStatuses = new Set([
    "approved",
    "verified",
    "in_progress",
    "resolved",
    "citizen_confirmed",
    "submitted",
    "pending",
    "reviewing",
  ]);

  if (fraudFlag || spamFlag || rejectedStatuses.has(status)) {
    return false;
  }

  if (approvedStatuses.has(status)) {
    return true;
  }

  return !needsHumanReview && aiConfidence >= 45;
}

function hasAnyEvidence(
  evidenceCounts: { trusted_reports: number; verified_news_articles: number },
): boolean {
  return evidenceCounts.trusted_reports > 0 || evidenceCounts.verified_news_articles > 0;
}

function buildInsufficientDataResponse(
  evidenceCounts: { trusted_reports: number; verified_news_articles: number },
): AiPredictionsResponse {
  return {
    data_status: "insufficient_data",
    data_quality_notes: [
      "AI analysis needs at least one trusted citizen report or verified Kenya news article.",
      "No minimum cluster size is required once evidence exists.",
    ],
    evidence_counts: evidenceCounts,
    recommendations: [],
    predictions: [],
    risk_matrix: [],
    executive_summary:
      `CiviGuard AI cannot generate grounded strategic analysis yet. Verified evidence currently available: ` +
      `${evidenceCounts.trusted_reports} trusted citizen reports and ${evidenceCounts.verified_news_articles} verified news articles.`,
    trend_analysis: {
      improving_areas: [],
      declining_areas: [],
      key_patterns: [],
      seasonal_risks: [],
    },
    budget_allocation: [],
  };
}

async function fetchVerifiedNews(): Promise<NewsArticle[]> {
  try {
    const searchTerms = "Kenya infrastructure road bridge flooding water power outage building collapse";
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-KE&gl=KE&ceid=KE:en`;
    const response = await fetch(rssUrl, {
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`News request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const items: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
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
    console.error("Verified news fetch failed:", error);
    return [];
  }
}
