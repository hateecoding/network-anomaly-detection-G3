export type SyncStatus = "syncing" | "success" | "error";

export type SyncCallbacks = {
  onSyncSuccess: (syncedAt?: Date) => void;
  onSyncFailure: () => void;
};

export const STANDARD_SYNC_INTERVAL_MS = 30_000;
export const LIVE_SYNC_INTERVAL_MS = 5_000;
