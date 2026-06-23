import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Award,
  Brain,
  Camera,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  Loader2,
  LogOut,
  MapPin,
  Minus,
  Newspaper,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  ThumbsUp,
  UserCheck,
  Users,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReportLifecycle from "@/components/ReportLifecycle";
import AdminUserRolesPanel from "@/components/AdminUserRolesPanel";
import AuthorityRoutingCard from "@/components/AuthorityRoutingCard";

const categoryLabels: Record<string, string> = {
  pothole: "Roads / Potholes",
  crack: "Cracks / Structural",
  leak: "Water / Sewage",
  flooding: "Flooding / Drainage",
  structural: "Buildings / Structural",
  electrical: "Electrical / Power",
  other: "Other",
};

const kenyanCounties = [
  "All Counties", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Kajiado",
  "Uasin Gishu", "Nyeri", "Meru", "Kilifi", "Kwale", "Garissa", "Turkana", "Mandera",
  "Wajir", "Marsabit", "Isiolo", "Tana River", "Lamu", "Taita Taveta", "Embu", "Tharaka Nithi",
  "Kitui", "Makueni", "Nyandarua", "Laikipia", "Samburu", "Trans Nzoia", "West Pokot",
  "Baringo", "Elgeyo Marakwet", "Nandi", "Bomet", "Kericho", "Kakamega", "Vihiga",
  "Bungoma", "Busia", "Siaya", "Homa Bay", "Migori", "Kisii", "Nyamira", "Narok", "Kirinyaga", "Murang'a",
];

const reportCategories = [
  { value: "all", label: "All Categories" },
  { value: "pothole", label: "Roads / Potholes" },
  { value: "crack", label: "Cracks / Structural" },
  { value: "leak", label: "Water / Sewage" },
  { value: "flooding", label: "Flooding / Drainage" },
  { value: "structural", label: "Buildings / Structural" },
  { value: "electrical", label: "Electrical / Power" },
  { value: "other", label: "Other" },
];

const reportStatusOptions = [
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Reviewing" },
  { value: "verified", label: "Verified" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
  { value: "dismissed", label: "Dismissed" },
];

const getConfidenceColor = (confidence: number) =>
  confidence >= 75 ? "bg-safe/20 text-safe" :
  confidence >= 50 ? "bg-warning/20 text-warning" :
  "bg-critical/20 text-critical";

const formatConfidence = (confidence: unknown) => {
  const value = Number(confidence);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
};

interface HotspotCluster {
  id: string;
  centerLat: number;
  centerLng: number;
  reports: any[];
  uniqueReporters: number;
  priorityScore: number;
  urgencyTier: "critical" | "high" | "medium" | "low";
  topCategory: string;
  topLocation: string;
  estResolutionDays: number;
  isAutoEscalated: boolean;
}

const CLUSTER_RADIUS_KM = 0.5;
const SEVERITY_WEIGHTS: Record<string, number> = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25, unknown: 0.3 };

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterReports(reports: any[]): HotspotCluster[] {
  if (!reports.length) return [];

  const assigned = new Set<string>();
  const clusters: HotspotCluster[] = [];
  const sorted = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const report of sorted) {
    if (assigned.has(report.id)) continue;

    const cluster = [report];
    assigned.add(report.id);

    for (const other of sorted) {
      if (assigned.has(other.id)) continue;
      if (haversineKm(report.latitude, report.longitude, other.latitude, other.longitude) <= CLUSTER_RADIUS_KM) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    const uniqueReporters = new Set(cluster.map((item) => item.user_id || item.reporter_email || item.id)).size;
    const severityScore = cluster.reduce((sum, item) => sum + (SEVERITY_WEIGHTS[item.severity || "unknown"] || 0.3), 0) / cluster.length;
    const volumeScore = Math.min(1, cluster.length / 10);
    const reporterScore = Math.min(1, uniqueReporters / 5);
    const recencyScore = cluster.reduce((sum, item) => {
      const ageDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.exp(-0.099 * ageDays);
    }, 0) / cluster.length;

    const priorityScore = Math.round((reporterScore * 40) + (recencyScore * 25) + (severityScore * 20) + (volumeScore * 15));
    const urgencyTier = priorityScore >= 75 ? "critical" : priorityScore >= 50 ? "high" : priorityScore >= 25 ? "medium" : "low";
    const topCategory = Object.entries(cluster.reduce((acc: Record<string, number>, item) => {
      const key = String(item.damage_type || "other");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

    const centerLat = cluster.reduce((sum, item) => sum + item.latitude, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, item) => sum + item.longitude, 0) / cluster.length;

    clusters.push({
      id: `cluster-${clusters.length}`,
      centerLat,
      centerLng,
      reports: cluster,
      uniqueReporters,
      priorityScore,
      urgencyTier,
      topCategory,
      topLocation: cluster.find((item) => item.address)?.address || `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`,
      estResolutionDays: urgencyTier === "critical" ? 2 : urgencyTier === "high" ? 7 : urgencyTier === "medium" ? 21 : 45,
      isAutoEscalated: uniqueReporters >= 3,
    });
  }

  return clusters.sort((a, b) => b.priorityScore - a.priorityScore);
}

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("All Counties");
  const [subcountyFilter, setSubcountyFilter] = useState("");
  const [reportTab, setReportTab] = useState<"pending" | "approved" | "all">("pending");
  const [aiTab, setAiTab] = useState<"recommendations" | "predictions" | "risk">("recommendations");
  const [adminTab, setAdminTab] = useState<"approvals" | "hotspots" | "ai" | "leaderboard" | "reports" | "roles">("approvals");

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: aiInsights, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ["admin-ai-predictions-grounded"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-predictions", { body: { type: "admin" } });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ["admin-news", categoryFilter, countyFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        body: {
          category: categoryFilter === "all" ? "" : categoryFilter,
          location: countyFilter === "All Counties" ? "" : countyFilter,
        },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updatePayload: Record<string, any> = { status };
      if (status === "verified") updatePayload.verified_at = new Date().toISOString();
      if (status === "resolved") updatePayload.resolved_at = new Date().toISOString();
      if (status === "citizen_confirmed") updatePayload.citizen_confirmed_at = new Date().toISOString();

      const { error } = await supabase.from("reports").update(updatePayload).eq("id", id);
      if (error) throw error;

      const { data: authUser } = await supabase.auth.getUser();
      await supabase.from("report_status_history").insert({
        report_id: id,
        new_status: status,
        changed_by: authUser.user?.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports-map"] });
      toast({ title: "Report status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Status update failed", description: String(error), variant: "destructive" });
    },
  });

  const filteredReports = useMemo(() => {
    return (reports ?? []).filter((report) => {
      if (categoryFilter !== "all" && report.damage_type !== categoryFilter) return false;
      if (countyFilter !== "All Counties" && !report.address?.toLowerCase().includes(countyFilter.toLowerCase())) return false;
      if (subcountyFilter && !report.address?.toLowerCase().includes(subcountyFilter.toLowerCase())) return false;
      return typeof report.latitude === "number" && typeof report.longitude === "number";
    });
  }, [reports, categoryFilter, countyFilter, subcountyFilter]);

  const tabFilteredReports = useMemo(() => {
    return filteredReports.filter((report) => {
      if (reportTab === "pending") return ["submitted", "pending", "reviewing"].includes(String(report.status || "").toLowerCase());
      if (reportTab === "approved") return ["approved", "verified", "citizen_confirmed", "in_progress", "resolved"].includes(String(report.status || "").toLowerCase());
      return true;
    });
  }, [filteredReports, reportTab]);

  const hotspots = useMemo(() => clusterReports(filteredReports), [filteredReports]);
  const autoEscalated = useMemo(() => hotspots.filter((item) => item.isAutoEscalated), [hotspots]);

  const reporterLeaderboard = useMemo(() => {
    const reporterMap = new Map<string, any[]>();

    (reports ?? []).forEach((report) => {
      const key = report.user_id || report.reporter_email || "anonymous";
      if (!reporterMap.has(key)) reporterMap.set(key, []);
      reporterMap.get(key)?.push(report);
    });

    return Array.from(reporterMap.entries())
      .filter(([key]) => key !== "anonymous")
      .map(([key, reporterReports]) => {
        const approved = reporterReports.filter((item) => ["approved", "verified", "citizen_confirmed", "in_progress", "resolved"].includes(String(item.status || "").toLowerCase())).length;
        const rejected = reporterReports.filter((item) => ["rejected", "dismissed"].includes(String(item.status || "").toLowerCase())).length;
        const approvalRate = reporterReports.length ? Math.round((approved / reporterReports.length) * 100) : 0;
        const credibilityScore = Math.max(0, Math.min(100, approvalRate + Math.min(20, reporterReports.length * 4) - Math.min(25, rejected * 8)));

        return {
          id: key,
          name: reporterReports[0].reporter_name || key.slice(0, 8),
          email: reporterReports[0].reporter_email || "",
          totalReports: reporterReports.length,
          approved,
          rejected,
          approvalRate,
          credibilityScore,
          hotspotContributions: hotspots.filter((hotspot) => hotspot.reports.some((item) => reporterReports.some((candidate) => candidate.id === item.id))).length,
          tier: credibilityScore >= 75 ? "gold" : credibilityScore >= 50 ? "silver" : credibilityScore >= 25 ? "bronze" : "new",
        };
      })
      .sort((a, b) => b.credibilityScore - a.credibilityScore);
  }, [reports, hotspots]);

  const reportsByCategory = filteredReports.reduce((acc: Record<string, any[]>, report) => {
    const key = String(report.damage_type || "other");
    acc[key] = acc[key] || [];
    acc[key].push(report);
    return acc;
  }, {});

  const pendingCount = filteredReports.filter((report) => ["submitted", "pending", "reviewing"].includes(String(report.status || "").toLowerCase())).length;
  const verifiedCount = filteredReports.filter((report) => ["approved", "verified", "citizen_confirmed", "in_progress", "resolved"].includes(String(report.status || "").toLowerCase())).length;

  const getRiskColor = (risk: string) =>
    risk === "critical" ? "bg-critical/20 text-critical" :
    risk === "high" ? "bg-destructive/20 text-destructive" :
    risk === "medium" ? "bg-warning/20 text-warning" :
    "bg-safe/20 text-safe";

  const getTrendIcon = (trend: string) =>
    trend === "worsening"
      ? <XCircle className="w-3 h-3 text-critical" />
      : trend === "improving"
      ? <CheckCircle className="w-3 h-3 text-safe" />
      : <Minus className="w-3 h-3 text-muted-foreground" />;

  const generatePDF = async () => {
    toast({ title: "Generating report PDF..." });
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const criteriaText = `County: ${countyFilter}${subcountyFilter ? ` > ${subcountyFilter}` : ""} | Category: ${categoryFilter === "all" ? "All" : categoryLabels[categoryFilter] || categoryFilter}`;
    const dateStr = new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });

    doc.setFontSize(22);
    doc.text("CiviGuard AI Grounded Evidence Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, 30);
    doc.text(criteriaText, 14, 36);

    autoTable(doc, {
      startY: 46,
      head: [["Metric", "Value"]],
      body: [
        ["Filtered reports", String(filteredReports.length)],
        ["Pending review", String(pendingCount)],
        ["Verified reports", String(verifiedCount)],
        ["Hotspot clusters", String(hotspots.length)],
        ["Auto-escalated hotspots", String(autoEscalated.length)],
        ["Verified news articles", String(newsData?.articles?.length || 0)],
      ],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Title", "Category", "Severity", "Status", "Location", "Date"]],
      body: filteredReports.slice(0, 20).map((report) => [
        report.title || "Untitled",
        categoryLabels[report.damage_type] || report.damage_type || "Other",
        report.severity || "unknown",
        report.status || "unknown",
        report.address || "N/A",
        new Date(report.created_at).toLocaleDateString(),
      ]),
      styles: { fontSize: 8 },
    });

    if (newsData?.articles?.length > 0) {
      doc.addPage();
      doc.setFontSize(18);
      doc.text("Verified Kenya News", 14, 20);
      autoTable(doc, {
        startY: 28,
        head: [["Title", "Source", "Date"]],
        body: newsData.articles.slice(0, 10).map((article: any) => [
          article.title,
          article.source,
          new Date(article.pubDate).toLocaleDateString(),
        ]),
        styles: { fontSize: 8 },
      });
    }

    doc.save(`civiguard-grounded-report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "PDF generated" });
  };

  if (reportsLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-3 md:px-6 pt-20 md:pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl md:text-3xl font-heading font-bold">
                <Shield className="inline w-5 h-5 md:w-8 md:h-8 text-primary mr-2" />
                Admin Command Center
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">
                Grounded in citizen evidence and verified Kenya news only
              </p>
            </div>
            <button onClick={async () => { await signOut(); navigate("/login"); }} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground font-heading text-xs md:text-sm hover:bg-secondary/80 transition-all flex items-center gap-2 self-start sm:self-auto">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>

          <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-card/50 p-3 md:p-4 mb-4">
            <h2 className="font-heading font-semibold text-foreground mb-2 text-xs md:text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Filter Criteria
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">County</label>
                <select value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none">
                  {kenyanCounties.map((county) => <option key={county} value={county}>{county}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Sub-County</label>
                <input type="text" value={subcountyFilter} onChange={(e) => setSubcountyFilter(e.target.value)} placeholder="e.g. Westlands, Kibra..." className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none">
                  {reportCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Showing <span className="text-primary font-medium">{filteredReports.length}</span> of {reports?.length || 0} reports
              {" "}• {hotspots.length} hotspots • {autoEscalated.length} auto-escalated
            </p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 mb-4">
            {[
              { label: "Filtered Reports", value: filteredReports.length, icon: FileText, color: "text-primary" },
              { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-warning" },
              { label: "Verified", value: verifiedCount, icon: ShieldCheck, color: "text-safe" },
              { label: "Hotspots", value: hotspots.length, icon: Flame, color: "text-critical" },
              { label: "Auto-Escalated", value: autoEscalated.length, icon: Radio, color: "text-destructive" },
              { label: "News Articles", value: newsData?.articles?.length || 0, icon: Newspaper, color: "text-foreground" },
            ].map((kpi) => (
              <div key={kpi.label} className="p-2 md:p-3 rounded-xl border border-glow bg-card/50 text-center">
                <kpi.icon className={`w-4 h-4 mx-auto mb-1 ${kpi.color}`} />
                <div className={`text-base md:text-xl font-heading font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 mb-4 overflow-x-auto">
            {[
              { key: "approvals" as const, label: "Report Approvals", icon: ThumbsUp, count: pendingCount },
              { key: "hotspots" as const, label: "Incident Hotspots", icon: Flame, count: autoEscalated.length },
              { key: "ai" as const, label: "AI Intelligence", icon: Brain, count: 0 },
              { key: "leaderboard" as const, label: "Reporter Leaderboard", icon: Award, count: 0 },
              { key: "roles" as const, label: "User Roles", icon: ShieldCheck, count: 0 },
              { key: "reports" as const, label: "PDF & News", icon: Download, count: 0 },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setAdminTab(tab.key)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-heading font-medium transition-all whitespace-nowrap ${adminTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${adminTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-warning/20 text-warning"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {adminTab === "approvals" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 border-warning/30 bg-gradient-to-br from-card/80 to-warning/5 p-3 md:p-5 mb-5">
              <h2 className="font-heading font-bold text-sm md:text-lg text-foreground flex items-center gap-2 mb-3">
                <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 text-warning" /> Report Approvals
              </h2>

              <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 mb-3">
                {([
                  { key: "pending" as const, label: "Pending", count: pendingCount },
                  { key: "approved" as const, label: "Approved", count: verifiedCount },
                  { key: "all" as const, label: "All", count: filteredReports.length },
                ] as const).map((tab) => (
                  <button key={tab.key} onClick={() => setReportTab(tab.key)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-heading font-medium transition-all ${reportTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {tabFilteredReports.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No reports in this category.</p>}
                {tabFilteredReports.slice(0, 30).map((report) => (
                  <div key={report.id} className="p-2.5 rounded-lg bg-background/60 border border-border space-y-2">
                    <div className="flex items-start gap-2">
                      {report.image_url ? (
                        <img src={report.image_url} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded bg-secondary flex items-center justify-center flex-shrink-0"><Camera className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-foreground truncate">{report.title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{categoryLabels[report.damage_type] || report.damage_type} • {report.severity || "unknown"}</p>
                        {report.address && <p className="text-[10px] text-muted-foreground truncate"><MapPin className="w-2.5 h-2.5 inline" /> {report.address}</p>}
                        <p className="text-[10px] text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <ReportLifecycle currentStatus={report.status} report={report as any} compact />
                    <AuthorityRoutingCard report={report} compact />

                    <div className="flex flex-wrap items-center gap-1">
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        Status
                        <select
                          value={report.status || "submitted"}
                          onChange={(event) => updateStatusMutation.mutate({ id: report.id, status: event.target.value })}
                          disabled={updateStatusMutation.isPending}
                          className="px-2 py-1 rounded bg-secondary border border-border text-foreground text-[10px] disabled:opacity-50"
                        >
                          {reportStatusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(report.status === "submitted" || report.status === "pending") && (
                        <>
                          <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "reviewing" })} className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"><Brain className="w-3 h-3" /> Review</button>
                          <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "rejected" })} className="px-2 py-1 rounded text-[10px] font-medium bg-critical/10 text-critical hover:bg-critical/20 transition-colors flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
                        </>
                      )}
                      {report.status === "reviewing" && (
                        <>
                          <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "verified" })} className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verify</button>
                          <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "rejected" })} className="px-2 py-1 rounded text-[10px] font-medium bg-critical/10 text-critical hover:bg-critical/20 transition-colors flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
                        </>
                      )}
                      {report.status === "verified" && (
                        <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "assigned" })} className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"><UserCheck className="w-3 h-3" /> Assign</button>
                      )}
                      {report.status === "assigned" && (
                        <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "in_progress" })} className="px-2 py-1 rounded text-[10px] font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors flex items-center gap-1"><Wrench className="w-3 h-3" /> Start Work</button>
                      )}
                      {report.status === "in_progress" && (
                        <button onClick={() => updateStatusMutation.mutate({ id: report.id, status: "resolved" })} className="px-2 py-1 rounded text-[10px] font-medium bg-safe/10 text-safe hover:bg-safe/20 transition-colors flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Resolve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {adminTab === "hotspots" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mb-5">
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card/80 p-3 md:p-4">
                <h2 className="font-heading font-bold text-sm md:text-lg text-foreground flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-critical" /> Incident Hotspot Engine
                </h2>
                <p className="text-[10px] md:text-xs text-muted-foreground mb-3">
                  Hotspots are computed only from citizen reports. Reports within 500 meters are grouped, then scored by reporter count, recency, severity, and volume.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
                    <div className="text-lg font-heading font-bold text-primary">{hotspots.length}</div>
                    <div className="text-[9px] text-muted-foreground">Clusters</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-critical/30 text-center">
                    <div className="text-lg font-heading font-bold text-critical">{autoEscalated.length}</div>
                    <div className="text-[9px] text-muted-foreground">Auto-Escalated</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
                    <div className="text-lg font-heading font-bold text-foreground">{hotspots.length ? Math.round(hotspots.reduce((sum, item) => sum + item.priorityScore, 0) / hotspots.length) : 0}</div>
                    <div className="text-[9px] text-muted-foreground">Avg Priority</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
                    <div className="text-lg font-heading font-bold text-foreground">{filteredReports.length}</div>
                    <div className="text-[9px] text-muted-foreground">Reports Used</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-4">
                <h3 className="font-heading font-bold text-xs md:text-sm text-foreground flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-primary" /> Ranked Hotspots
                </h3>
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {hotspots.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No report clusters match the current filters.</p>}
                  {hotspots.map((cluster, index) => (
                    <div key={cluster.id} className="p-3 rounded-lg border border-border bg-background/60">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-medium text-foreground">{index + 1}. {cluster.topLocation}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {categoryLabels[cluster.topCategory] || cluster.topCategory} • {cluster.reports.length} reports • {cluster.uniqueReporters} reporters
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {cluster.isAutoEscalated && <Radio className="w-3 h-3 text-critical" />}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${getRiskColor(cluster.urgencyTier)}`}>
                            {cluster.priorityScore}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {adminTab === "ai" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 p-3 md:p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h2 className="font-heading font-bold text-sm md:text-lg text-foreground flex items-center gap-2">
                  <Brain className="w-4 h-4 md:w-5 md:h-5 text-primary" /> AI Intelligence Engine
                </h2>
                <button onClick={() => { refetchAI(); toast({ title: "Refreshing grounded analysis..." }); }} disabled={aiLoading} className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {aiLoading ? "Analyzing..." : "Refresh Analysis"}
                </button>
              </div>

              <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 mb-3 overflow-x-auto">
                {([
                  { key: "recommendations" as const, label: "Recommendations" },
                  { key: "predictions" as const, label: "Predictions" },
                  { key: "risk" as const, label: "Risk Matrix" },
                ] as const).map((tab) => (
                  <button key={tab.key} onClick={() => setAiTab(tab.key)} className={`flex-1 px-2 py-1.5 rounded-md text-[10px] md:text-xs font-heading font-medium transition-all whitespace-nowrap ${aiTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analyzing reports and verified news...</p>
                </div>
              ) : aiInsights?.data_status === "insufficient_data" ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <p className="text-xs font-medium text-warning">Not enough verified evidence for AI output</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{aiInsights.executive_summary}</p>
                </div>
              ) : aiInsights ? (
                <>
                  {aiTab === "recommendations" && (
                    <div className="space-y-2">
                      {(aiInsights.recommendations ?? []).map((recommendation: any, index: number) => (
                        <div key={`${recommendation.title}-${index}`} className="p-2.5 rounded-lg bg-background/60 border border-border">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-xs md:text-sm font-heading font-semibold text-foreground">{recommendation.title}</h3>
                            <div className="flex flex-wrap justify-end gap-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-primary/10 text-primary">{recommendation.priority}</span>
                              {formatConfidence(recommendation.confidence) !== null && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getConfidenceColor(formatConfidence(recommendation.confidence)!)}`}>
                                  {formatConfidence(recommendation.confidence)}% confidence
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground">{recommendation.description}</p>
                          {recommendation.confidence_basis && (
                            <p className="text-[10px] text-muted-foreground/80 mt-1">{recommendation.confidence_basis}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {aiTab === "predictions" && (
                    <div className="space-y-2">
                      {(aiInsights.predictions ?? []).map((prediction: any, index: number) => (
                        <div key={`${prediction.asset_name}-${index}`} className="p-2.5 rounded-lg bg-background/60 border border-border">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-xs md:text-sm font-heading font-semibold text-foreground">{prediction.asset_name}</h3>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${getRiskColor(prediction.risk_level)}`}>{prediction.risk_level}</span>
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground">{prediction.prediction}</p>
                          <p className="text-[10px] text-safe mt-1">{prediction.preventive_action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiTab === "risk" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] md:text-xs">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Category</th>
                            <th className="pb-2 font-medium">Risk</th>
                            <th className="pb-2 font-medium">Trend</th>
                            <th className="pb-2 font-medium hidden sm:table-cell">30d</th>
                            <th className="pb-2 font-medium hidden sm:table-cell">90d</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(aiInsights.risk_matrix ?? []).map((row: any, index: number) => (
                            <tr key={`${row.category}-${index}`} className="border-b border-border/50">
                              <td className="py-2 text-foreground font-medium">{row.category}</td>
                              <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${getRiskColor(row.current_risk)}`}>{row.current_risk}</span></td>
                              <td className="py-2">{getTrendIcon(row.trend)}</td>
                              <td className="py-2 text-muted-foreground hidden sm:table-cell">{row.incidents_30d}</td>
                              <td className="py-2 text-muted-foreground hidden sm:table-cell">{row.projected_incidents_90d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Grounded AI analysis is currently unavailable.</p>
              )}
            </motion.div>
          )}

          {adminTab === "leaderboard" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mb-5">
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card/80 p-3 md:p-4">
                <h2 className="font-heading font-bold text-sm md:text-lg text-foreground flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-primary" /> Reporter Credibility Leaderboard
                </h2>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Scores are based on verification outcomes and contribution history from real submitted reports.
                </p>
              </div>

              <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-4">
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {reporterLeaderboard.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No reporter data available.</p>}
                  {reporterLeaderboard.map((reporter, index) => (
                    <div key={reporter.id} className="p-3 rounded-lg border border-border bg-background/60">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-heading font-bold text-primary shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs md:text-sm font-medium text-foreground truncate">{reporter.name}</p>
                              {reporter.email && <p className="text-[10px] text-muted-foreground truncate">{reporter.email}</p>}
                            </div>
                            <span className="text-sm font-heading font-bold text-primary">{reporter.credibilityScore}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
                            <span><FileText className="w-3 h-3 inline mr-0.5" />{reporter.totalReports} total</span>
                            <span><CheckCircle className="w-3 h-3 inline mr-0.5" />{reporter.approved} verified</span>
                            <span><XCircle className="w-3 h-3 inline mr-0.5" />{reporter.rejected} rejected</span>
                            <span><Users className="w-3 h-3 inline mr-0.5" />{reporter.hotspotContributions} hotspots</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {adminTab === "roles" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <AdminUserRolesPanel />
            </motion.div>
          )}

          {adminTab === "reports" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mb-5">
              <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-5">
                <h2 className="font-heading font-semibold text-foreground mb-3 text-sm md:text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" /> Generate Grounded PDF Report
                </h2>
                <p className="text-[10px] md:text-xs text-muted-foreground mb-3">
                  The PDF includes only filtered citizen reports plus verified Kenya news. No seeded assets or synthetic alerts are included.
                </p>
                <button onClick={generatePDF} className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading font-medium text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Generate PDF
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-5">
                  <h2 className="font-heading font-semibold text-foreground mb-3 text-xs md:text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Reports by Category
                  </h2>
                  <div className="space-y-1.5">
                    {Object.entries(reportsByCategory).map(([category, categoryReports]) => (
                      <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border">
                        <span className="text-[10px] md:text-xs text-foreground capitalize">{categoryLabels[category] || category}</span>
                        <span className="text-[10px] font-heading font-bold text-primary">{categoryReports.length}</span>
                      </div>
                    ))}
                    {Object.keys(reportsByCategory).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No reports match filters.</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-heading font-semibold text-foreground text-xs md:text-sm flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-primary" /> Verified Kenya News
                    </h2>
                    <button onClick={() => refetchNews()} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${newsLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>

                  {newsLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : newsData?.articles?.length > 0 ? (
                    <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                      {newsData.articles.map((article: any, index: number) => (
                        <a key={`${article.link}-${index}`} href={article.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/50 transition-colors">
                          <Newspaper className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] md:text-xs font-medium text-foreground line-clamp-2">{article.title}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{article.source} • {new Date(article.pubDate).toLocaleDateString()}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">No verified news articles found.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
