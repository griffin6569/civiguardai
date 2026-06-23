/**
 * CiviGuard AI — Background Sync Engine
 * Processes queued offline reports when connectivity returns.
 */

import { supabase } from "@/integrations/supabase/client";
import { getSyncQueue, updateSyncItem, removeSyncItem, onOnlineStatusChange, type SyncQueueItem } from "./offlineStore";

const MAX_RETRIES = 5;
let isSyncing = false;
let listeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  isSyncing: boolean;
  pending: number;
  failed: number;
  lastSyncAt: number | null;
}

function notify(status: SyncStatus) {
  listeners.forEach((l) => l(status));
}

export function onSyncStatusChange(cb: (s: SyncStatus) => void): () => void {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

async function syncItem(item: SyncQueueItem): Promise<boolean> {
  try {
    await updateSyncItem(item.id, { status: "syncing" });

    const { payload, imageBlob } = item;
    let image_url: string | null = null;

    // Upload image if exists
    if (imageBlob) {
      const fileName = `${Date.now()}-offline-${item.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("report-images")
        .upload(fileName, imageBlob);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("report-images").getPublicUrl(fileName);
      image_url = urlData.publicUrl;
    }

    const insertPayload = {
      ...payload,
      image_url: image_url || payload.image_url || null,
    };
    const { error } = await supabase.from("reports").insert(insertPayload as any);

    if (error) throw error;

    await removeSyncItem(item.id);
    return true;
  } catch (err: any) {
    const retryCount = item.retryCount + 1;
    if (retryCount >= MAX_RETRIES) {
      await updateSyncItem(item.id, { status: "failed", retryCount, errorMessage: err.message || "Max retries exceeded" });
    } else {
      await updateSyncItem(item.id, { status: "pending", retryCount, errorMessage: err.message });
    }
    return false;
  }
}

export async function processSyncQueue(): Promise<SyncStatus> {
  if (isSyncing || !navigator.onLine) {
    const queue = await getSyncQueue();
    return { isSyncing, pending: queue.filter((q) => q.status === "pending").length, failed: queue.filter((q) => q.status === "failed").length, lastSyncAt: null };
  }

  isSyncing = true;
  const queue = await getSyncQueue();
  const pending = queue.filter((q) => q.status === "pending" || (q.status === "failed" && q.retryCount < MAX_RETRIES));

  notify({ isSyncing: true, pending: pending.length, failed: queue.filter((q) => q.status === "failed" && q.retryCount >= MAX_RETRIES).length, lastSyncAt: null });

  for (const item of pending) {
    await syncItem(item);
    // Small delay between syncs
    await new Promise((r) => setTimeout(r, 500));
  }

  isSyncing = false;
  const updatedQueue = await getSyncQueue();
  const status: SyncStatus = {
    isSyncing: false,
    pending: updatedQueue.filter((q) => q.status === "pending").length,
    failed: updatedQueue.filter((q) => q.status === "failed").length,
    lastSyncAt: Date.now(),
  };
  notify(status);
  return status;
}

// Auto-sync when coming back online
let cleanupFn: (() => void) | null = null;
export function startAutoSync() {
  if (cleanupFn) return;
  cleanupFn = onOnlineStatusChange((online) => {
    if (online) {
      setTimeout(() => processSyncQueue(), 1000);
    }
  });
  // Initial check
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 2000);
  }
}
