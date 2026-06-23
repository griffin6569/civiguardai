/**
 * CiviGuard AI — Offline Status Banner
 * Shows network status and sync queue information.
 */

import { useState, useEffect } from "react";
import { WifiOff, Wifi, Cloud, Loader2 } from "lucide-react";
import { isOnline, onOnlineStatusChange, getSyncQueue } from "@/lib/offlineStore";
import { processSyncQueue, onSyncStatusChange, type SyncStatus } from "@/lib/syncEngine";

const OfflineBanner = () => {
  const [online, setOnline] = useState(isOnline());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isSyncing: false, pending: 0, failed: 0, lastSyncAt: null });
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const cleanup1 = onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      setShowBanner(true);
      if (isOnline) {
        setTimeout(() => setShowBanner(false), 5000);
      }
    });

    const cleanup2 = onSyncStatusChange(setSyncStatus);

    // Check initial queue
    getSyncQueue().then((queue) => {
      if (queue.length > 0) {
        setSyncStatus({
          isSyncing: false,
          pending: queue.filter((q) => q.status === "pending").length,
          failed: queue.filter((q) => q.status === "failed").length,
          lastSyncAt: null,
        });
        setShowBanner(true);
      }
    });

    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => { cleanup1(); cleanup2(); };
  }, []);

  if (!showBanner && online && syncStatus.pending === 0 && syncStatus.failed === 0) return null;

  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 rounded-xl border p-3 backdrop-blur-md transition-all ${
      !online ? "bg-destructive/10 border-destructive/30" : syncStatus.isSyncing ? "bg-primary/10 border-primary/30" : syncStatus.pending > 0 ? "bg-warning/10 border-warning/30" : "bg-safe/10 border-safe/30"
    }`}>
      <div className="flex items-center gap-2">
        {!online ? (
          <>
            <WifiOff className="w-4 h-4 text-destructive" />
            <div>
              <p className="text-xs font-medium text-destructive">You're offline</p>
              <p className="text-[10px] text-muted-foreground">Reports will be saved locally and synced when you're back online.</p>
            </div>
          </>
        ) : syncStatus.isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <div>
              <p className="text-xs font-medium text-primary">Syncing reports...</p>
              <p className="text-[10px] text-muted-foreground">{syncStatus.pending} report(s) uploading</p>
            </div>
          </>
        ) : syncStatus.pending > 0 ? (
          <>
            <Cloud className="w-4 h-4 text-warning" />
            <div className="flex-1">
              <p className="text-xs font-medium text-warning">{syncStatus.pending} report(s) queued</p>
              <p className="text-[10px] text-muted-foreground">
                {syncStatus.failed > 0 && `${syncStatus.failed} failed. `}
                <button onClick={() => processSyncQueue()} className="text-primary underline">Retry now</button>
              </p>
            </div>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 text-safe" />
            <div className="flex-1">
              <p className="text-xs font-medium text-safe">Back online</p>
              <p className="text-[10px] text-muted-foreground">All reports synced successfully.</p>
            </div>
            <button onClick={() => setShowBanner(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
