import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
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
  PlusCircle,
  Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AuthorityRoutingCard from "@/components/AuthorityRoutingCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getReportReference, statusDescriptions } from "@/lib/reportUX";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

  const chartData = useMemo(() => {
    if (!myReports || myReports.length === 0) return [];
    
    // Generate last 7 days data
    const last7Days = Array.from({ length: 7 }).map((_, i) => format(subDays(new Date(), i), 'MMM dd')).reverse();
    const dataMap: Record<string, number> = {};
    last7Days.forEach(day => dataMap[day] = 0);

    myReports.forEach(report => {
      const day = format(new Date(report.created_at), 'MMM dd');
      if (dataMap[day] !== undefined) {
        dataMap[day]++;
      }
    });

    return last7Days.map(day => ({ name: day, reports: dataMap[day] }));
  }, [myReports]);

  if (reportsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const userFirstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || "Citizen";

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navbar />
      
      {/* Personalized Header Section */}
      <div className="relative pt-24 pb-12 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground mb-2">
                {getGreeting()}, <span className="text-primary glow-text">{userFirstName}</span>
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-xl">
                Here is your personalized summary of infrastructure reports, AI insights, and verified news in your area.
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-lg">
                <MapPin className="w-4 h-4 text-primary ml-2" />
                <select
                  value={countyFilter}
                  onChange={(e) => setCountyFilter(e.target.value)}
                  className="bg-transparent border-none text-foreground text-sm focus:ring-0 outline-none cursor-pointer pr-4"
                >
                  {kenyanCounties.map((county) => <option key={county} value={county} className="bg-background">{county}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 pt-8">
        
        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 mb-8"
        >
          <button onClick={() => navigate("/report")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-heading font-semibold hover:brightness-110 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40">
            <PlusCircle className="w-5 h-5" /> Report Issue
          </button>
          <button onClick={() => navigate("/map")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-card/60 backdrop-blur-xl border border-white/10 text-foreground font-heading font-semibold hover:bg-white/5 transition-all shadow-lg">
            <MapPin className="w-5 h-5 text-primary" /> Evidence Map
          </button>
          <button onClick={() => navigate("/reports")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-card/60 backdrop-blur-xl border border-white/10 text-foreground font-heading font-semibold hover:bg-white/5 transition-all shadow-lg">
            <Activity className="w-5 h-5 text-safe" /> Live Feed
          </button>
        </motion.div>

        {/* Dynamic KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "My Reports", value: filteredReports.length, icon: FileText, color: "text-primary", bg: "from-primary/10 to-transparent" },
            { label: "Approved", value: approvedReports, icon: CheckCircle, color: "text-safe", bg: "from-safe/10 to-transparent" },
            { label: "Pending", value: pendingReports, icon: Clock, color: "text-warning", bg: "from-warning/10 to-transparent" },
            { label: "With Photos", value: reportsWithPhotos, icon: Newspaper, color: "text-foreground", bg: "from-white/5 to-transparent" },
          ].map((kpi, idx) => (
            <motion.div 
              key={kpi.label} 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className={`p-5 rounded-2xl border border-white/10 bg-gradient-to-br ${kpi.bg} backdrop-blur-xl shadow-lg relative overflow-hidden group`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <kpi.icon className="w-16 h-16" />
              </div>
              <kpi.icon className={`w-6 h-6 mb-3 ${kpi.color}`} />
              <div className={`text-3xl font-heading font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          
          {/* Main Activity Area (Reports + Chart) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Activity Chart */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} 
              className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl shadow-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> My Reporting Activity
                </h2>
              </div>
              
              {chartData.length > 0 && chartData.some(d => d.reports > 0) ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        itemStyle={{ color: "hsl(var(--primary))" }}
                      />
                      <Area type="monotone" dataKey="reports" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorReports)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl bg-black/20">
                  Not enough activity to chart yet.
                </div>
              )}
            </motion.div>

            {/* My Reports List */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} 
              className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl shadow-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Recent Evidence
                </h2>
                <button onClick={() => navigate("/report")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredReports.length === 0 ? (
                  <div className="py-8 text-center bg-black/20 rounded-xl border border-dashed border-white/10">
                    <p className="text-sm text-muted-foreground mb-3">No reports submitted yet.</p>
                    <button onClick={() => navigate("/report")} className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">Start Reporting</button>
                  </div>
                ) : (
                  filteredReports.map((report, i) => (
                    <motion.div 
                      key={report.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                      className="rounded-xl border border-white/5 bg-background/40 hover:bg-white/5 transition-colors p-4 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-heading font-semibold text-foreground truncate group-hover:text-primary transition-colors">{report.title}</p>
                          <p className="text-[11px] font-mono text-primary/80 mt-1">{getReportReference(report)}</p>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded text-muted-foreground border border-white/5">
                              {categoryLabels[report.damage_type] || report.damage_type || "Uncategorized"}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium ${
                              report.severity === 'critical' ? 'bg-critical/10 text-critical border border-critical/20' : 
                              report.severity === 'high' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 
                              'bg-secondary/50 text-muted-foreground border border-white/5'
                            }`}>{report.severity || "unknown"} severity</span>
                          </div>
                          
                          {report.address && (
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {report.address}
                            </p>
                          )}
                          
                          <div className="mt-3">
                            <AuthorityRoutingCard report={report} compact />
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                            ['approved', 'verified', 'resolved'].includes(report.status) ? "bg-safe/20 text-safe border border-safe/30" :
                            "bg-warning/20 text-warning border border-warning/30"
                          }`}>
                            {report.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar (AI Insights & News) */}
          <div className="space-y-6">
            
            {/* Grounded AI Insights */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} 
              className="rounded-2xl border border-primary/20 bg-gradient-to-b from-card/60 to-primary/5 backdrop-blur-xl shadow-xl shadow-primary/5 p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              
              <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                <h2 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Area Intelligence
                </h2>
                <button onClick={() => { refetchAI(); toast({ title: "Refreshing analysis..." }); }} disabled={aiLoading} className="p-1.5 rounded-md hover:bg-white/10 text-primary transition-colors disabled:opacity-50">
                  <Loader2 className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : "hidden"}`} />
                  <Zap className={`w-3.5 h-3.5 ${aiLoading ? "hidden" : "block"}`} />
                </button>
              </div>

              <div className="flex gap-1 p-1 rounded-lg bg-black/20 border border-white/5 mb-4 relative z-10">
                {[
                  { key: "recommendations" as const, label: "AI Advice", icon: Brain },
                  { key: "risk" as const, label: "Risk Matrix", icon: BarChart3 },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAiTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-heading font-medium transition-all ${
                      aiTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative z-10">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-3 opacity-60">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-[11px] text-muted-foreground">Synthesizing local data...</p>
                  </div>
                ) : aiInsights?.data_status === "insufficient_data" ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-center">
                    <p className="text-xs font-semibold text-warning mb-1">More Data Needed</p>
                    <p className="text-[11px] text-warning/80">{aiInsights.executive_summary}</p>
                  </div>
                ) : aiInsights ? (
                  <>
                    {aiTab === "recommendations" ? (
                      <div className="space-y-3">
                        {aiInsights.recommendations?.length > 0 ? (
                          aiInsights.recommendations.map((recommendation: any, index: number) => (
                            <div key={index} className="rounded-xl border border-white/10 bg-background/50 p-3 hover:bg-white/5 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3 className="text-xs font-heading font-semibold text-foreground leading-tight">{recommendation.title}</h3>
                                {formatConfidence(recommendation.confidence) !== null && (
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${getConfidenceColor(formatConfidence(recommendation.confidence)!)}`}>
                                    {formatConfidence(recommendation.confidence)}%
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{recommendation.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">No recommendations available.</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden border border-white/10 bg-background/50">
                        <table className="w-full text-[10px] md:text-xs">
                          <thead className="bg-black/20">
                            <tr className="text-left text-muted-foreground">
                              <th className="p-2 font-medium">Category</th>
                              <th className="p-2 font-medium">Risk</th>
                              <th className="p-2 font-medium text-right">30d</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(aiInsights.risk_matrix ?? []).map((row: any, index: number) => (
                              <tr key={index} className="border-t border-white/5">
                                <td className="p-2 text-foreground font-medium">{row.category}</td>
                                <td className="p-2 capitalize"><span className={`px-1.5 py-0.5 rounded text-[9px] ${row.current_risk === 'high' ? 'bg-destructive/20 text-destructive' : row.current_risk === 'medium' ? 'bg-warning/20 text-warning' : 'bg-safe/20 text-safe'}`}>{row.current_risk}</span></td>
                                <td className="p-2 text-muted-foreground text-right">{row.incidents_30d}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Analysis unavailable.</p>
                )}
              </div>
            </motion.div>

            {/* Verified News */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} 
              className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl shadow-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-bold text-base text-foreground">Verified Local News</h2>
              </div>

              {newsLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3 opacity-60">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-[11px] text-muted-foreground">Fetching trusted sources...</p>
                </div>
              ) : newsData?.articles?.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {newsData.articles.map((article: any, index: number) => (
                    <a
                      key={index}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-white/5 bg-background/40 p-3 hover:bg-white/10 hover:border-primary/30 transition-all group"
                    >
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight mb-1.5">{article.title}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-medium">{article.source}</p>
                        <p className="text-[9px] text-muted-foreground/70">{new Date(article.pubDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center bg-black/20 rounded-xl border border-dashed border-white/10">
                  <p className="text-xs text-muted-foreground">No local news found right now.</p>
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
