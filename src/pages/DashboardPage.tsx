import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Newspaper,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AuthorityRoutingCard from "@/components/AuthorityRoutingCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getReportReference, statusDescriptions } from "@/lib/reportUX";

const kenyanCounties = [
  "All Counties", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Kajiado",
  "Uasin Gishu", "Nyeri", "Meru", "Kilifi", "Kwale", "Garissa", "Turkana", "Mandera",
  "Wajir", "Marsabit", "Isiolo", "Tana River", "Lamu", "Taita Taveta", "Embu", "Tharaka Nithi",
  "Kitui", "Makueni", "Nyandarua", "Laikipia", "Samburu", "Trans Nzoia", "West Pokot",
  "Baringo", "Elgeyo Marakwet", "Nandi", "Bomet", "Kericho", "Kakamega", "Vihiga",
  "Bungoma", "Busia", "Siaya", "Homa Bay", "Migori", "Kisii", "Nyamira", "Narok", "Kirinyaga", "Murang'a",
];

const categoryLabels: Record<string, string> = {
  pothole: "Roads / Potholes",
  crack: "Cracks / Structural",
  leak: "Water / Sewage",
  flooding: "Flooding / Drainage",
  structural: "Buildings / Structural",
  electrical: "Electrical / Power",
  other: "Other",
};

const getConfidenceColor = (confidence: number) =>
  confidence >= 75 ? "bg-safe/20 text-safe" :
  confidence >= 50 ? "bg-warning/20 text-warning" :
  "bg-critical/20 text-critical";

const formatConfidence = (confidence: unknown) => {
  const value = Number(confidence);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [countyFilter, setCountyFilter] = useState("All Counties");
  const [aiTab, setAiTab] = useState<"recommendations" | "risk">("recommendations");

  const { data: myReports, isLoading: reportsLoading } = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: aiInsights, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ["ai-predictions-grounded"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-predictions", { body: { type: "dashboard" } });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["dashboard-news"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        body: { category: "", location: countyFilter === "All Counties" ? "" : countyFilter },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredReports = useMemo(() => {
    return (myReports ?? []).filter((report) => {
      if (countyFilter !== "All Counties" && !report.address?.toLowerCase().includes(countyFilter.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [myReports, countyFilter]);

  const approvedReports = filteredReports.filter((report) =>
    ["approved", "verified", "citizen_confirmed", "in_progress", "resolved"].includes(String(report.status || "").toLowerCase()),
  ).length;
  const pendingReports = filteredReports.filter((report) =>
    ["submitted", "pending", "reviewing"].includes(String(report.status || "").toLowerCase()),
  ).length;
  const reportsWithPhotos = filteredReports.filter((report) => Boolean(report.image_url)).length;

  if (reportsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-3 md:px-6 pt-20 md:pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <h1 className="text-xl md:text-3xl font-heading font-bold mb-1">
            <Brain className="inline w-5 h-5 md:w-8 md:h-8 text-primary mr-2" />
            My Evidence Dashboard
          </h1>
          <p className="text-muted-foreground mb-4 text-xs md:text-sm">
            Your reports, grounded AI insights, and verified Kenya news only.
          </p>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <select
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs md:text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {kenyanCounties.map((county) => <option key={county} value={county}>{county}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
            {[
              { label: "My Reports", value: filteredReports.length, icon: FileText, color: "text-primary" },
              { label: "Approved", value: approvedReports, icon: CheckCircle, color: "text-safe" },
              { label: "Pending", value: pendingReports, icon: Clock, color: "text-warning" },
              { label: "With Photos", value: reportsWithPhotos, icon: Newspaper, color: "text-foreground" },
            ].map((kpi) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-2.5 md:p-4 rounded-xl border border-glow bg-card/50 text-center">
                <kpi.icon className={`w-4 h-4 md:w-5 md:h-5 mx-auto mb-1 ${kpi.color}`} />
                <div className={`text-lg md:text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[9px] md:text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 p-3 md:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="font-heading font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Grounded AI Insights
              </h2>
              <button
                onClick={() => {
                  refetchAI();
                  toast({ title: "Refreshing grounded analysis..." });
                }}
                disabled={aiLoading}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {aiLoading ? "Analyzing..." : "Refresh"}
              </button>
            </div>

            <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 mb-3">
              {[
                { key: "recommendations" as const, label: "Recommendations", icon: Brain },
                { key: "risk" as const, label: "Risk Matrix", icon: BarChart3 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAiTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-heading font-medium transition-all ${
                    aiTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {aiLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Analyzing verified reports and news...</p>
              </div>
            ) : aiInsights?.data_status === "insufficient_data" ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-medium text-warning">Not enough verified evidence yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">{aiInsights.executive_summary}</p>
              </div>
            ) : aiInsights ? (
              <>
                {aiTab === "recommendations" ? (
                  <div className="space-y-2">
                    {aiInsights.recommendations?.length > 0 ? (
                      aiInsights.recommendations.map((recommendation: any, index: number) => (
                        <div key={`${recommendation.title}-${index}`} className="rounded-lg border border-border bg-background/60 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-xs md:text-sm font-heading font-semibold text-foreground">{recommendation.title}</h3>
                            <div className="flex flex-wrap justify-end gap-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-primary/10 text-primary">
                                {recommendation.priority}
                              </span>
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
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No grounded recommendations are available yet.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] md:text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Category</th>
                          <th className="pb-2 font-medium">Risk</th>
                          <th className="pb-2 font-medium">30d</th>
                          <th className="pb-2 font-medium">90d</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(aiInsights.risk_matrix ?? []).map((row: any, index: number) => (
                          <tr key={`${row.category}-${index}`} className="border-b border-border/50">
                            <td className="py-2 text-foreground font-medium">{row.category}</td>
                            <td className="py-2 text-muted-foreground capitalize">{row.current_risk}</td>
                            <td className="py-2 text-muted-foreground">{row.incidents_30d}</td>
                            <td className="py-2 text-muted-foreground">{row.projected_incidents_90d}</td>
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

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-glow bg-card/50 p-3 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading font-semibold text-foreground text-sm md:text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" /> My Reports
                </h2>
                <button onClick={() => navigate("/report")} className="text-xs text-primary hover:underline flex items-center gap-1">
                  New Report <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {filteredReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No reports submitted yet.</p>
                ) : (
                  filteredReports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-medium text-foreground">{report.title}</p>
                          <p className="text-[10px] text-primary mt-0.5">{getReportReference(report)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {categoryLabels[report.damage_type] || report.damage_type || "Uncategorized"} • {report.severity || "unknown"} • {new Date(report.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {statusDescriptions[report.status || "submitted"] || "Status update pending"}
                          </p>
                          {report.address && (
                            <p className="text-[10px] text-muted-foreground mt-1">{report.address}</p>
                          )}
                          <div className="mt-2">
                            <AuthorityRoutingCard report={report} compact />
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium capitalize bg-background border border-border text-muted-foreground">
                          {report.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="rounded-xl border border-glow bg-card/50 p-3 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <Newspaper className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <h2 className="font-heading font-semibold text-foreground text-sm md:text-base">Verified Kenya News</h2>
              </div>

              {newsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Loading verified news...
                </div>
              ) : newsData?.articles?.length > 0 ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {newsData.articles.map((article: any, index: number) => (
                    <a
                      key={`${article.link}-${index}`}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-border bg-secondary/20 p-3 hover:border-primary/30 transition-colors"
                    >
                      <p className="text-xs md:text-sm font-medium text-foreground">{article.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {article.source} • {new Date(article.pubDate).toLocaleDateString()}
                      </p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4">No verified news articles are available right now.</p>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
