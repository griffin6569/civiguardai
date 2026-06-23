import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle, Loader2, XCircle, Eye, MapPin, Navigation, Search, Share2, ThumbsUp, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import AuthorityRoutingCard from "@/components/AuthorityRoutingCard";
import { useToast } from "@/hooks/use-toast";
import { getReportReference, getUrgencyLabel, kenyanCounties, statusDescriptions } from "@/lib/reportUX";

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  submitted: { icon: Clock, color: "text-primary", label: "Submitted" },
  reviewing: { icon: Eye, color: "text-warning", label: "Under Review" },
  in_progress: { icon: Loader2, color: "text-warning", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "text-safe", label: "Resolved" },
  dismissed: { icon: XCircle, color: "text-muted-foreground", label: "Dismissed" },
};

const severityColors: Record<string, string> = {
  low: "bg-safe/20 text-safe",
  medium: "bg-warning/20 text-warning",
  high: "bg-destructive/20 text-destructive",
  critical: "bg-critical/20 text-critical",
  unknown: "bg-muted text-muted-foreground",
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 500;

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ReportsListPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [countyFilter, setCountyFilter] = useState("All Counties");
  const [locationMode, setLocationMode] = useState<"all" | "nearby">("all");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"detecting" | "ready" | "unavailable">("detecting");
  const [confirmedReports, setConfirmedReports] = useState<string[]>([]);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("ready");
      },
      () => setLocationStatus("unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  useEffect(() => {
    detectLocation();
    setConfirmedReports(JSON.parse(localStorage.getItem("civiguard-confirmed-reports") || "[]"));
  }, []);

  const confirmReport = (reportId: string) => {
    if (confirmedReports.includes(reportId)) return;
    const next = [...confirmedReports, reportId];
    setConfirmedReports(next);
    localStorage.setItem("civiguard-confirmed-reports", JSON.stringify(next));
    toast({ title: "Confirmation saved", description: "Your confirmation strengthens this public evidence on this device." });
  };

  const shareReport = async (report: any) => {
    const reference = getReportReference(report);
    const url = `${window.location.origin}/reports?report=${report.id}`;
    const text = `${reference}: ${report.title} - ${report.address || "Kenya"} (${report.status || "submitted"}) ${url}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: reference, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Report link copied" });
      }
    } catch {
      toast({ title: "Could not share report", variant: "destructive" });
    }
  };

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (reports ?? [])
      .map((report) => {
        const hasCoordinates = typeof report.latitude === "number" && typeof report.longitude === "number";
        const distanceKm = userLocation && hasCoordinates
          ? haversineKm(userLocation.latitude, userLocation.longitude, report.latitude, report.longitude)
          : null;

        return { ...report, distanceKm };
      })
      .filter((report) => {
        if (filter !== "all" && report.status !== filter) return false;
        if (countyFilter !== "All Counties" && !report.address?.toLowerCase().includes(countyFilter.toLowerCase())) return false;

        if (normalizedSearch) {
          const searchable = [
            report.title,
            report.description,
            report.damage_type,
            report.severity,
            report.status,
            report.address,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!searchable.includes(normalizedSearch)) return false;
        }

        if (locationMode === "nearby" && userLocation && radiusKm < MAX_RADIUS_KM) {
          return typeof report.distanceKm === "number" && report.distanceKm <= radiusKm;
        }

        return true;
      })
      .sort((a, b) => {
        if (locationMode === "nearby" && typeof a.distanceKm === "number" && typeof b.distanceKm === "number") {
          return a.distanceKm - b.distanceKm;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [reports, filter, search, countyFilter, locationMode, radiusKm, userLocation]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 pt-20 md:pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <h1 className="text-3xl font-heading font-bold">Reports Tracker</h1>
            <button onClick={() => navigate("/report")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-heading font-medium text-sm hover:brightness-110 transition-all">
              + New Report
            </button>
          </div>

          <div className="rounded-xl border border-glow bg-card/50 p-4 mb-6 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reports by issue, location, severity, or status"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </label>

              <select
                value={countyFilter}
                onChange={(event) => setCountyFilter(event.target.value)}
                className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
              >
                {kenyanCounties.map((county) => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>

              <div className="flex gap-2 flex-wrap">
                {["all", "submitted", "reviewing", "in_progress", "resolved"].map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-sm font-body capitalize transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                    {f === "all" ? "All" : f.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "all" as const, label: "All reports" },
                { key: "nearby" as const, label: "Near my location" },
              ].map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => {
                    setLocationMode(mode.key);
                    if (mode.key === "nearby" && !userLocation) {
                      detectLocation();
                    }
                  }}
                  disabled={mode.key === "nearby" && locationStatus === "detecting"}
                  className={`px-3 py-2 rounded-lg text-sm font-body transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    locationMode === mode.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {mode.key === "nearby" && locationStatus === "detecting" ? "Detecting location..." : mode.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label htmlFor="report-radius" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Narrow radius
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {locationMode === "all"
                      ? "Showing every report"
                      : radiusKm >= MAX_RADIUS_KM
                      ? "All Kenya reports"
                      : `${radiusKm} km`}
                  </span>
                </div>
                <input
                  id="report-radius"
                  type="range"
                  min={5}
                  max={MAX_RADIUS_KM}
                  step={5}
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  className="w-full accent-primary"
                  disabled={locationMode === "all" || !userLocation}
                />
              </div>

              <div className="text-xs text-muted-foreground lg:text-right">
                {locationStatus === "detecting" && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" /> Detecting your location...
                  </span>
                )}
                {locationStatus === "ready" && (
                  <span className="inline-flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-primary" />
                    {locationMode === "nearby" ? "Converging reports around your location" : "Location ready for narrowing"}
                  </span>
                )}
                {locationStatus === "unavailable" && (
                  <span>Location unavailable. Showing all reports; search and status filters still work.</span>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>No reports match the current search or location filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const status = statusConfig[report.status] || statusConfig.submitted;
                const StatusIcon = status.icon;
                return (
                  <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-glow bg-card/50 p-5 hover:bg-card/80 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {report.image_url && (
                        <img src={report.image_url} alt="Report evidence" className="w-full h-48 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <h3 className="font-heading font-semibold text-foreground">{report.title}</h3>
                          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {getReportReference(report)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[report.severity || "unknown"]}`}>
                              {getUrgencyLabel(report.severity)}
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {statusDescriptions[report.status || "submitted"] || "Status update pending"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="capitalize">{report.damage_type}</span>
                          {report.address && <span>{report.address}</span>}
                          {typeof report.distanceKm === "number" && <span>{report.distanceKm.toFixed(1)} km away</span>}
                          <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-3">
                          <AuthorityRoutingCard report={report} compact />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => confirmReport(report.id)}
                            disabled={confirmedReports.includes(report.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-60 flex items-center gap-1"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            {confirmedReports.includes(report.id) ? "Confirmed by you" : "I also saw this"}
                          </button>
                          <button
                            onClick={() => shareReport(report)}
                            className="px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 flex items-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                          <button
                            onClick={() => navigate(`/report?related=${report.id}`)}
                            className="px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 flex items-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> Add more evidence
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ReportsListPage;
