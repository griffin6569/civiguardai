import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ReportRecord = {
  id: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  user_id: string | null;
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashString(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

async function hashImageContent(imageBase64?: string | null, imageUrl?: string | null): Promise<string | null> {
  if (imageBase64) {
    return await hashString(imageBase64.replace(/^data:[^,]+,/, ""));
  }

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return await hashString(imageUrl);
      const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
      return toHex(digest);
    } catch {
      return await hashString(imageUrl);
    }
  }

  return null;
}

function inKenyaBounds(latitude: number, longitude: number): boolean {
  return latitude >= -5.5 && latitude <= 5.5 && longitude >= 33 && longitude <= 42.5;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { reportId, imageUrl, imageBase64, latitude, longitude, capturedAt } = body;

    let report: ReportRecord | null = null;
    if (reportId) {
      const { data, error } = await supabase
        .from("reports")
        .select("id, image_url, latitude, longitude, created_at, user_id")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      report = data as ReportRecord;
    }

    const effectiveImageUrl = report?.image_url ?? imageUrl ?? null;
    const effectiveLatitude = Number(report?.latitude ?? latitude ?? NaN);
    const effectiveLongitude = Number(report?.longitude ?? longitude ?? NaN);
    const effectiveCapturedAt = capturedAt || report?.created_at || new Date().toISOString();

    const anomalyFlags: string[] = [];
    const reasonCodes: string[] = [];

    if (!effectiveImageUrl && !imageBase64) {
      anomalyFlags.push("missing_image");
      reasonCodes.push("NO_IMAGE");
    }

    const metadataValid = !Number.isNaN(Date.parse(effectiveCapturedAt));
    if (!metadataValid) {
      anomalyFlags.push("invalid_capture_timestamp");
      reasonCodes.push("INVALID_TIMESTAMP");
    }

    const captureDate = new Date(effectiveCapturedAt);
    if (metadataValid && captureDate.getTime() > Date.now() + 60 * 60 * 1000) {
      anomalyFlags.push("future_timestamp");
      reasonCodes.push("FUTURE_TIMESTAMP");
    }

    const gpsConsistent =
      Number.isFinite(effectiveLatitude) &&
      Number.isFinite(effectiveLongitude) &&
      inKenyaBounds(effectiveLatitude, effectiveLongitude);

    if (!gpsConsistent) {
      anomalyFlags.push("gps_outside_supported_bounds");
      reasonCodes.push("GPS_MISMATCH");
    }

    const sha256 = await hashImageContent(imageBase64 ?? null, effectiveImageUrl);
    const perceptualHash = sha256 ? sha256.slice(0, 16) : null;

    let duplicateMediaFound = false;
    let duplicateReportId: string | null = null;
    if (sha256) {
      const { data: existingFingerprints } = await supabase
        .from("report_media_fingerprints")
        .select("report_id, sha256")
        .eq("sha256", sha256)
        .limit(5);

      const duplicate = (existingFingerprints || []).find((item) => item.report_id !== report?.id);
      if (duplicate) {
        duplicateMediaFound = true;
        duplicateReportId = duplicate.report_id;
        anomalyFlags.push("duplicate_media_detected");
        reasonCodes.push("DUPLICATE_IMAGE");
      }
    }

    let authenticityScore = 100;
    let fraudScore = 0;

    if (!metadataValid) {
      authenticityScore -= 15;
      fraudScore += 20;
    }
    if (!gpsConsistent) {
      authenticityScore -= 25;
      fraudScore += 25;
    }
    if (duplicateMediaFound) {
      authenticityScore -= 35;
      fraudScore += 45;
    }
    if (!effectiveImageUrl && !imageBase64) {
      authenticityScore -= 20;
      fraudScore += 15;
    }

    authenticityScore = Math.max(0, Math.min(100, authenticityScore));
    fraudScore = Math.max(0, Math.min(100, fraudScore));
    const requiresManualReview =
      fraudScore >= 50 || duplicateMediaFound || !metadataValid || !gpsConsistent;

    const resultSummary =
      requiresManualReview
        ? "Evidence requires manual review before it can trigger automated workflows."
        : "Evidence passed the first-pass authenticity checks.";

    if (report?.id && sha256) {
      await supabase.from("report_media_fingerprints").upsert(
        {
          report_id: report.id,
          image_url: effectiveImageUrl,
          sha256,
          perceptual_hash: perceptualHash,
          metadata: {
            captured_at: effectiveCapturedAt,
            latitude: effectiveLatitude,
            longitude: effectiveLongitude,
          },
        },
        { onConflict: "report_id" },
      );
    }

    let authenticityCheckId: string | null = null;
    if (report?.id) {
      const { data: authenticityCheck, error: authenticityError } = await supabase
        .from("evidence_authenticity_checks")
        .insert({
          report_id: report.id,
          authenticity_score: authenticityScore,
          fraud_score: fraudScore,
          requires_manual_review: requiresManualReview,
          metadata_valid: metadataValid,
          gps_consistent: gpsConsistent,
          duplicate_media_found: duplicateMediaFound,
          anomaly_flags: anomalyFlags,
          result_summary: resultSummary,
          raw_result: {
            duplicate_report_id: duplicateReportId,
            reason_codes: reasonCodes,
            captured_at: effectiveCapturedAt,
          },
        })
        .select("id")
        .single();
      if (authenticityError) throw authenticityError;
      authenticityCheckId = authenticityCheck.id;

      await supabase
        .from("reports")
        .update({
          authenticity_score: authenticityScore,
          fraud_score: fraudScore,
          needs_human_review: requiresManualReview,
          fraud_flag: fraudScore >= 50,
          duplicate_of: duplicateReportId,
        })
        .eq("id", report.id);

      for (const reasonCode of reasonCodes) {
        await supabase.from("fraud_detection_events").insert({
          report_id: report.id,
          event_type: "authenticity_check",
          severity: fraudScore >= 70 ? "high" : fraudScore >= 40 ? "medium" : "low",
          reason_code: reasonCode,
          details: {
            authenticity_check_id: authenticityCheckId,
            authenticity_score: authenticityScore,
            fraud_score: fraudScore,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        authenticityCheckId,
        authenticityScore,
        fraudScore,
        duplicateMediaFound,
        duplicateReportId,
        metadataValid,
        gpsConsistent,
        requiresManualReview,
        anomalyFlags,
        resultSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("evidence-authenticity error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
