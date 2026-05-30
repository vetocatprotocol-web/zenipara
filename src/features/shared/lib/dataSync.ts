export type DataResource =
  | 'users'
  | 'tasks'
  | 'announcements'
  | 'messages'
  | 'attendance'
  | 'leave_requests'
  | 'logistics_requests'
  | 'logistics_items'
  | 'audit_logs'
  | 'gate_pass'
  | 'feature_flags';

const EVENT_NAME = 'karyo:data-sync';
const STORAGE_EVENT_KEY = 'karyo:data-sync:event';
const DATA_SYNC_CHANNEL = 'karyo_data_sync';

let dataSyncChannel: BroadcastChannel | null = null;

function getDataSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!dataSyncChannel) {
    dataSyncChannel = new BroadcastChannel(DATA_SYNC_CHANNEL);
  }
  return dataSyncChannel;
}

interface DataSyncDetail {
  resources: DataResource[];
}

interface SubscribeDataChangesOptions {
  debounceMs?: number;
}

function normalizeResources(resources: DataResource | DataResource[]): DataResource[] {
  return Array.from(new Set(Array.isArray(resources) ? resources : [resources]));
}

export function notifyDataChanged(resources: DataResource | DataResource[]): void {
  if (typeof window === 'undefined') return;
  const detail: DataSyncDetail = { resources: normalizeResources(resources) };

  // Same-tab listeners
  window.dispatchEvent(new CustomEvent<DataSyncDetail>(EVENT_NAME, { detail }));

  // Cross-tab sync via BroadcastChannel (modern browsers)
  const channel = getDataSyncChannel();
  if (channel) {
    channel.postMessage(detail);
  }

  // Cross-tab fallback via storage event
  try {
    localStorage.setItem(
      STORAGE_EVENT_KEY,
      JSON.stringify({ ...detail, ts: Date.now() }),
    );
    localStorage.removeItem(STORAGE_EVENT_KEY);
  } catch {
    // Ignore storage quota/access errors; same-tab event is already dispatched.
  }
}

export function subscribeDataChanges(
  resources: DataResource | DataResource[],
  callback: (changed: DataResource[]) => void,
  options?: SubscribeDataChangesOptions,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const watched = normalizeResources(resources);
  const debounceMs = Math.max(0, options?.debounceMs ?? 0);
  let timer: number | null = null;
  const pending = new Set<DataResource>();

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<DataSyncDetail>;
    const changed = customEvent.detail?.resources ?? [];
    if (changed.length === 0) return;
    const matched = changed.filter((r) => watched.includes(r));
    if (matched.length === 0) return;

    if (debounceMs === 0) {
      callback(matched);
      return;
    }

    matched.forEach((r) => pending.add(r));
    if (timer) return;

    timer = window.setTimeout(() => {
      timer = null;
      const flushed = Array.from(pending);
      pending.clear();
      callback(flushed);
    }, debounceMs);
  };

  const handleChangedResources = (changed: DataResource[]) => {
    const matched = changed.filter((r) => watched.includes(r));
    if (matched.length === 0) return;

    if (debounceMs === 0) {
      callback(matched);
      return;
    }

    matched.forEach((r) => pending.add(r));
    if (timer) return;

    timer = window.setTimeout(() => {
      timer = null;
      const flushed = Array.from(pending);
      pending.clear();
      callback(flushed);
    }, debounceMs);
  };

  const broadcastHandler = (event: MessageEvent<DataSyncDetail>) => {
    const changed = event.data?.resources ?? [];
    handleChangedResources(changed);
  };

  const storageHandler = (event: StorageEvent) => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as DataSyncDetail & { ts?: number };
      handleChangedResources(parsed.resources ?? []);
    } catch {
      // Ignore malformed payload
    }
  };

  const unsubscribe = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      pending.clear();
    }
    window.removeEventListener(EVENT_NAME, handler as EventListener);
    window.removeEventListener('storage', storageHandler);
    const channel = getDataSyncChannel();
    if (channel) {
      channel.removeEventListener('message', broadcastHandler as EventListener);
    }
  };

  window.addEventListener(EVENT_NAME, handler as EventListener);
  window.addEventListener('storage', storageHandler);
  const channel = getDataSyncChannel();
  if (channel) {
    channel.addEventListener('message', broadcastHandler as EventListener);
  }
  return unsubscribe;
}
