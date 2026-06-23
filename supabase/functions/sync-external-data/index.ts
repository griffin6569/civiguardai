import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExternalAsset {
  name: string;
  type: string;
  status: string;
  health_score: number;
  latitude: number;
  longitude: number;
  source_system: string;
  external_id: string;
  source_last_updated: string;
  data_confidence: number;
  last_inspection?: string;
}

type ExternalDataSourceRecord = {
  id: string;
  name: string;
  endpoint_url?: string | null;
  auth_type?: string | null;
};

function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -5.5 &&
    lat <= 5.5 &&
    lng >= 33 &&
    lng <= 42.5
  );
}

function assignConfidenceScore(record: Record<string, unknown>): number {
  let score = 50;
  if (record.name) score += 10;
  if (record.latitude && record.longitude) score += 15;
  if (record.status || record.condition) score += 10;
  if (record.last_inspection || record.last_updated) score += 10;
  if (record.external_id || record.id) score += 5;
  return Math.min(100, score);
}

function deriveStatus(condition: string | number | undefined): string {
  if (typeof condition === "number") {
    if (condition >= 70) return "safe";
    if (condition >= 40) return "moderate";
    if (condition >= 20) return "high_risk";
    return "critical";
  }

  const normalized = String(condition || "").toLowerCase();
  if (["good", "operational", "safe", "excellent"].some((value) => normalized.includes(value))) {
    return "safe";
  }
  if (["fair", "moderate", "degraded"].some((value) => normalized.includes(value))) {
    return "moderate";
  }
  if (["poor", "high_risk", "damaged"].some((value) => normalized.includes(value))) {
    return "high_risk";
  }
  if (["critical", "failed", "offline", "collapsed"].some((value) => normalized.includes(value))) {
    return "critical";
  }

  return "moderate";
}

function deriveHealthScore(condition: string | number | undefined): number {
  if (typeof condition === "number") {
    return Math.max(0, Math.min(100, condition));
  }

  const normalized = String(condition || "").toLowerCase();
  if (["good", "operational", "safe", "excellent"].some((value) => normalized.includes(value))) {
    return 85;
  }
  if (["fair", "moderate"].some((value) => normalized.includes(value))) {
    return 60;
  }
  if (["poor", "damaged", "high_risk"].some((value) => normalized.includes(value))) {
    return 35;
  }
  if (["critical", "failed", "offline"].some((value) => normalized.includes(value))) {
    return 15;
  }

  return 50;
}

function normalizeSourceSystem(source: ExternalDataSourceRecord): string {
  if (source.endpoint_url) {
    try {
      return new URL(source.endpoint_url).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // fall through to a name-based fallback
    }
  }

  return source.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function transformToAsset(
  raw: Record<string, unknown>,
  sourceSystem: string,
): ExternalAsset | null {
  const geometry = raw.geometry as { coordinates?: unknown[] } | undefined;
  const lat = Number(raw.latitude || raw.lat || raw.y || geometry?.coordinates?.[1]);
  const lng = Number(raw.longitude || raw.lng || raw.lon || raw.x || geometry?.coordinates?.[0]);

  if (!validateCoordinates(lat, lng)) {
    return null;
  }

  const name = String(raw.name || raw.title || raw.road_name || raw.asset_name || "Unknown Asset");
  const type = String(raw.type || raw.asset_type || raw.category || "road").toLowerCase();
  const condition = raw.condition || raw.condition_score || raw.status;
  const externalId = String(raw.external_id || raw.id || raw.asset_id || `${sourceSystem}-${lat}-${lng}`);

  return {
    name,
    type: [
      "road",
      "bridge",
      "water",
      "power",
      "sewage",
      "building",
      "drainage",
      "water_sewage",
      "public_facility",
      "environmental",
    ].includes(type)
      ? type
      : "road",
    status: deriveStatus(condition),
    health_score: deriveHealthScore(condition),
    latitude: lat,
    longitude: lng,
    source_system: sourceSystem,
    external_id: externalId,
    source_last_updated: new Date().toISOString(),
    data_confidence: assignConfidenceScore(raw),
    last_inspection: raw.last_inspection ? String(raw.last_inspection) : undefined,
  };
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deduplicateByLocation(
  assets: ExternalAsset[],
  thresholdKm = 0.05,
): ExternalAsset[] {
  const unique: ExternalAsset[] = [];

  for (const asset of assets) {
    const isDuplicate = unique.some((existing) =>
      haversineKm(existing.latitude, existing.longitude, asset.latitude, asset.longitude) <
        thresholdKm &&
      existing.type === asset.type
    );

    if (!isDuplicate) {
      unique.push(asset);
    }
  }

  return unique;
}

function extractRecordsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Source payload is not a JSON object or array");
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.features)) {
    return record.features
      .filter((feature): feature is Record<string, unknown> =>
        typeof feature === "object" && feature !== null
      )
      .map((feature) => ({
        ...(typeof feature.properties === "object" && feature.properties !== null
          ? feature.properties as Record<string, unknown>
          : {}),
        geometry: feature.geometry,
      }));
  }

  for (const key of ["data", "results", "items", "records"]) {
    if (Array.isArray(record[key])) {
      return record[key].filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
      );
    }
  }

  throw new Error("Could not find a usable records array in the source payload");
}

async function fetchSourceRecords(
  source: ExternalDataSourceRecord,
): Promise<Record<string, unknown>[]> {
  if (!source.endpoint_url) {
    throw new Error(
      `Source "${source.name}" is missing endpoint_url. Configure a real public data endpoint before syncing.`,
    );
  }

  const response = await fetch(source.endpoint_url, {
    headers: {
      Accept: "application/json, application/geo+json",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Source request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return extractRecordsFromPayload(payload);
}

async function syncSource(
  supabase: ReturnType<typeof createClient>,
  source: ExternalDataSourceRecord,
): Promise<{ processed: number; created: number; updated: number; error?: string }> {
  const { data: log } = await supabase
    .from("external_sync_logs")
    .insert({
      source_id: source.id,
      status: "running",
    })
    .select("id")
    .single();

  const logId = log?.id;

  try {
    const sourceSystem = normalizeSourceSystem(source);
    const rawData = await fetchSourceRecords(source);

    const assets = rawData
      .map((record) => transformToAsset(record, sourceSystem))
      .filter((asset): asset is ExternalAsset => asset !== null);

    const deduplicated = deduplicateByLocation(assets);

    let created = 0;
    let updated = 0;

    for (const asset of deduplicated) {
      const { data: existing } = await supabase
        .from("infrastructure_assets")
        .select("id")
        .eq("source_system", asset.source_system)
        .eq("external_id", asset.external_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("infrastructure_assets")
          .update({
            name: asset.name,
            type: asset.type,
            status: asset.status,
            health_score: asset.health_score,
            latitude: asset.latitude,
            longitude: asset.longitude,
            source_last_updated: asset.source_last_updated,
            data_confidence: asset.data_confidence,
            last_inspection: asset.last_inspection || null,
          })
          .eq("id", existing.id);
        updated += 1;
      } else {
        await supabase.from("infrastructure_assets").insert({
          name: asset.name,
          type: asset.type,
          status: asset.status,
          health_score: asset.health_score,
          latitude: asset.latitude,
          longitude: asset.longitude,
          source_system: asset.source_system,
          external_id: asset.external_id,
          source_last_updated: asset.source_last_updated,
          data_confidence: asset.data_confidence,
          last_inspection: asset.last_inspection || null,
        });
        created += 1;
      }
    }

    if (logId) {
      await supabase.from("external_sync_logs").update({
        status: "success",
        records_processed: deduplicated.length,
        records_created: created,
        records_updated: updated,
        completed_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    await supabase.from("external_data_sources").update({
      last_synced: new Date().toISOString(),
      records_count: deduplicated.length,
    }).eq("id", source.id);

    return { processed: deduplicated.length, created, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (logId) {
      await supabase.from("external_sync_logs").update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return { processed: 0, created: 0, updated: 0, error: message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const sourceId = body?.source_id;

    if (sourceId) {
      const { data: source } = await supabase
        .from("external_data_sources")
        .select("id, name, endpoint_url, auth_type")
        .eq("id", sourceId)
        .single();

      if (!source) {
        return new Response(JSON.stringify({ error: "Source not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncSource(supabase, source);
      return new Response(JSON.stringify({ source: source.name, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sources } = await supabase
      .from("external_data_sources")
      .select("id, name, endpoint_url, auth_type")
      .eq("is_active", true);

    const results = [];
    for (const source of sources || []) {
      const result = await syncSource(supabase, source);
      results.push({ source: source.name, ...result });
    }

    const totalProcessed = results.reduce((sum, result) => sum + result.processed, 0);
    const totalCreated = results.reduce((sum, result) => sum + result.created, 0);
    const totalUpdated = results.reduce((sum, result) => sum + result.updated, 0);
    const errors = results.filter((result) => result.error);

    return new Response(JSON.stringify({
      summary: {
        sources_synced: results.length,
        total_processed: totalProcessed,
        total_created: totalCreated,
        total_updated: totalUpdated,
        errors: errors.length,
      },
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
