/**
 * CiviGuard AI — Offline-First Reporting Module
 * Uses IndexedDB for draft storage and sync queue management.
 */

const DB_NAME = "civiguard_offline";
const DB_VERSION = 2;
const DRAFTS_STORE = "report_drafts";
const SYNC_QUEUE = "sync_queue";
const RELAY_PACKETS_STORE = "relay_packets";

const getDeviceId = () => {
  const storageKey = "civiguard_device_id";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(storageKey, generated);
  return generated;
};

interface OfflineDraft {
  id: string;
  form: Record<string, any>;
  imageBlob?: Blob;
  imagePreview?: string;
  aiAnalysis?: any;
  createdAt: number;
  updatedAt: number;
}

interface SyncQueueItem {
  id: string;
  payload: Record<string, any>;
  imageBlob?: Blob;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  errorMessage?: string;
  createdAt: number;
  relayId?: string;
  originDeviceId?: string;
  lastRelayAt?: number;
  hopCount?: number;
  transportMode?: "direct" | "relay" | "imported";
}

interface RelayPacket {
  id: string;
  reportTitle: string;
  createdAt: number;
  originDeviceId: string;
  hopCount: number;
  payload: Record<string, any>;
  imageBase64?: string;
  imageMimeType?: string;
  relayChain: Array<{
    deviceId: string;
    timestamp: number;
    transport: "share" | "import" | "direct";
  }>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
        db.createObjectStore(SYNC_QUEUE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(RELAY_PACKETS_STORE)) {
        db.createObjectStore(RELAY_PACKETS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ══════ DRAFTS ══════

export async function saveDraft(draft: OfflineDraft): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, "readwrite");
    tx.objectStore(DRAFTS_STORE).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDrafts(): Promise<OfflineDraft[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, "readonly");
    const req = tx.objectStore(DRAFTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, "readwrite");
    tx.objectStore(DRAFTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ══════ SYNC QUEUE ══════

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).put({
      originDeviceId: getDeviceId(),
      hopCount: 0,
      transportMode: "direct",
      ...item,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readonly");
    const req = tx.objectStore(SYNC_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateSyncItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// AEGISLINK RELAY PACKETS

export async function saveRelayPacket(packet: RelayPacket): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RELAY_PACKETS_STORE, "readwrite");
    tx.objectStore(RELAY_PACKETS_STORE).put(packet);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRelayPackets(): Promise<RelayPacket[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RELAY_PACKETS_STORE, "readonly");
    const req = tx.objectStore(RELAY_PACKETS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeRelayPacket(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RELAY_PACKETS_STORE, "readwrite");
    tx.objectStore(RELAY_PACKETS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const blobToBase64 = async (blob: Blob): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const base64ToBlob = async (base64: string, mimeType?: string): Promise<Blob> => {
  const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
};

export async function createRelayPacketFromSyncItem(item: SyncQueueItem): Promise<RelayPacket> {
  return {
    id: item.relayId || `relay-${Date.now()}`,
    reportTitle: String(item.payload?.title || "Untitled Report"),
    createdAt: Date.now(),
    originDeviceId: item.originDeviceId || getDeviceId(),
    hopCount: item.hopCount || 0,
    payload: item.payload,
    imageBase64: item.imageBlob ? await blobToBase64(item.imageBlob) : undefined,
    imageMimeType: item.imageBlob?.type,
    relayChain: [
      {
        deviceId: getDeviceId(),
        timestamp: Date.now(),
        transport: "share",
      },
    ],
  };
}

export async function exportRelayPacket(item: SyncQueueItem): Promise<{ packet: RelayPacket; blob: Blob; filename: string }> {
  const packet = await createRelayPacketFromSyncItem(item);
  await saveRelayPacket(packet);
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const filename = `${packet.id}.civiguard-relay.json`;
  return { packet, blob, filename };
}

export async function importRelayPacketFromFile(file: File): Promise<RelayPacket> {
  const text = await file.text();
  const parsed = JSON.parse(text) as RelayPacket;
  const updatedPacket: RelayPacket = {
    ...parsed,
    hopCount: (parsed.hopCount || 0) + 1,
    relayChain: [
      ...(parsed.relayChain || []),
      {
        deviceId: getDeviceId(),
        timestamp: Date.now(),
        transport: "import",
      },
    ],
  };

  const syncQueueItem: SyncQueueItem = {
    id: `sync-import-${Date.now()}`,
    payload: updatedPacket.payload,
    imageBlob: updatedPacket.imageBase64
      ? await base64ToBlob(updatedPacket.imageBase64, updatedPacket.imageMimeType)
      : undefined,
    status: "pending",
    retryCount: 0,
    createdAt: Date.now(),
    relayId: updatedPacket.id,
    originDeviceId: updatedPacket.originDeviceId,
    hopCount: updatedPacket.hopCount,
    lastRelayAt: Date.now(),
    transportMode: "imported",
  };

  await addToSyncQueue(syncQueueItem);
  await saveRelayPacket(updatedPacket);

  return updatedPacket;
}

// ══════ ONLINE STATUS ══════

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

export { getDeviceId };
export type { OfflineDraft, SyncQueueItem, RelayPacket };
