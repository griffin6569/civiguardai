import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function withinBounds(
  latitude: number | null,
  longitude: number | null,
  bounds?: { north: number; south: number; east: number; west: number } | null,
): boolean {
  if (!bounds) return true;
  if (latitude === null || longitude === null) return false;
  return (
    latitude <= bounds.north &&
    latitude >= bounds.south &&
    longitude <= bounds.east &&
    longitude >= bounds.west
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const bounds = body.bounds || null;

    const [
      { data: assets, error: assetsError },
      { data: reports, error: reportsError },
      { data: alerts, error: alertsError },
      { data: riskZones, error: riskZonesError },
      { data: authorities, error: authoritiesError },
    ] = await Promise.all([
      supabase
        .from("infrastructure_assets")
        .select("id, name, type, status, health_score, latitude, longitude, source_system, data_confidence"),
      supabase
        .from("reports")
        .select("id, title, damage_type, severity, status, latitude, longitude, risk_zone_label, risk_zone_score, routed_authority_id, authenticity_score, fraud_score")
        .not("status", "eq", "dismissed"),
      supabase
        .from("alerts")
        .select("id, title, severity, message, latitude, longitude, is_active")
        .eq("is_active", true),
      supabase
        .from("risk_zones")
        .select("id, label, score, center_latitude, center_longitude, radius_km, report_count, status")
        .eq("status", "active"),
      supabase
        .from("authority_directory")
        .select("id, name, authority_type, county, subcounty, latitude, longitude, is_active")
        .eq("is_active", true),
    ]);

    if (assetsError) throw assetsError;
    if (reportsError) throw reportsError;
    if (alertsError) throw alertsError;
    if (riskZonesError) throw riskZonesError;
    if (authoritiesError) throw authoritiesError;

    const filteredAssets = (assets || []).filter((item) =>
      withinBounds(item.latitude, item.longitude, bounds),
    );
    const filteredReports = (reports || []).filter((item) =>
      withinBounds(item.latitude, item.longitude, bounds),
    );
    const filteredAlerts = (alerts || []).filter((item) =>
      withinBounds(item.latitude, item.longitude, bounds),
    );
    const filteredRiskZones = (riskZones || []).filter((item) =>
      withinBounds(item.center_latitude, item.center_longitude, bounds),
    );
    const filteredAuthorities = (authorities || []).filter((item) =>
      withinBounds(item.latitude, item.longitude, bounds),
    );

    return new Response(
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        layers: {
          assets: filteredAssets,
          reports: filteredReports,
          alerts: filteredAlerts,
          riskZones: filteredRiskZones,
          authorities: filteredAuthorities,
        },
        summary: {
          assets: filteredAssets.length,
          reports: filteredReports.length,
          alerts: filteredAlerts.length,
          riskZones: filteredRiskZones.length,
          authorities: filteredAuthorities.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("digital-twin-layers error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
