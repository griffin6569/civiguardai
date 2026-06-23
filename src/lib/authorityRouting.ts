export type AuthorityRouteInput = {
  damage_type?: string | null;
  severity?: string | null;
  address?: string | null;
  title?: string | null;
  description?: string | null;
};

export type AuthorityRoute = {
  name: string;
  role: string;
  priority: "primary" | "copy" | "emergency";
};

const countyRoute: AuthorityRoute = {
  name: "County Government public works desk",
  role: "Default receiver for local roads, drainage, water, building, and public safety follow-up in the report location.",
  priority: "primary",
};

export function getAuthorityRoutes(report: AuthorityRouteInput): AuthorityRoute[] {
  const damageType = String(report.damage_type || "other").toLowerCase();
  const severity = String(report.severity || "unknown").toLowerCase();
  const text = [
    report.title,
    report.description,
    report.address,
  ].filter(Boolean).join(" ").toLowerCase();

  const routes: AuthorityRoute[] = [countyRoute];

  if (["pothole", "crack"].includes(damageType)) {
    routes.push(getRoadAuthority(text));
  }

  if (damageType === "flooding") {
    routes.push(
      {
        name: "County Disaster Management Unit",
        role: "Coordinate flood response, public warnings, evacuations, and urgent safety action.",
        priority: severity === "critical" || severity === "high" ? "emergency" : "copy",
      },
      {
        name: "County Roads and Drainage Department",
        role: "Inspect blocked drainage, damaged culverts, and road flooding linked to county infrastructure.",
        priority: "primary",
      },
    );
  }

  if (damageType === "leak") {
    routes.push({
      name: "Local Water Service Provider",
      role: "Handle burst pipes, sewer leaks, water loss, and sanitation risks in the service area.",
      priority: "primary",
    });
  }

  if (damageType === "electrical") {
    routes.push(
      {
        name: "Kenya Power emergency support",
        role: "Handle exposed wires, fallen poles, transformer risks, outages, and electricity supply hazards.",
        priority: "emergency",
      },
      {
        name: "Energy and Petroleum Regulatory Authority",
        role: "Regulatory escalation when the report points to electricity safety or service-standard failures.",
        priority: "copy",
      },
    );
  }

  if (damageType === "structural") {
    routes.push(
      {
        name: "County Building Control / Physical Planning",
        role: "Inspect unsafe buildings, walls, bridges, construction risks, and structural public hazards.",
        priority: "primary",
      },
      {
        name: "National Construction Authority",
        role: "Escalation path where unsafe construction work or contractor compliance may be involved.",
        priority: "copy",
      },
    );
  }

  if (severity === "critical") {
    routes.push({
      name: "National Disaster Operations Centre",
      role: "Escalate life-threatening, multi-agency, or major public safety incidents.",
      priority: "emergency",
    });
  }

  return dedupeRoutes(routes);
}

export function summarizeAuthorityRoutes(routes: AuthorityRoute[]): string {
  const primary = routes.find((route) => route.priority === "primary") || routes[0];
  const emergencyCount = routes.filter((route) => route.priority === "emergency").length;
  return emergencyCount > 0
    ? `${primary.name}, plus ${emergencyCount} emergency escalation${emergencyCount > 1 ? "s" : ""}`
    : primary.name;
}

function getRoadAuthority(text: string): AuthorityRoute {
  if (/\b(a\d+|b\d+|highway|bypass|mombasa road|thika road|waiyaki way|uhuru highway|nairobi expressway)\b/.test(text)) {
    return {
      name: "Kenya National Highways Authority",
      role: "Manage national highways and major trunk roads.",
      priority: "primary",
    };
  }

  if (/\b(town|city|estate|avenue|street|urban|cbd|municipality|market)\b/.test(text)) {
    return {
      name: "Kenya Urban Roads Authority",
      role: "Manage national urban roads and mobility corridors in towns and cities.",
      priority: "primary",
    };
  }

  if (/\b(village|rural|murram|feeder|ward|sub-county|farm|market road)\b/.test(text)) {
    return {
      name: "Kenya Rural Roads Authority",
      role: "Manage rural and secondary trunk roads through county regional offices.",
      priority: "primary",
    };
  }

  return {
    name: "County Roads Department",
    role: "Triage local road reports and forward national road issues to KeNHA, KURA, or KeRRA where needed.",
    priority: "primary",
  };
}

function dedupeRoutes(routes: AuthorityRoute[]): AuthorityRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = route.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
