import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  extractGeminiJson,
  generateGeminiContent,
  isGeminiCapacityError,
} from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

type SpamRiskAnalysis = {
  spam_score: number;
  is_spam: boolean;
  reasoning: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, description, damage_type, reporter_name, ip_address } = body;

    if (!title || !description) {
      return new Response(JSON.stringify({ error: "Title and description are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await generateGeminiContent({
      model: GEMINI_MODEL,
      body: {
        system_instruction: {
          parts: [{
            text: `You are an AI Spam Filter for a public civic reporting platform. You need to analyze the incoming report to determine if it is spam, a test, a prank, or offensive content.
A report should be flagged as spam if it is:
- Gibberish (e.g. "asdfasdf", "test 123")
- Commercial advertising
- Profane or highly inappropriate
- Completely unrelated to public infrastructure issues (e.g. "My neighbor's dog barks too much", "I want a pizza")

You MUST respond with a JSON object containing:
- spam_score: an integer from 0 to 100 where 0 is legitimate and 100 is absolutely spam.
- is_spam: boolean (true if spam_score >= 80, else false).
- reasoning: a short 1-sentence explanation of why you gave this score.

Respond ONLY with the JSON object, no markdown.`,
          }],
        },
        contents: [{
          role: "user",
          parts: [
            { text: `Please analyze this report for spam risk:
Title: ${title}
Description: ${description}
Damage Type: ${damage_type || "N/A"}
Reporter Name: ${reporter_name || "Guest"}` }
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          response_mime_type: "application/json",
        },
      },
    });

    const result = extractGeminiJson<SpamRiskAnalysis>(payload);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-spam-risk error:", error);

    if (isGeminiCapacityError(error)) {
      return new Response(JSON.stringify({
        error: "AI is temporarily busy. Please retry.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
