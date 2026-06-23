/**
 * CiviGuard AI — Duplicate Report Warning Component
 */

import { AlertTriangle, Copy, MapPin } from "lucide-react";
import type { DuplicateCheckResult } from "@/lib/duplicateDetection";

interface DuplicateWarningProps {
  result: DuplicateCheckResult;
  onProceed: () => void;
  onCancel: () => void;
}

const DuplicateWarning = ({ result, onProceed, onCancel }: DuplicateWarningProps) => {
  if (!result.isDuplicate && !result.isSpam && !result.isGPSMismatch) return null;

  return (
    <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-heading font-semibold text-warning">Submission Warning</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            We detected potential issues with this report. Please review before submitting.
          </p>
        </div>
      </div>

      {result.warnings.map((warning, i) => (
        <p key={i} className="text-xs text-foreground bg-warning/10 px-3 py-2 rounded-lg">
          ⚠️ {warning}
        </p>
      ))}

      {result.potentialDuplicates.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Similar Reports Found:</p>
          {result.potentialDuplicates.slice(0, 3).map((dup) => (
            <div key={dup.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-background/60 border border-border">
              <Copy className="w-3 h-3 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">{dup.title}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {dup.distance}m
              </span>
              <span className="text-[10px] text-warning font-medium">{dup.similarity}% match</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancel — Review Again
        </button>
        <button
          onClick={onProceed}
          className="flex-1 px-3 py-2 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors border border-warning/30"
        >
          {result.isSpam ? "Wait & Retry" : "Submit Anyway"}
        </button>
      </div>
    </div>
  );
};

export default DuplicateWarning;
