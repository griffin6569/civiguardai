const KENYA_NEWS_SOURCE_ALLOWLIST = [
  "daily nation",
  "nation africa",
  "the standard",
  "standard",
  "citizen digital",
  "citizen tv",
  "kbc",
  "kenya broadcasting corporation",
  "the star",
  "business daily",
  "taifa leo",
  "people daily",
  "mygov",
  "capital fm",
];

export function isWithinKenyaBounds(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -5.5 &&
    latitude <= 5.5 &&
    longitude >= 33 &&
    longitude <= 42.5;
}

export function filterTrustedAssets<T extends {
  latitude?: number | null;
  longitude?: number | null;
  source_system?: string | null;
  external_id?: string | null;
}>(assets: T[]): T[] {
  return assets.filter((asset) =>
    isWithinKenyaBounds(asset.latitude, asset.longitude) &&
    (
      (typeof asset.source_system === "string" && asset.source_system.trim().toLowerCase() !== "manual") ||
      (typeof asset.external_id === "string" && asset.external_id.trim().length > 0)
    )
  );
}

export function filterTrustedReports<T extends {
  latitude?: number | null;
  longitude?: number | null;
}>(reports: T[]): T[] {
  return reports.filter((report) => isWithinKenyaBounds(report.latitude, report.longitude));
}

export function filterTrustedAlerts<T extends {
  asset_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}>(alerts: T[], trustedAssetIds: Set<string>): T[] {
  return alerts.filter((alert) =>
    (typeof alert.asset_id === "string" && trustedAssetIds.has(alert.asset_id)) ||
    isWithinKenyaBounds(alert.latitude, alert.longitude)
  );
}

export function isTrustedKenyanNewsSource(source: string | null | undefined): boolean {
  const normalized = String(source || "").trim().toLowerCase();
  return KENYA_NEWS_SOURCE_ALLOWLIST.some((allowed) => normalized.includes(allowed));
}
