import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Eye,
  Brain,
  ShieldCheck,
  AlertTriangle,
  Activity,
  MapPin,
  Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getReportReference, statusDescriptions } from "@/lib/reportUX";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const categoryLabels: Record<string, string> = {
  pothole: "Roads / Potholes",
  crack: "Cracks / Structural",
  leak: "Water / Sewage",
  flooding: "Flooding / Drainage",
  structural: "Buildings / Structural",
  electrical: "Electrical / Power",
  other: "Other",
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--safe))', 'hsl(var(--warning))', 'hsl(var(--destructive))', '#8b5cf6', '#06b6d4'];

const OrgDashboardPage = () => {
  const navigate = useNavigate();
  const { user, isOrgMember, organizationId } = useAuth();
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "critical">("all");

  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations" as any)
        .select("*")
        .eq("id", organizationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: orgReports, isLoading: reportsLoading } = useQuery({
    queryKey: ["org-reports", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const approvedReports = (orgReports ?? []).filter((report) =>
    ["approved", "verified", "citizen_confirmed", "in_progress", "resolved"].includes(String(report.status || "").toLowerCase()),
  ).length;
  
  const pendingReports = (orgReports ?? []).filter((report) =>
    ["submitted", "pending", "reviewing"].includes(String(report.status || "").toLowerCase()),
  ).length;

  const filteredReports = useMemo(() => {
    if (!orgReports) return [];
    if (filter === "pending") {
      return orgReports.filter(r => ["submitted", "pending", "reviewing"].includes(String(r.status || "").toLowerCase()));
    }
    if (filter === "critical") {
      return orgReports.filter(r => r.severity === "critical" || r.ai_analysis?.severity === "critical");
    }
    return orgReports;
  }, [orgReports, filter]);

  const chartData = useMemo(() => {
    if (!orgReports || orgReports.length === 0) return [];
    const counts: Record<string, number> = {};
    orgReports.forEach(report => {
      const cat = categoryLabels[report.damage_type] || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orgReports]);

  if (orgLoading || reportsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgMember) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-center mb-6">You need to be a member of an organization to view this page.</p>
        <button onClick={() => navigate("/")} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navbar />
      
      {/* Command Center Header */}
      <div className="relative pt-24 pb-12 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent opacity-50" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm font-medium bg-black/20 px-3 py-1.5 rounded-full border border-white/5 w-max">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Portal
            </button>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 backdrop-blur-md">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">
                    Command Center
                  </h1>
                </div>
                <p className="text-lg text-primary font-medium">{organization?.name}</p>
                <p className="text-muted-foreground text-sm max-w-xl mt-1">
                  Manage, verify, and dispatch resources for infrastructure incidents routed to your authority.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 pt-8 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Routed", value: orgReports?.length || 0, icon: FileText, color: "text-primary", bg: "from-primary/10 to-transparent" },
            { label: "Pending Review", value: pendingReports, icon: Clock, color: "text-warning", bg: "from-warning/10 to-transparent" },
            { label: "In Progress / Resolved", value: approvedReports, icon: CheckCircle, color: "text-safe", bg: "from-safe/10 to-transparent" },
            { label: "Critical Priority", value: (orgReports || []).filter(r => r.severity === "critical").length, icon: AlertTriangle, color: "text-destructive", bg: "from-destructive/10 to-transparent" },
          ].map((kpi, idx) => (
            <motion.div 
              key={kpi.label} 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ delay: 0.1 + (idx * 0.05) }}
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

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Panel: Filters & List */}
          <div className="lg:col-span-4 flex flex-col h-[700px] gap-4">
            
            {/* Visual Analytics Mini-Panel */}
            {chartData.length > 0 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4 shadow-lg shrink-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Incident Distribution</h3>
                <div className="h-[120px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Incident Feed */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl flex-1 flex flex-col overflow-hidden shadow-lg">
              <div className="p-4 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-bold text-base flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Triage Queue</h2>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">{filteredReports.length}</span>
                </div>
                <div className="flex gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "pending", label: "Pending" },
                    { key: "critical", label: "Critical" }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key as any)}
                      className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg transition-colors border ${
                        filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-black/30 text-muted-foreground border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filteredReports.length === 0 ? (
                  <div className="py-10 text-center opacity-50">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-safe" />
                    <p className="text-sm">Queue is clear.</p>
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedReport?.id === report.id 
                          ? "bg-primary/10 border-primary shadow-lg shadow-primary/10 scale-[1.02]" 
                          : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-mono text-primary/70">{getReportReference(report)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                           report.severity === 'critical' ? 'bg-critical/20 text-critical border border-critical/30' : 
                           report.severity === 'high' ? 'bg-destructive/20 text-destructive border border-destructive/30' : 
                           'bg-secondary text-muted-foreground border border-white/5'
                        }`}>{report.severity || "unknown"}</span>
                      </div>
                      <p className="font-semibold text-sm truncate text-foreground leading-tight">{report.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Panel: Incident Details */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-8 h-[700px]">
            <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl h-full flex flex-col overflow-hidden shadow-2xl relative">
              {selectedReport ? (
                <>
                  <div className={`h-1.5 w-full ${selectedReport.severity === 'critical' ? 'bg-critical shadow-[0_0_15px_rgba(var(--critical),0.5)]' : selectedReport.severity === 'high' ? 'bg-destructive' : 'bg-primary'}`} />
                  
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-primary border border-white/5">{getReportReference(selectedReport)}</span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-secondary border border-white/10 text-foreground">
                            {selectedReport.status}
                          </span>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground leading-tight">{selectedReport.title}</h2>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary" /> {selectedReport.address || `${selectedReport.latitude}, ${selectedReport.longitude}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 mb-8">
                      {/* Image Viewer */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field Evidence</h3>
                        {selectedReport.image_url ? (
                          <div className="rounded-xl overflow-hidden border border-white/10 bg-black relative group">
                            <img src={selectedReport.image_url} alt="Evidence" className="w-full h-56 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center h-56 bg-black/20 text-muted-foreground">
                            <Eye className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-xs">No visual evidence provided</p>
                          </div>
                        )}
                      </div>

                      {/* Incident Details */}
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</h3>
                          <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {selectedReport.description}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reported At</p>
                            <p className="text-sm font-medium">{new Date(selectedReport.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reporter</p>
                            <p className="text-sm font-medium">{selectedReport.reporter_name || "Anonymous Citizen"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Assessment Panel */}
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" /> Automated AI Assessment
                      </h3>
                      
                      {selectedReport.ai_analysis ? (
                        <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                          
                          <div className="flex flex-col md:flex-row gap-6 relative z-10">
                            <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Detected Type</p>
                                   <p className="text-sm font-bold capitalize text-foreground">{selectedReport.ai_analysis.damage_type || selectedReport.damage_type}</p>
                                 </div>
                                 <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Assessed Severity</p>
                                   <p className={`text-sm font-bold capitalize ${
                                    selectedReport.ai_analysis.severity === "critical" ? "text-critical drop-shadow-[0_0_5px_rgba(var(--critical),0.5)]" : 
                                    selectedReport.ai_analysis.severity === "high" ? "text-destructive" : 
                                    selectedReport.ai_analysis.severity === "medium" ? "text-warning" : "text-safe"
                                   }`}>{selectedReport.ai_analysis.severity || selectedReport.severity}</p>
                                 </div>
                              </div>
                              
                              {selectedReport.ai_analysis.explanation && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AI Reasoning</p>
                                  <p className="text-xs text-foreground/80 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                                    {selectedReport.ai_analysis.explanation}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="md:w-64 space-y-4">
                              <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                                  Confidence Score
                                  <span className={`text-xs font-bold ${
                                    selectedReport.ai_confidence >= 80 ? "text-safe" : 
                                    selectedReport.ai_confidence >= 50 ? "text-warning" : "text-critical"
                                  }`}>{selectedReport.ai_confidence}%</span>
                                </p>
                                <div className="h-1.5 w-full bg-black/50 rounded-full mt-2 overflow-hidden">
                                  <div className={`h-full ${
                                    selectedReport.ai_confidence >= 80 ? "bg-safe" : 
                                    selectedReport.ai_confidence >= 50 ? "bg-warning" : "bg-critical"
                                  }`} style={{ width: `${selectedReport.ai_confidence}%` }} />
                                </div>
                              </div>
                              
                              {selectedReport.ai_analysis.recommendation && (
                                <div className="text-xs text-primary-foreground bg-primary/20 p-3 rounded-lg border border-primary/30 flex items-start gap-2">
                                  <ShieldCheck className="shrink-0 w-4 h-4 text-primary mt-0.5" />
                                  <p className="leading-relaxed font-medium">{selectedReport.ai_analysis.recommendation}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {selectedReport.needs_human_review && (
                            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-warning bg-warning/10 px-4 py-2.5 rounded-lg border border-warning/20">
                              <AlertTriangle className="w-4 h-4" /> 
                              Manual Verification Required: AI confidence is below threshold.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 rounded-xl bg-black/20 border border-dashed border-white/10 text-center">
                          <Brain className="w-6 h-6 mx-auto mb-2 text-muted-foreground opacity-50" />
                          <p className="text-sm text-muted-foreground">No automated assessment available for this incident.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 border-t border-white/10 bg-black/30 flex justify-end gap-3 shrink-0">
                    <button className="px-5 py-2.5 rounded-lg text-sm font-medium border border-white/10 hover:bg-white/5 transition-colors">
                      Request More Info
                    </button>
                    <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                      Acknowledge & Update Status
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-20 h-20 rounded-full bg-black/20 border border-white/5 flex items-center justify-center mb-4">
                    <Activity className="w-8 h-8 opacity-50 text-primary" />
                  </div>
                  <p className="text-lg font-medium text-foreground">Command Center Standby</p>
                  <p className="text-sm mt-1">Select an incident from the queue to review details</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OrgDashboardPage;
