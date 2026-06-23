import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const KENYA_BOUNDS = {
  minLat: -5.5,
  maxLat: 5.5,
  minLng: 33,
  maxLng: 42.5,
};

const statusConfig = {
  critical: { color: "bg-critical", ring: "ring-critical/30", icon: XCircle, pulse: true, label: "Critical" },
  warning: { color: "bg-warning", ring: "ring-warning/30", icon: AlertTriangle, pulse: false, label: "Warning" },
  safe: { color: "bg-safe", ring: "ring-safe/30", icon: CheckCircle, pulse: false, label: "Low risk" },
} as const;

type PreviewPoint = {
  id: string;
  x: number;
  y: number;
  status: keyof typeof statusConfig;
  label: string;
  createdAt: string;
};

function isWithinKenyaBounds(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= KENYA_BOUNDS.minLat &&
    latitude <= KENYA_BOUNDS.maxLat &&
    longitude >= KENYA_BOUNDS.minLng &&
    longitude <= KENYA_BOUNDS.maxLng;
}

function toPreviewPosition(latitude: number, longitude: number) {
  const x = ((longitude - KENYA_BOUNDS.minLng) / (KENYA_BOUNDS.maxLng - KENYA_BOUNDS.minLng)) * 100;
  const y = 100 - (((latitude - KENYA_BOUNDS.minLat) / (KENYA_BOUNDS.maxLat - KENYA_BOUNDS.minLat)) * 100);

  return {
    x: Math.min(92, Math.max(8, x)),
    y: Math.min(84, Math.max(16, y)),
  };
}

function mapReportSeverity(severity?: string | null) {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  return "safe";
}

const InfraMap = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["landing-map-preview"],
    queryFn: async () => {
      const { data: reports, error } = await supabase
        .from("reports")
        .select("id, title, latitude, longitude, severity, status, created_at")
        .order("created_at", { ascending: false })
        .limit(24);

      if (error) throw error;

      return reports ?? [];
    },
    staleTime: 60_000,
  });

  const preview = useMemo(() => {
    const liveReports = (data ?? [])
      .filter((report) => isWithinKenyaBounds(report.latitude, report.longitude))
      .map((report) => {
        const { x, y } = toPreviewPosition(report.latitude, report.longitude);
        return {
          id: `report-${report.id}`,
          x,
          y,
          status: mapReportSeverity(report.severity),
          label: report.title,
          createdAt: report.created_at,
        } satisfies PreviewPoint;
      });

    return {
      points: liveReports.slice(0, 12),
      reportCount: liveReports.length,
      newestDate: liveReports[0]?.createdAt?.split("T")[0] || null,
    };
  }, [data]);

  return (
    <section className="relative py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="text-2xl md:text-5xl font-heading font-bold mb-3 md:mb-4">
            Citizen Evidence <span className="text-primary">Map</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            Live Kenya preview powered only by citizen-submitted evidence reports.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto rounded-2xl border border-glow bg-card/30 backdrop-blur-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-body">
                Live citizen reports only
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              {(["safe", "warning", "critical"] as const).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${statusConfig[status].color}`} />
                  <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                    {statusConfig[status].label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative aspect-[16/9] grid-bg">
            <div className="absolute inset-0 gradient-radial" />

            <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-background/80 border border-border text-[10px] md:text-xs text-foreground">
                Verified citizen evidence
              </span>
              <span className="px-2.5 py-1 rounded-full bg-background/60 border border-border text-[10px] md:text-xs text-muted-foreground">
                Reports: {preview.reportCount}
              </span>
              {preview.newestDate && (
                <span className="px-2.5 py-1 rounded-full bg-background/60 border border-border text-[10px] md:text-xs text-muted-foreground">
                  Newest: {preview.newestDate}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Loading report activity...
                </div>
              </div>
            ) : preview.points.length > 0 ? (
              preview.points.map((point, index) => {
                const config = statusConfig[point.status];
                return (
                  <motion.div
                    key={point.id}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.08 }}
                    className="absolute group"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  >
                    <div className="relative -translate-x-1/2 -translate-y-1/2">
                      {config.pulse && (
                        <span className={`absolute inset-0 w-3 h-3 md:w-4 md:h-4 rounded-full ${config.color} opacity-40 animate-ping`} />
                      )}
                      <span className={`relative block w-3 h-3 md:w-4 md:h-4 rounded-full ${config.color} ring-4 ${config.ring} cursor-pointer`} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[160px] max-w-[240px] px-2 py-1 rounded bg-card border border-border text-[10px] md:text-xs text-foreground text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="font-medium">{point.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Citizen report • {new Date(point.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="max-w-md text-center rounded-2xl border border-border bg-background/70 backdrop-blur-sm p-6">
                  <MapPin className="w-7 h-7 text-primary mx-auto mb-3" />
                  <h3 className="font-heading font-semibold text-foreground mb-2">
                    Waiting For Citizen Evidence
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    There are no Kenya-located citizen reports to preview yet. This map updates automatically as new evidence is submitted.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default InfraMap;
