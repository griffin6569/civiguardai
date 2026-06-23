import { useMemo, useRef, useState } from "react";
import { Bluetooth, Download, FileUp, Loader2, Radio, Share2, Shield, WifiOff } from "lucide-react";
import {
  exportRelayPacket,
  importRelayPacketFromFile,
  type SyncQueueItem,
} from "@/lib/offlineStore";
import { processSyncQueue } from "@/lib/syncEngine";

type AegisLinkPanelProps = {
  queueItems: SyncQueueItem[];
  onImported?: () => Promise<void> | void;
  onExported?: () => Promise<void> | void;
};

const AegisLinkPanel = ({ queueItems, onImported, onExported }: AegisLinkPanelProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Relay packets let reports hop phone-to-phone until one device gets online.");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const latestQueueItem = useMemo(
    () => [...queueItems].sort((a, b) => b.createdAt - a.createdAt)[0],
    [queueItems],
  );

  const canShareFiles =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator;

  const handleExport = async () => {
    if (!latestQueueItem || isExporting) return;
    setIsExporting(true);

    try {
      const { packet, blob, filename } = await exportRelayPacket(latestQueueItem);
      const file = new File([blob], filename, { type: "application/json" });

      if (canShareFiles) {
        const nav = navigator as Navigator & {
          share?: (data: ShareData) => Promise<void>;
          canShare?: (data: ShareData) => boolean;
        };

        const shareData: ShareData = {
          files: [file],
          title: "CiviGuard AegisLink Relay Packet",
          text: `Relay packet for ${packet.reportTitle}`,
        };

        if (nav.canShare?.(shareData)) {
          await nav.share?.(shareData);
          setStatusMessage("Relay packet opened in your device share sheet. Nearby Share, Bluetooth, or AirDrop can carry it onward.");
          await onExported?.();
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      setStatusMessage("Relay packet downloaded. Move it to another phone by Bluetooth, Nearby Share, AirDrop, SD card, or USB.");
      await onExported?.();
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const packet = await importRelayPacketFromFile(file);
      await onImported?.();
      await processSyncQueue();
      setStatusMessage(`Imported relay packet "${packet.reportTitle}" with hop count ${packet.hopCount}.`);
    } catch {
      setStatusMessage("Could not import that relay packet. Make sure it is a valid CiviGuard AegisLink file.");
    } finally {
      event.target.value = "";
      setIsImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-foreground">AegisLink Mode</h3>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Offline Relay
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When there is no internet, reports can be packaged for device-to-device relay. A nearby phone can import the packet and sync it once connectivity returns.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-foreground">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            Native share handoff
          </div>
          <p className="mt-1">Uses your phone share sheet for Nearby Share, AirDrop, Bluetooth, or file transfer apps when available.</p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Multi-hop ready
          </div>
          <p className="mt-1">Imported packets increment hop count so the report can continue traveling until one device gets online.</p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-foreground">
            <Bluetooth className="h-3.5 w-3.5 text-primary" />
            Browser-safe fallback
          </div>
          <p className="mt-1">Browsers cannot run a full Bluetooth or Wi-Fi Direct mesh directly, so the packet rides over OS-level sharing and file transfer.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 text-warning">
          <WifiOff className="h-3.5 w-3.5" />
          Relay packet status
        </div>
        <p className="mt-1">{statusMessage}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleExport}
          disabled={!latestQueueItem || isExporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {canShareFiles ? "Share latest relay packet" : "Download latest relay packet"}
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          disabled={isImporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Import relay packet
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.civiguard-relay.json,application/json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default AegisLinkPanel;
