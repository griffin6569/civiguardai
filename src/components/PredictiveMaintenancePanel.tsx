import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingDown, TrendingUp, Minus, AlertTriangle, Wrench, Calendar,
  Activity, Clock, DollarSign, BarChart3, ShieldAlert
} from "lucide-react";

interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  health_score: number;
  last_inspection: string | null;
  created_at: string;
  updated_at: string;
  source_system: string | null;
  data_confidence: number | null;
}

interface MaintenanceLog {
  id: string;
  asset_id: string;
  type: string;
  performed_at: string | null;
  cost: number | null;
  description: string | null;
  next_scheduled: string | null;
}

interface Report {
  id: string;
  asset_id: string | null;
  damage_type: string;
  severity: string | null;
  status: string;
  created_at: string;
  latitude: number;
  longitude: number;
}

interface PredictiveInsight {
  assetId: string;
  assetName: string;
  assetType: string;
  healthScore: number;
  deteriorationRate: number; // per month
  projectedFailureMonths: number | null;
  riskLevel: "critical" | "high" | "medium" | "low";
  nearbyReports: number;
  maintenanceCost: number;
  lastInspection: string | null;
  nextScheduled: string | null;
  recommendation: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computePredictions(
  assets: Asset[],
  logs: MaintenanceLog[],
  reports: Report[]
): PredictiveInsight[] {
  return assets.map((asset) => {
    const assetLogs = logs.filter((l) => l.asset_id === asset.id);
    const totalCost = assetLogs.reduce((s, l) => s + (l.cost || 0), 0);
    const nextScheduled = assetLogs.find((l) => l.next_scheduled)?.next_scheduled || null;

    // Nearby reports within 1km
    const nearbyReports = reports.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      return haversineKm(r.latitude, r.longitude, (asset as any).latitude, (asset as any).longitude) <= 1;
    });

    // Deterioration rate estimate: health loss per month based on age
    const ageMonths = Math.max(1, (Date.now() - new Date(asset.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30));
    const healthLoss = 100 - asset.health_score;
    const deteriorationRate = Math.round((healthLoss / ageMonths) * 10) / 10;

    // Projected months until failure (health < 20)
    const projectedFailureMonths = deteriorationRate > 0
      ? Math.max(0, Math.round((asset.health_score - 20) / deteriorationRate))
      : null;

    // Risk level
    let riskLevel: PredictiveInsight["riskLevel"] = "low";
    if (asset.health_score < 30 || (projectedFailureMonths !== null && projectedFailureMonths < 3)) riskLevel = "critical";
    else if (asset.health_score < 50 || (projectedFailureMonths !== null && projectedFailureMonths < 6)) riskLevel = "high";
    else if (asset.health_score < 70 || nearbyReports.length >= 3) riskLevel = "medium";

    // Recommendation
    let recommendation = "Continue routine monitoring";
    if (riskLevel === "critical") recommendation = "Immediate inspection and emergency repair needed";
    else if (riskLevel === "high") recommendation = "Schedule priority maintenance within 30 days";
    else if (riskLevel === "medium") recommendation = "Plan preventive maintenance in next quarter";

    return {
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      healthScore: asset.health_score,
      deteriorationRate,
      projectedFailureMonths,
      riskLevel,
      nearbyReports: nearbyReports.length,
      maintenanceCost: totalCost,
      lastInspection: asset.last_inspection,
      nextScheduled,
      recommendation,
    };
  }).sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || a.healthScore - b.healthScore;
  });
}

const riskColors: Record<string, string> = {
  critical: "bg-critical/20 text-critical border-critical/30",
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-safe/20 text-safe border-safe/30",
};

const PredictiveMaintenancePanel = ({
  assets,
  maintenanceLogs,
  reports,
}: {
  assets: Asset[];
  maintenanceLogs: MaintenanceLog[];
  reports: Report[];
}) => {
  const predictions = useMemo(
    () => computePredictions(assets, maintenanceLogs, reports),
    [assets, maintenanceLogs, reports]
  );

  const criticalCount = predictions.filter((p) => p.riskLevel === "critical").length;
  const highCount = predictions.filter((p) => p.riskLevel === "high").length;
  const avgDeterior = predictions.length
    ? Math.round((predictions.reduce((s, p) => s + p.deteriorationRate, 0) / predictions.length) * 10) / 10
    : 0;
  const totalMaintCost = predictions.reduce((s, p) => s + p.maintenanceCost, 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
          <div className="text-lg font-heading font-bold text-critical">{criticalCount}</div>
          <div className="text-[9px] text-muted-foreground">Critical Risk</div>
        </div>
        <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
          <div className="text-lg font-heading font-bold text-destructive">{highCount}</div>
          <div className="text-[9px] text-muted-foreground">High Risk</div>
        </div>
        <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
          <div className="text-lg font-heading font-bold text-warning">{avgDeterior}/mo</div>
          <div className="text-[9px] text-muted-foreground">Avg Deterioration</div>
        </div>
        <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
          <div className="text-lg font-heading font-bold text-foreground">KES {(totalMaintCost / 1000).toFixed(0)}K</div>
          <div className="text-[9px] text-muted-foreground">Total Maint. Cost</div>
        </div>
      </div>

      {/* Predictions list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {predictions.slice(0, 20).map((pred, i) => (
          <motion.div
            key={pred.assetId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`p-3 rounded-lg bg-background/60 border ${pred.riskLevel === "critical" ? "border-critical/30" : "border-border"}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h4 className="text-xs md:text-sm font-heading font-semibold text-foreground truncate">{pred.assetName}</h4>
                <p className="text-[10px] text-muted-foreground capitalize">{pred.assetType}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase shrink-0 ${riskColors[pred.riskLevel]}`}>
                {pred.riskLevel}
              </span>
            </div>

            {/* Health bar */}
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${pred.healthScore >= 70 ? "bg-safe" : pred.healthScore >= 40 ? "bg-warning" : "bg-critical"}`}
                  style={{ width: `${pred.healthScore}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{pred.healthScore}%</span>
            </div>

            {/* Metrics row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                {pred.deteriorationRate > 2 ? <TrendingDown className="w-3 h-3 text-critical" /> : pred.deteriorationRate > 0.5 ? <Minus className="w-3 h-3 text-warning" /> : <TrendingUp className="w-3 h-3 text-safe" />}
                {pred.deteriorationRate} pts/mo
              </span>
              {pred.projectedFailureMonths !== null && (
                <span className={`flex items-center gap-0.5 ${pred.projectedFailureMonths < 6 ? "text-critical font-medium" : ""}`}>
                  <ShieldAlert className="w-3 h-3" />
                  {pred.projectedFailureMonths < 1 ? "Imminent failure" : `~${pred.projectedFailureMonths}mo to failure`}
                </span>
              )}
              {pred.nearbyReports > 0 && (
                <span className="flex items-center gap-0.5 text-primary">
                  <AlertTriangle className="w-3 h-3" />
                  {pred.nearbyReports} reports nearby
                </span>
              )}
              {pred.lastInspection && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  Inspected {new Date(pred.lastInspection).toLocaleDateString()}
                </span>
              )}
              {pred.maintenanceCost > 0 && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3" />
                  KES {(pred.maintenanceCost / 1000).toFixed(0)}K spent
                </span>
              )}
            </div>

            {/* Recommendation */}
            <p className="text-[10px] mt-2 p-1.5 rounded bg-primary/5 border border-primary/10 text-foreground">
              <Wrench className="w-3 h-3 inline mr-1 text-primary" />
              {pred.recommendation}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PredictiveMaintenancePanel;
