/**
 * CiviGuard AI — Report Lifecycle Status Tracker
 * Displays the full status flow with timestamps.
 */

import { CheckCircle, Clock, Eye, UserCheck, Wrench, ShieldCheck, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const LIFECYCLE_STAGES = [
  { key: "submitted", label: "Submitted", icon: Clock, color: "text-muted-foreground" },
  { key: "reviewing", label: "Reviewing", icon: Eye, color: "text-warning" },
  { key: "verified", label: "Verified", icon: ShieldCheck, color: "text-primary" },
  { key: "assigned", label: "Assigned", icon: UserCheck, color: "text-primary" },
  { key: "in_progress", label: "In Progress", icon: Wrench, color: "text-warning" },
  { key: "resolved", label: "Resolved", icon: CheckCircle, color: "text-safe" },
  { key: "citizen_confirmed", label: "Confirmed", icon: ThumbsUp, color: "text-safe" },
];

interface ReportLifecycleProps {
  currentStatus: string;
  report?: {
    created_at?: string;
    verified_at?: string;
    resolved_at?: string;
    citizen_confirmed_at?: string;
    assigned_to?: string;
    assigned_agency?: string;
  };
  compact?: boolean;
}

export function getStageIndex(status: string): number {
  const idx = LIFECYCLE_STAGES.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

const ReportLifecycle = ({ currentStatus, report, compact }: ReportLifecycleProps) => {
  const currentIdx = getStageIndex(currentStatus);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isComplete = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={stage.key} className="flex items-center gap-0.5">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  isComplete ? "bg-primary" : "bg-muted",
                  isCurrent && "ring-2 ring-primary/30"
                )}
                title={stage.label}
              />
              {idx < LIFECYCLE_STAGES.length - 1 && (
                <div className={cn("w-3 h-0.5", isComplete ? "bg-primary/50" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isComplete = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const StageIcon = stage.icon;

          return (
            <div key={stage.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all",
                  isComplete ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground",
                  isCurrent && "ring-1 ring-primary/50 bg-primary/20"
                )}
              >
                <StageIcon className="w-3 h-3" />
                {stage.label}
              </div>
              {idx < LIFECYCLE_STAGES.length - 1 && (
                <div className={cn("w-4 h-0.5 mx-0.5", isComplete ? "bg-primary/50" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
      {report && (
        <div className="flex flex-wrap gap-x-3 text-[9px] text-muted-foreground">
          {report.created_at && <span>Submitted: {new Date(report.created_at).toLocaleDateString()}</span>}
          {report.verified_at && <span>Verified: {new Date(report.verified_at).toLocaleDateString()}</span>}
          {report.assigned_agency && <span>Agency: {report.assigned_agency}</span>}
          {report.resolved_at && <span>Resolved: {new Date(report.resolved_at).toLocaleDateString()}</span>}
          {report.citizen_confirmed_at && <span>Confirmed: {new Date(report.citizen_confirmed_at).toLocaleDateString()}</span>}
        </div>
      )}
    </div>
  );
};

export { LIFECYCLE_STAGES };
export default ReportLifecycle;
