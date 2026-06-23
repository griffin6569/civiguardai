import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ReportRow = {
  id: string;
  title: string;
  severity: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  status: string;
  priority_score: number | null;
};

type AlertRow = {
  id: string;
  severity: string;
  latitude: number | null;
  longitude: number | null;
};

type AssetRow = {
  id: string;
  health_score: number;
  latitude: number;
  longitude: number;
};

type Cluster = {
  reports: ReportRow[];
  centerLat: number;
  centerLng: number;
};

const CLUSTER_RADIUS_KM = 0.5;
const ASSET_LOOKUP_RADIUS_KM = 1;
const ALERT_LOOKUP_RADIUS_KM = 1;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterReports(reports: ReportRow[]): Cluster[] {
  const assigned = new Set<string>();
  const clusters: Cluster[] = [];
  const sorted = [...reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const report of sorted) {
    if (assigned.has(report.id)) continue;
    const clusterReports: ReportRow[] = [report];
    assigned.add(report.id);

    for (const candidate of sorted) {
      if (assigned.has(candidate.id)) continue;
      if (
        haversineKm(report.latitude, report.longitude, candidate.latitude, candidate.longitude) <=
        CLUSTER_RADIUS_KM
      ) {
        clusterReports.push(candidate);
        assigned.add(candidate.id);
      }
    }

    const centerLat =
      clusterReports.reduce((sum, item) => sum + item.latitude, 0) / clusterReports.length;
    const centerLng =
      clusterReports.reduce((sum, item) => sum + item.longitude, 0) / clusterReports.length;

    clusters.push({ reports: clusterReports, centerLat, centerLng });
  }

  return clusters;
}

function severityWeight(severity: string | null): number {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return 1;
    case "high":
      return 0.8;
    case "medium":
      return 0.5;
    case "low":
      return 0.25;
    default:
      return 0.3;
  }
}

function zoneLabel(score: number): "Monitor Zone" | "High Risk Zone" | "Emergency Zone" {
  if (score >= 70) return "Emergency Zone";
  if (score >= 40) return "High Risk Zone";
  return "Monitor Zone";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const windowHours = Math.max(1, Number(body.windowHours || 72));
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const [{ data: reports, error: reportsError }, { data: alerts, error: alertsError }, { data: assets, error: assetsError }] =
      await Promise.all([
        supabase
          .from("reports")
          .select("id, title, severity, latitude, longitude, created_at, status, priority_score")
          .gte("created_at", cutoff)
          .not("status", "eq", "dismissed"),
        supabase
          .from("alerts")
          .select("id, severity, latitude, longitude")
          .eq("is_active", true),
        supabase
          .from("infrastructure_assets")
          .select("id, health_score, latitude, longitude"),
      ]);

    if (reportsError) throw reportsError;
    if (alertsError) throw alertsError;
    if (assetsError) throw assetsError;

    const reportRows = (reports || []) as ReportRow[];
    const alertRows = (alerts || []) as AlertRow[];
    const assetRows = (assets || []) as AssetRow[];

    if (!reportRows.length) {
      return new Response(
        JSON.stringify({ success: true, zonesComputed: 0, message: "No recent reports to score." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clusters = clusterReports(reportRows);
    const computedZones: Array<Record<string, unknown>> = [];

    for (const cluster of clusters) {
      const reportCount = cluster.reports.length;
      const volumeComponent = Math.min(1, reportCount / 10);

      const severityComponent =
        cluster.reports.reduce((sum, report) => sum + severityWeight(report.severity), 0) / reportCount;

      const reportsLast24h = cluster.reports.filter(
        (report) => new Date(report.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000,
      ).length;
      const timePatternComponent = Math.min(1, reportsLast24h / Math.max(1, reportCount));

      const locationDensityComponent = Math.min(1, reportCount / 5);

      const nearbyAssets = assetRows.filter(
        (asset) =>
          haversineKm(cluster.centerLat, cluster.centerLng, asset.latitude, asset.longitude) <=
          ASSET_LOOKUP_RADIUS_KM,
      );
      const vulnerableAssets = nearbyAssets.filter((asset) => asset.health_score < 50);
      const assetVulnerabilityComponent =
        nearbyAssets.length > 0 ? vulnerableAssets.length / nearbyAssets.length : 0;

      const nearbyAlerts = alertRows.filter(
        (alert) =>
          alert.latitude !== null &&
          alert.longitude !== null &&
          haversineKm(cluster.centerLat, cluster.centerLng, alert.latitude, alert.longitude) <=
            ALERT_LOOKUP_RADIUS_KM,
      );
      const activeAlertsComponent = Math.min(1, nearbyAlerts.length / 3);

      const score = Math.round(
        volumeComponent * 25 * 1 +
          severityComponent * 25 +
          timePatternComponent * 15 +
          locationDensityComponent * 15 +
          assetVulnerabilityComponent * 10 +
          activeAlertsComponent * 10,
      );

      const label = zoneLabel(score);
      const zoneKey = `${cluster.centerLat.toFixed(3)}:${cluster.centerLng.toFixed(3)}:${windowHours}`;

      const metrics = {
        window_hours: windowHours,
        volume_component: Number(volumeComponent.toFixed(3)),
        severity_component: Number(severityComponent.toFixed(3)),
        time_pattern_component: Number(timePatternComponent.toFixed(3)),
        location_density_component: Number(locationDensityComponent.toFixed(3)),
        asset_vulnerability_component: Number(assetVulnerabilityComponent.toFixed(3)),
        active_alerts_component: Number(activeAlertsComponent.toFixed(3)),
      };

      const { data: zone, error: zoneError } = await supabase
        .from("risk_zones")
        .upsert(
          {
            zone_key: zoneKey,
            label,
            score,
            status: "active",
            center_latitude: cluster.centerLat,
            center_longitude: cluster.centerLng,
            radius_km: CLUSTER_RADIUS_KM,
            source_window_hours: windowHours,
            report_count: reportCount,
            high_severity_count: cluster.reports.filter((report) =>
              ["high", "critical"].includes((report.severity || "").toLowerCase()),
            ).length,
            asset_exposure_count: vulnerableAssets.length,
            active_alert_count: nearbyAlerts.length,
            metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "zone_key" },
        )
        .select("id")
        .single();
      if (zoneError) throw zoneError;

      await supabase.from("risk_zone_snapshots").insert({
        risk_zone_id: zone.id,
        label,
        score,
        metrics,
      });

      await supabase.from("risk_score_inputs").insert([
        {
          risk_zone_id: zone.id,
          input_type: "report_volume",
          weight: 0.25,
          contribution: Number((volumeComponent * 25).toFixed(3)),
          metadata: { count: reportCount },
        },
        {
          risk_zone_id: zone.id,
          input_type: "severity_weight",
          weight: 0.25,
          contribution: Number((severityComponent * 25).toFixed(3)),
          metadata: { average: severityComponent },
        },
        {
          risk_zone_id: zone.id,
          input_type: "time_pattern",
          weight: 0.15,
          contribution: Number((timePatternComponent * 15).toFixed(3)),
          metadata: { reports_last_24h: reportsLast24h },
        },
        {
          risk_zone_id: zone.id,
          input_type: "location_density",
          weight: 0.15,
          contribution: Number((locationDensityComponent * 15).toFixed(3)),
          metadata: { cluster_size: reportCount },
        },
        {
          risk_zone_id: zone.id,
          input_type: "asset_vulnerability",
          weight: 0.1,
          contribution: Number((assetVulnerabilityComponent * 10).toFixed(3)),
          metadata: { vulnerable_assets: vulnerableAssets.length },
        },
        {
          risk_zone_id: zone.id,
          input_type: "active_alerts",
          weight: 0.1,
          contribution: Number((activeAlertsComponent * 10).toFixed(3)),
          metadata: { alerts: nearbyAlerts.length },
        },
      ]);

      await supabase
        .from("reports")
        .update({
          risk_zone_id: zone.id,
          risk_zone_label: label,
          risk_zone_score: score,
        })
        .in(
          "id",
          cluster.reports.map((report) => report.id),
        );

      computedZones.push({
        riskZoneId: zone.id,
        zoneKey,
        label,
        score,
        reportCount,
        centerLatitude: cluster.centerLat,
        centerLongitude: cluster.centerLng,
      });
    }

    await supabase
      .from("risk_zones")
      .update({ status: "inactive" })
      .lt("computed_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        zonesComputed: computedZones.length,
        zones: computedZones,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("risk-score-engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
