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
  Newspaper,
  Eye,
  Brain,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getReportReference, statusDescriptions } from "@/lib/reportUX";

const categoryLabels: Record<string, string> = {
  pothole: "Roads / Potholes",
  crack: "Cracks / Structural",
  leak: "Water / Sewage",
  flooding: "Flooding / Drainage",
  structural: "Buildings / Structural",
  electrical: "Electrical / Power",
  other: "Other",
};

const OrgDashboardPage = () => {
  const navigate = useNavigate();
  const { user, isOrgMember, organizationId } = useAuth();
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Fetch organization details
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

  // Fetch reports assigned to this organization
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-3 md:px-6 pt-20 md:pt-24 pb-16 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <h1 className="text-xl md:text-3xl font-heading font-bold mb-1">
            <Building2 className="inline w-5 h-5 md:w-8 md:h-8 text-primary mr-2" />
            {organization?.name || "Organization"} Dashboard
          </h1>
          <p className="text-muted-foreground mb-6 text-xs md:text-sm">
            Manage and review reports routed to your authority.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-8">
            {[
              { label: "Total Routed", value: orgReports?.length || 0, icon: FileText, color: "text-primary" },
              { label: "Approved/In Progress", value: approvedReports, icon: CheckCircle, color: "text-safe" },
              { label: "Pending Review", value: pendingReports, icon: Clock, color: "text-warning" },
            ].map((kpi) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-2.5 md:p-4 rounded-xl border border-glow bg-card/50 text-center">
                <kpi.icon className={`w-4 h-4 md:w-5 md:h-5 mx-auto mb-1 ${kpi.color}`} />
                <div className={`text-lg md:text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[9px] md:text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="md:col-span-1 border border-border rounded-xl bg-card/50 overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-border bg-secondary/30">
                <h2 className="font-semibold flex items-center gap-2 text-sm"><FileText className="w-4 h-4 text-primary" /> Incoming Reports</h2>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {orgReports?.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm p-4">No reports routed yet.</p>
                ) : (
                  orgReports?.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedReport?.id === report.id ? "bg-primary/10 border-primary/50" : "bg-background/50 border-border hover:border-primary/30"
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{report.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-muted-foreground">{getReportReference(report)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                           report.severity === 'critical' ? 'bg-critical/20 text-critical' : 
                           report.severity === 'high' ? 'bg-destructive/20 text-destructive' : 
                           'bg-secondary text-muted-foreground'
                        }`}>{report.severity || "unknown"}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Report Details View */}
            <div className="md:col-span-2 border border-border rounded-xl bg-card/50 p-6">
              {selectedReport ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                      <p className="text-sm text-primary font-mono mt-1">{getReportReference(selectedReport)}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-secondary text-foreground">
                      {selectedReport.status}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    {/* Image */}
                    {selectedReport.image_url ? (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img src={selectedReport.image_url} alt="Evidence" className="w-full h-48 object-cover" />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border flex items-center justify-center h-48 bg-secondary/10">
                        <p className="text-sm text-muted-foreground">No image provided</p>
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                        <p className="text-sm">{selectedReport.address || `${selectedReport.latitude}, ${selectedReport.longitude}`}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                        <p className="text-sm whitespace-pre-wrap">{selectedReport.description}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Date Reported</p>
                        <p className="text-sm">{new Date(selectedReport.created_at).toLocaleString()}</p>
                      </div>
                      {selectedReport.reporter_name && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Reporter</p>
                          <p className="text-sm">{selectedReport.reporter_name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Analysis View */}
                  {selectedReport.ai_analysis ? (
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-heading font-semibold text-primary flex items-center gap-1.5">
                          <Brain className="w-4 h-4" /> AI Evidence Analysis
                        </h3>
                        {selectedReport.ai_confidence && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            selectedReport.ai_confidence >= 80 ? "bg-safe/20 text-safe" : 
                            selectedReport.ai_confidence >= 50 ? "bg-warning/20 text-warning" : "bg-critical/20 text-critical"
                          }`}>
                            {selectedReport.ai_confidence}% Confidence
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         <div className="p-2.5 rounded-md bg-background/60">
                           <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Detected Type</p>
                           <p className="text-sm font-semibold capitalize text-foreground">{selectedReport.ai_analysis.damage_type || selectedReport.damage_type}</p>
                         </div>
                         <div className="p-2.5 rounded-md bg-background/60">
                           <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estimated Severity</p>
                           <p className={`text-sm font-semibold capitalize ${
                            selectedReport.ai_analysis.severity === "critical" ? "text-critical" : 
                            selectedReport.ai_analysis.severity === "high" ? "text-destructive" : 
                            selectedReport.ai_analysis.severity === "medium" ? "text-warning" : "text-safe"
                           }`}>{selectedReport.ai_analysis.severity || selectedReport.severity}</p>
                         </div>
                      </div>

                      {selectedReport.ai_analysis.evidence_indicators && selectedReport.ai_analysis.evidence_indicators.length > 0 && (
                        <div>
                           <p className="text-xs text-muted-foreground mb-1.5">Visual Evidence Indicators:</p>
                           <div className="flex flex-wrap gap-1.5">
                             {selectedReport.ai_analysis.evidence_indicators.map((ind: string, i: number) => (
                               <span key={i} className="text-[11px] px-2 py-1 rounded-md bg-secondary text-foreground flex items-center gap-1 border border-border">
                                 <Eye className="w-3 h-3 text-muted-foreground" /> {ind}
                               </span>
                             ))}
                           </div>
                        </div>
                      )}

                      {selectedReport.ai_analysis.explanation && (
                        <div className="text-xs text-muted-foreground bg-background/40 p-2.5 rounded border border-border/50">
                          {selectedReport.ai_analysis.explanation}
                        </div>
                      )}

                      {selectedReport.ai_analysis.recommendation && (
                        <div className="text-xs text-foreground bg-secondary/50 p-3 rounded-md flex items-start gap-2 border border-border">
                          <ShieldCheck className="shrink-0 w-4 h-4 text-primary mt-0.5" />
                          <p>{selectedReport.ai_analysis.recommendation}</p>
                        </div>
                      )}

                      {selectedReport.needs_human_review && (
                        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-3 py-2 rounded-md border border-warning/20">
                          <AlertTriangle className="w-4 h-4" /> 
                          This report was flagged for human verification due to low AI confidence.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                      <p className="text-sm text-muted-foreground">No AI analysis available for this report.</p>
                    </div>
                  )}

                  {/* Actions (placeholder) */}
                  <div className="flex justify-end pt-4 border-t border-border">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:brightness-110">
                      Acknowledge Report
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p>Select a report to view details</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrgDashboardPage;
