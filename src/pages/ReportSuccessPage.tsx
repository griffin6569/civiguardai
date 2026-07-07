import { useParams, useNavigate } from "react-router-dom";
import { Copy, CheckCircle2, Download, Printer, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Loader2 } from "lucide-react";

const ReportSuccessPage = () => {
  const { trackingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", trackingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("tracking_id", trackingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!trackingId,
  });

  const copyToClipboard = () => {
    if (trackingId) {
      navigator.clipboard.writeText(trackingId);
      toast({ title: "Copied!", description: "Tracking ID copied to clipboard." });
    }
  };

  const handleCreateAccount = () => {
    navigate(`/login?mode=signup&claim_report=${trackingId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-lg text-center">
        <CheckCircle2 className="w-20 h-20 text-safe mx-auto mb-6" />
        <h1 className="text-3xl font-heading font-bold mb-4">Report Submitted Successfully</h1>
        <p className="text-muted-foreground mb-8">
          Thank you for reporting this issue. Your report has been securely logged and routed to the appropriate authorities.
        </p>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !report ? (
          <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/30">
            Report not found.
          </div>
        ) : (
          <div className="bg-card/50 rounded-xl border border-glow p-6 mb-8 text-left shadow-lg">
            <h2 className="text-sm font-heading font-semibold text-foreground mb-4 border-b border-border pb-2">Tracking Details</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tracking ID</p>
                <div className="flex items-center gap-2">
                  <code className="bg-background px-3 py-2 rounded border border-border text-primary font-bold tracking-widest text-lg flex-1">
                    {trackingId}
                  </code>
                  <button onClick={copyToClipboard} className="p-3 bg-secondary rounded hover:bg-secondary/80 transition-colors">
                    <Copy className="w-5 h-5 text-foreground" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Submission Date</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-medium capitalize text-safe">
                    {report.status}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Estimated Review Time</p>
                <p className="text-sm font-medium text-foreground">24 - 48 Hours</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-border">
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-foreground text-xs font-medium rounded hover:bg-secondary/80 transition-colors">
                <Download className="w-4 h-4" /> Receipt
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-foreground text-xs font-medium rounded hover:bg-secondary/80 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-foreground text-xs font-medium rounded hover:bg-secondary/80 transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-primary/5 rounded-xl border border-primary/30 p-6 shadow-xl shadow-primary/10">
          <h3 className="text-lg font-heading font-bold mb-2">Want to track your reports?</h3>
          <p className="text-sm text-muted-foreground mb-6 text-left">
            Create a free account to track all your reports in one place, receive real-time status updates, and build your trusted reporter reputation.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={handleCreateAccount} className="w-full px-6 py-3 bg-primary text-primary-foreground font-heading font-bold rounded-xl glow-primary hover:brightness-110 transition-all">
              Create Account
            </button>
            <button onClick={() => navigate("/")} className="w-full px-6 py-3 bg-transparent text-foreground border border-border font-heading font-medium rounded-xl hover:bg-secondary transition-all">
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportSuccessPage;
