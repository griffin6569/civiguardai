import { useState } from "react";
import { Search, Loader2, FileSearch, ArrowRight, ShieldCheck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";

const TrackReportPage = () => {
  const [trackingId, setTrackingId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setIsLoading(true);
    setError("");
    setReport(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("reports")
        .select("*")
        .eq("tracking_id", trackingId.trim())
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError("Report not found. Please check the tracking ID and try again.");
      } else {
        setReport(data);
      }
    } catch (err: any) {
      setError("An error occurred while tracking the report. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-2xl">
        <div className="text-center mb-10">
          <FileSearch className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-bold mb-4">Track Your Report</h1>
          <p className="text-muted-foreground">
            Enter the unique tracking ID you received after submission to check the current status of your report.
          </p>
        </div>

        <div className="bg-card/50 rounded-xl border border-glow p-6 mb-8 shadow-lg">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter Tracking ID (e.g. CGA-2026-...)"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none uppercase placeholder:normal-case"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !trackingId.trim()}
              className="px-6 py-3 bg-primary text-primary-foreground font-heading font-medium rounded-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Track"}
            </button>
          </form>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </div>

        {report && (
          <div className="bg-background/80 rounded-xl border border-border p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-heading font-bold mb-1">{report.title}</h2>
                <p className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded inline-block">
                  {report.tracking_id}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                report.status === 'resolved' ? 'bg-safe/20 text-safe' :
                report.status === 'in_progress' ? 'bg-warning/20 text-warning' :
                'bg-secondary text-foreground'
              }`}>
                {report.status.replace("_", " ")}
              </span>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Submitted On</p>
                  <p className="text-sm font-medium">{new Date(report.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Damage Type</p>
                  <p className="text-sm font-medium capitalize">{report.damage_type}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm bg-secondary/30 p-3 rounded-lg border border-border">{report.description}</p>
              </div>

              {report.address && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
                  <p className="text-sm">{report.address}</p>
                </div>
              )}

              {report.image_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Evidence</p>
                  <img src={report.image_url} alt="Evidence" className="w-full h-48 object-cover rounded-lg border border-border" />
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-center">
              <div className="inline-flex items-center gap-2 text-xs text-safe bg-safe/10 px-4 py-2 rounded-full border border-safe/20">
                <ShieldCheck className="w-4 h-4" /> This report is verified and securely tracked.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackReportPage;
