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

type DamageAnalysis = {
  damage_type: "pothole" | "crack" | "leak" | "flooding" | "structural" | "electrical" | "other";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  title: string;
  description: string;
  explanation: string;
  evidence_indicators: string[];
  recommendation: string;
  needs_human_review: boolean;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageMatch = image.match(/^data:(.*?);base64,(.*)$/);
    if (!imageMatch) {
      return new Response(JSON.stringify({ error: "Image must be a base64 data URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [, mimeType, base64Data] = imageMatch;

    const payload = await generateGeminiContent({
      model: GEMINI_MODEL,
      body: {
        system_instruction: {
          parts: [{
            text: `You are an infrastructure damage analysis AI for CiviGuard, a Kenyan civic-tech platform. Analyze uploaded images and classify the damage with full transparency.

You MUST respond with a JSON object containing:
- damage_type: one of "pothole", "crack", "leak", "flooding", "structural", "electrical", "other"
- severity: one of "low", "medium", "high", "critical"
- confidence: integer 0-100 representing how confident you are in your assessment
- title: a short descriptive title for the report (max 60 chars)
- description: a 1-2 sentence description of the visible damage
- explanation: why you classified it this way (what visual indicators led to your decision)
- evidence_indicators: array of strings listing specific things you detected in the image
- recommendation: a suggested next action
- needs_human_review: boolean; set true if confidence < 60 or severity is "critical"

Respond ONLY with the JSON object, no markdown.`,
          }],
        },
        contents: [{
          role: "user",
          parts: [
            { text: "Analyze this infrastructure image. What type of damage is visible? How severe is it? Be transparent about your confidence." },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          response_mime_type: "application/json",
        },
      },
    });
    const result = extractGeminiJson<DamageAnalysis>(payload);

    if (result.confidence < 60 || result.severity === "critical") {
      result.needs_human_review = true;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-damage error:", error);

    if (isGeminiCapacityError(error)) {
      return new Response(JSON.stringify({
        error: "Image analysis is temporarily busy. Please retry in a few seconds.",
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
