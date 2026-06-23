import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTrustedKenyanNewsSource } from "../_shared/kenya-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, location } = await req.json();

    // Build search query for Kenya infrastructure news
    const searchTerms = [
      "Kenya infrastructure",
      category ? `${category} damage` : "",
      location || "",
      "road collapse OR bridge damage OR flooding OR water burst OR power outage OR building collapse",
    ].filter(Boolean).join(" ");

    // Use Google News RSS as a free source (no API key required)
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-KE&gl=KE&ceid=KE:en`;
    
    const response = await fetch(rssUrl);
    const xml = await response.text();

    // Parse RSS XML to extract items
    const items: Array<{ title: string; link: string; pubDate: string; source: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      const source = itemXml.match(/<source.*?>(.*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "Google News";

      if (title && isTrustedKenyanNewsSource(source)) {
        items.push({ title, link, pubDate, source });
      }
    }

    return new Response(
      JSON.stringify({ success: true, articles: items, query: searchTerms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("News fetch error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to fetch news" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
