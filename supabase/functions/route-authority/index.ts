import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ReportRecord = {
  id: string;
  title: string;
  description: string;
  damage_type: string;
  severity: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  reporter_name: string | null;
};

type Authority = {
  id: string;
  name: string;
  authority_type: string;
  county: string | null;
  subcounty: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  webhook_url: string | null;
  priority: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
};

type Jurisdiction = {
  authority_id: string;
  county: string | null;
  subcounty: string | null;
  issue_categories: string[] | null;
  coverage_mode: string;
  center_latitude: number | null;
  center_longitude: number | null;
  radius_km: number;
};

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

function normalize(text?: string | null): string {
  return (text || "").trim().toLowerCase();
}

function inferIssueCategory(input: {
  issueCategory?: string | null;
  damageType?: string | null;
  description?: string | null;
  title?: string | null;
}): string {
  const explicit = normalize(input.issueCategory);
  if (explicit) return explicit;

  const damageType = normalize(input.damageType);
  const combined = `${normalize(input.title)} ${normalize(input.description)}`;

  if (["pothole", "crack"].includes(damageType)) return "road";
  if (damageType === "structural") return "bridge";
  if (damageType === "flooding") return "flooding";
  if (damageType === "leak") return "emergency";
  if (damageType === "electrical") return "electrical";
  if (combined.includes("crime") || combined.includes("robbery") || combined.includes("assault")) return "crime";
  if (combined.includes("fire") || combined.includes("smoke")) return "fire";
  if (combined.includes("hospital") || combined.includes("injury") || combined.includes("casualty")) return "health";

  return "general";
}

function authorityTypeMatches(authorityType: string, issueCategory: string): boolean {
  const map: Record<string, string[]> = {
    roads: ["road", "bridge", "drainage", "structural"],
    police: ["crime", "security", "violence"],
    fire: ["fire", "electrical", "explosion"],
    hospital: ["health", "injury", "casualty"],
    emergency: ["emergency", "flooding", "disaster", "electrical"],
    county_office: ["general", "public", "structural", "flooding"],
    utility: ["electrical", "water", "sewage", "leak"],
    general: ["general"],
  };

  return (map[authorityType] || []).includes(issueCategory);
}

function getLocationHints(address?: string | null): { county: string | null; subcounty: string | null } {
  if (!address) return { county: null, subcounty: null };
  const normalized = address.toLowerCase();

  const counties = [
    "nairobi",
    "mombasa",
    "kisumu",
    "nakuru",
    "kiambu",
    "machakos",
    "kajiado",
    "uasin gishu",
    "nyeri",
    "meru",
  ];

  const county = counties.find((item) => normalized.includes(item)) || null;

  const subcounties = [
    "starehe",
    "westlands",
    "kibra",
    "langata",
    "kasarani",
    "embakasi",
    "dagoretti",
    "kamukunji",
  ];

  const subcounty = subcounties.find((item) => normalized.includes(item)) || null;

  return { county, subcounty };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const {
      reportId,
      latitude,
      longitude,
      issueCategory,
      severity,
      damageType,
      title,
      description,
      address,
    } = body;

    let report: ReportRecord | null = null;
    if (reportId) {
      const { data, error } = await supabase
        .from("reports")
        .select("id, title, description, damage_type, severity, latitude, longitude, address, reporter_name")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      report = data as ReportRecord;
    }

    const lat = Number(report?.latitude ?? latitude);
    const lng = Number(report?.longitude ?? longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return new Response(JSON.stringify({ error: "Latitude and longitude are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const derivedIssueCategory = inferIssueCategory({
      issueCategory,
      damageType: report?.damage_type ?? damageType,
      title: report?.title ?? title,
      description: report?.description ?? description,
    });
    const derivedSeverity = normalize(report?.severity ?? severity) || "medium";
    const locationHints = getLocationHints(report?.address ?? address);

    const [{ data: authorities, error: authoritiesError }, { data: jurisdictions, error: jurisdictionsError }] =
      await Promise.all([
        supabase
          .from("authority_directory")
          .select("id, name, authority_type, county, subcounty, latitude, longitude, contact_email, contact_phone, webhook_url, priority, is_active, metadata")
          .eq("is_active", true),
        supabase
          .from("authority_jurisdictions")
          .select("authority_id, county, subcounty, issue_categories, coverage_mode, center_latitude, center_longitude, radius_km"),
      ]);

    if (authoritiesError) throw authoritiesError;
    if (jurisdictionsError) throw jurisdictionsError;

    const jurisdictionMap = new Map<string, Jurisdiction[]>();
    for (const jurisdiction of (jurisdictions || []) as Jurisdiction[]) {
      const existing = jurisdictionMap.get(jurisdiction.authority_id) || [];
      existing.push(jurisdiction);
      jurisdictionMap.set(jurisdiction.authority_id, existing);
    }

    const candidates = ((authorities || []) as Authority[])
      .map((authority) => {
        const attachedJurisdictions = jurisdictionMap.get(authority.id) || [];

        let jurisdictionScore = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const jurisdiction of attachedJurisdictions) {
          const issueMatch =
            !jurisdiction.issue_categories?.length ||
            jurisdiction.issue_categories.includes(derivedIssueCategory);
          if (!issueMatch) continue;

          const countyMatch =
            !jurisdiction.county ||
            normalize(jurisdiction.county) === normalize(locationHints.county) ||
            normalize(jurisdiction.county) === "national";
          const subcountyMatch =
            !jurisdiction.subcounty ||
            normalize(jurisdiction.subcounty) === normalize(locationHints.subcounty);

          let withinCoverage = true;
          if (
            jurisdiction.coverage_mode === "radius" &&
            jurisdiction.center_latitude !== null &&
            jurisdiction.center_longitude !== null
          ) {
            const distance = haversineKm(
              lat,
              lng,
              jurisdiction.center_latitude,
              jurisdiction.center_longitude,
            );
            bestDistance = Math.min(bestDistance, distance);
            withinCoverage = distance <= Number(jurisdiction.radius_km || 0);
          }

          if (!withinCoverage) continue;

          jurisdictionScore += issueMatch ? 40 : 0;
          jurisdictionScore += countyMatch ? 25 : 0;
          jurisdictionScore += subcountyMatch ? 15 : 0;
          jurisdictionScore += jurisdiction.coverage_mode === "national" ? 10 : 0;
        }

        const typeScore = authorityTypeMatches(authority.authority_type, derivedIssueCategory) ? 30 : 0;
        const directDistance =
          authority.latitude !== null && authority.longitude !== null
            ? haversineKm(lat, lng, authority.latitude, authority.longitude)
            : bestDistance;
        const distanceScore =
          Number.isFinite(directDistance) ? Math.max(0, 30 - Math.min(30, directDistance)) : 0;
        const severityBoost = ["critical", "high"].includes(derivedSeverity) ? 10 : 0;

        return {
          authority,
          distanceKm: Number.isFinite(directDistance) ? Number(directDistance.toFixed(3)) : null,
          totalScore: jurisdictionScore + typeScore + distanceScore + authority.priority + severityBoost,
        };
      })
      .filter((item) => item.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore);

    const selected = candidates[0];
    if (!selected) {
      return new Response(
        JSON.stringify({
          matched: false,
          issueCategory: derivedIssueCategory,
          message: "No active authority matched the report coordinates and category.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let routingEventId: string | null = null;
    if (report?.id) {
      const { data: routingEvent, error: routingError } = await supabase
        .from("report_routing_events")
        .insert({
          report_id: report.id,
          authority_id: selected.authority.id,
          issue_category: derivedIssueCategory,
          route_reason: `Matched by category ${derivedIssueCategory}, severity ${derivedSeverity}, and nearest jurisdiction score`,
          distance_km: selected.distanceKm,
          status: "matched",
          payload: {
            severity: derivedSeverity,
            routing_score: selected.totalScore,
            county: locationHints.county,
            subcounty: locationHints.subcounty,
          },
        })
        .select("id")
        .single();

      if (routingError) throw routingError;
      routingEventId = routingEvent.id;

      await supabase
        .from("reports")
        .update({
          routing_category: derivedIssueCategory,
          routing_status: "routed",
          routed_authority_id: selected.authority.id,
        })
        .eq("id", report.id);

      const subject = `[CiviGuard] ${derivedIssueCategory.toUpperCase()} report routed`;
      const messageBody = [
        `Authority: ${selected.authority.name}`,
        `Report: ${report.title}`,
        `Severity: ${derivedSeverity}`,
        `Location: ${report.address || `${lat}, ${lng}`}`,
        `Description: ${report.description}`,
        `Reporter: ${report.reporter_name || "Anonymous citizen"}`,
      ].join("\n");

      await supabase.from("authority_notifications").insert({
        report_id: report.id,
        authority_id: selected.authority.id,
        routing_event_id: routingEventId,
        channel: selected.authority.webhook_url ? "webhook" : selected.authority.contact_email ? "email" : "manual",
        delivery_status: "queued",
        message_subject: subject,
        message_body: messageBody,
        provider_response: {
          queued: true,
          destination: selected.authority.webhook_url || selected.authority.contact_email || selected.authority.contact_phone,
        },
      });
    }

    return new Response(
      JSON.stringify({
        matched: true,
        issueCategory: derivedIssueCategory,
        severity: derivedSeverity,
        authority: selected.authority,
        routingEventId,
        distanceKm: selected.distanceKm,
        routingScore: selected.totalScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("route-authority error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
