export const kenyanCounties = [
  "All Counties", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Kajiado",
  "Uasin Gishu", "Nyeri", "Meru", "Kilifi", "Kwale", "Garissa", "Turkana", "Mandera",
  "Wajir", "Marsabit", "Isiolo", "Tana River", "Lamu", "Taita Taveta", "Embu", "Tharaka Nithi",
  "Kitui", "Makueni", "Nyandarua", "Laikipia", "Samburu", "Trans Nzoia", "West Pokot",
  "Baringo", "Elgeyo Marakwet", "Nandi", "Bomet", "Kericho", "Kakamega", "Vihiga",
  "Bungoma", "Busia", "Siaya", "Homa Bay", "Migori", "Kisii", "Nyamira", "Narok", "Kirinyaga", "Murang'a",
];

export const statusDescriptions: Record<string, string> = {
  submitted: "Waiting for review",
  pending: "Waiting for review",
  reviewing: "Being checked",
  verified: "Accepted as public evidence",
  assigned: "Sent for action",
  in_progress: "Work or follow-up is underway",
  resolved: "Marked fixed",
  citizen_confirmed: "Confirmed by citizens",
  rejected: "Not accepted as valid evidence",
  dismissed: "Closed without action",
};

export const getReportReference = (report: { id?: string | null; created_at?: string | null }) => {
  const year = report.created_at ? new Date(report.created_at).getFullYear() : new Date().getFullYear();
  const suffix = String(report.id || "pending").replace(/-/g, "").slice(0, 6).toUpperCase();
  return `CG-${year}-${suffix}`;
};

export const getUrgencyLabel = (severity?: string | null) => {
  const normalized = String(severity || "unknown").toLowerCase();
  if (normalized === "critical") return "Critical urgency";
  if (normalized === "high") return "High urgency";
  if (normalized === "medium") return "Medium urgency";
  if (normalized === "low") return "Low urgency";
  return "Needs review";
};
