import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Rule = {
  id: string;
  name: string;
  min_report_count: number;
  min_priority_score: number;
  min_risk_score: number;
  severity_threshold: string;
  auto_notify: boolean;
  auto_alert: boolean;
  auto_raise_priority: boolean;
};

type ReportRow = {
  id: string;
  title: string;
  severity: string | null;
  status: string;
  priority_score: number | null;
  risk_zone_id: string | null;
  risk_zone_score: number | null;
  routed_authority_id: string | null;
  latitude: number;
  longitude: number;
};

type RiskZone = {
  id: string;
  label: string;
  score: number;
  report_count: number;
};

function severityRank(severity: string | null): number {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function alertSeverityFromRisk(score: number): "info" | "warning" | "critical" {
  if (score >= 70) return "critical";
  if (score >= 40) return "warning";
  return "info";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [{ data: rules, error: rulesError }, { data: riskZones, error: zonesError }, { data: reports, error: reportsError }] =
      await Promise.all([
        supabase
          .from("escalation_rules")
          .select("id, name, min_report_count, min_priority_score, min_risk_score, severity_threshold, auto_notify, auto_alert, auto_raise_priority")
          .eq("is_active", true),
        supabase
          .from("risk_zones")
          .select("id, label, score, report_count")
          .eq("status", "active"),
        supabase
          .from("reports")
          .select("id, title, severity, status, priority_score, risk_zone_id, risk_zone_score, routed_authority_id, latitude, longitude")
          .not("risk_zone_id", "is", null),
      ]);

    if (rulesError) throw rulesError;
    if (zonesError) throw zonesError;
    if (reportsError) throw reportsError;

    const zoneMap = new Map<string, RiskZone>();
    for (const zone of (riskZones || []) as RiskZone[]) {
      zoneMap.set(zone.id, zone);
    }

    const reportsByZone = new Map<string, ReportRow[]>();
    for (const report of (reports || []) as ReportRow[]) {
      if (["resolved", "dismissed"].includes(report.status)) continue;
      if (!report.risk_zone_id) continue;
      const existing = reportsByZone.get(report.risk_zone_id) || [];
      existing.push(report);
      reportsByZone.set(report.risk_zone_id, existing);
    }

    const summary: Array<Record<string, unknown>> = [];

    for (const rule of (rules || []) as Rule[]) {
      for (const [riskZoneId, zoneReports] of reportsByZone.entries()) {
        const zone = zoneMap.get(riskZoneId);
        if (!zone) continue;

        const highestSeverity = Math.max(...zoneReports.map((report) => severityRank(report.severity)));
        const highestPriority = Math.max(...zoneReports.map((report) => report.priority_score || 0));
        const severityPass = highestSeverity >= severityRank(rule.severity_threshold);
        const reportCountPass = zone.report_count >= rule.min_report_count;
        const priorityPass = highestPriority >= rule.min_priority_score;
        const riskPass = zone.score >= rule.min_risk_score;

        if (!(severityPass && reportCountPass && riskPass)) continue;

        const representativeReport = [...zoneReports].sort(
          (a, b) => (b.priority_score || 0) - (a.priority_score || 0),
        )[0];

        const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: existingEvent } = await supabase
          .from("escalation_events")
          .select("id")
          .eq("risk_zone_id", riskZoneId)
          .eq("rule_id", rule.id)
          .gte("created_at", recentCutoff)
          .maybeSingle();

        if (existingEvent) {
          summary.push({
            riskZoneId,
            rule: rule.name,
            status: "skipped_existing",
          });
          continue;
        }

        const triggerScore = Math.max(zone.score, highestPriority);
        const authorityId = representativeReport.routed_authority_id;

        const { data: escalationEvent, error: escalationError } = await supabase
          .from("escalation_events")
          .insert({
            report_id: representativeReport.id,
            risk_zone_id: riskZoneId,
            authority_id: authorityId,
            rule_id: rule.id,
            trigger_reason: `Rule ${rule.name} matched with ${zone.report_count} reports and zone score ${zone.score}`,
            trigger_score: triggerScore,
            status: "triggered",
            details: {
              report_count: zone.report_count,
              zone_label: zone.label,
              highest_severity_rank: highestSeverity,
              highest_priority: highestPriority,
              priority_pass: priorityPass,
            },
          })
          .select("id")
          .single();
        if (escalationError) throw escalationError;

        if (rule.auto_raise_priority) {
          await supabase
            .from("reports")
            .update({
              priority_score: Math.max(triggerScore, rule.min_priority_score),
            })
            .in(
              "id",
              zoneReports.map((report) => report.id),
            );
        }

        if (rule.auto_alert) {
          await supabase.from("alerts").insert({
            title: `${zone.label}: ${representativeReport.title}`,
            message: `Automatic escalation triggered for risk zone ${zone.label} with ${zone.report_count} linked reports.`,
            severity: alertSeverityFromRisk(zone.score),
            latitude: representativeReport.latitude,
            longitude: representativeReport.longitude,
            is_active: true,
            asset_id: null,
          });
        }

        if (rule.auto_notify && authorityId) {
          await supabase.from("authority_notifications").insert({
            report_id: representativeReport.id,
            authority_id: authorityId,
            channel: "system",
            delivery_status: "queued",
            message_subject: `[CiviGuard Escalation] ${zone.label}`,
            message_body: `Risk zone ${zone.label} reached escalation threshold under rule ${rule.name}. Representative report: ${representativeReport.title}.`,
            provider_response: {
              escalation_event_id: escalationEvent.id,
              risk_zone_id: riskZoneId,
            },
          });

          await supabase
            .from("escalation_events")
            .update({ status: "notified" })
            .eq("id", escalationEvent.id);
        }

        summary.push({
          riskZoneId,
          rule: rule.name,
          status: authorityId && rule.auto_notify ? "triggered_and_notified" : "triggered",
          escalationEventId: escalationEvent.id,
          representativeReportId: representativeReport.id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        escalationsProcessed: summary.length,
        results: summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("escalation-engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
