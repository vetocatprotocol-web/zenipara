/**
 * useOfflineSync Hook
 * Manages offline state, sync coordination, and queue monitoring
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPendingOperations,
  getQueueStats,
} from '../lib/offline/offlineStore';

interface UseOfflineSyncOptions {
  onOnlineStatusChange?: (isOnline: boolean) => void;
  onSyncComplete?: (stats: SyncStats) => void;
  autoSync?: boolean; // Default: true
}

interface SyncStats {
  pending: number;
  failed: number;
  synced: number;
  total: number;
  oldestPendingAge: number | null;
}

const MIN_SYNCING_MS = 900;
const DUPLICATE_SYNC_COMPLETE_WINDOW_MS = 800;

function areSyncStatsEqual(a: SyncStats, b: SyncStats): boolean {
  return (
    a.pending === b.pending
    && a.failed === b.failed
    && a.synced === b.synced
    && a.total === b.total
    && a.oldestPendingAge === b.oldestPendingAge
  );
}

/**
 * Hook for managing offline synchronization
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const { onOnlineStatusChange, onSyncComplete, autoSync = true } = options;

  const [isOnline, setIsOnline] = useState(true);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    pending: 0,
    failed: 0,
    synced: 0,
    total: 0,
    oldestPendingAge: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const swRef = useRef<ServiceWorkerContainer | null>(null);
  const syncStatsRef = useRef(syncStats);
  const isSyncingRef = useRef(isSyncing);
  const isMountedRef = useRef(true);
  const onOnlineStatusChangeRef = useRef(onOnlineStatusChange);
  const onSyncCompleteRef = useRef(onSyncComplete);
  const syncStartedAtRef = useRef<number | null>(null);
  const stopSyncTimerRef = useRef<number | null>(null);
  const syncCompleteAtRef = useRef(0);
  const checkOnlineTimeoutRef = useRef<number | null>(null);
  const updateStatsInFlightRef = useRef(false);

  const clearStopSyncTimer = useCallback(() => {
    if (stopSyncTimerRef.current !== null) {
      window.clearTimeout(stopSyncTimerRef.current);
      stopSyncTimerRef.current = null;
    }
  }, []);

  const finishSyncing = useCallback(() => {
    const startedAt = syncStartedAtRef.current;
    const elapsed = startedAt ? Date.now() - startedAt : MIN_SYNCING_MS;
    const remaining = Math.max(0, MIN_SYNCING_MS - elapsed);

    clearStopSyncTimer();
    stopSyncTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      isSyncingRef.current = false;
      setIsSyncing(false);
      stopSyncTimerRef.current = null;
    }, remaining);
  }, [clearStopSyncTimer]);

  const startSyncing = useCallback(() => {
    syncStartedAtRef.current = Date.now();
    clearStopSyncTimer();
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      setIsSyncing(true);
    }
  }, [clearStopSyncTimer]);

  const setOnlineStable = useCallback((nextOnline: boolean) => {
    setIsOnline((prev) => (prev === nextOnline ? prev : nextOnline));
  }, []);

  const updateSyncStats = useCallback(async () => {
    if (updateStatsInFlightRef.current) return;
    updateStatsInFlightRef.current = true;
    try {
      const stats = await getQueueStats();
      setSyncStats((prev) => (areSyncStatsEqual(prev, stats) ? prev : stats));
    } catch (error) {
      console.error('[useOfflineSync] Failed to get queue stats:', error);
    } finally {
      updateStatsInFlightRef.current = false;
    }
  }, []);

  const handleSyncComplete = useCallback(() => {
    const now = Date.now();
    if (now - syncCompleteAtRef.current < DUPLICATE_SYNC_COMPLETE_WINDOW_MS) {
      return;
    }
    syncCompleteAtRef.current = now;
    finishSyncing();
    setLastSyncTime(now);
    void updateSyncStats().then(() => {
      onSyncCompleteRef.current?.(syncStatsRef.current);
    });
  }, [finishSyncing, updateSyncStats]);

  useEffect(() => {
    syncStatsRef.current = syncStats;
  }, [syncStats]);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  useEffect(() => {
    onOnlineStatusChangeRef.current = onOnlineStatusChange;
  }, [onOnlineStatusChange]);

  useEffect(() => {
    onSyncCompleteRef.current = onSyncComplete;
  }, [onSyncComplete]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearStopSyncTimer();
      if (checkOnlineTimeoutRef.current !== null) {
        window.clearTimeout(checkOnlineTimeoutRef.current);
      }
    };
  }, [clearStopSyncTimer]);

  const checkOnlineStatus = useCallback(async (): Promise<boolean> => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      const fallbackOnline = navigator.onLine;
      setOnlineStable(fallbackOnline);
      return fallbackOnline;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      let resolved = false;

      const finish = (value: boolean) => {
        if (resolved) return;
        resolved = true;
        if (checkOnlineTimeoutRef.current !== null) {
          window.clearTimeout(checkOnlineTimeoutRef.current);
          checkOnlineTimeoutRef.current = null;
        }
        setOnlineStable(value);
        resolve(value);
      };

      channel.port1.onmessage = (event) => {
        finish(event.data.isOnline ?? navigator.onLine);
      };

      controller.postMessage(
        { type: 'CHECK_OFFLINE_STATUS' },
        [channel.port2]
      );

      checkOnlineTimeoutRef.current = window.setTimeout(() => {
        finish(navigator.onLine);
      }, 2000);
    });
  }, [setOnlineStable]);

  const requestSync = useCallback(async () => {
    if (isSyncingRef.current || !isOnline) return;

    startSyncing();

    try {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const channel = new MessageChannel();
        controller.postMessage(
          { type: 'SYNC_NOW' },
          [channel.port2]
        );

        channel.port1.onmessage = (event) => {
          if (event.data.type === 'SYNC_COMPLETE') {
            handleSyncComplete();
          } else {
            finishSyncing();
          }
        };

        window.setTimeout(() => {
          finishSyncing();
        }, 30000);
      } else {
        finishSyncing();
      }
    } catch (error) {
      console.error('[useOfflineSync] Sync request failed:', error);
      finishSyncing();
    }
  }, [finishSyncing, handleSyncComplete, isOnline, startSyncing]);

  /**
   * Initialize service worker communication
   */
  useEffect(() => {
    const initServiceWorker = async () => {
      if (!navigator.serviceWorker) return;

      swRef.current = navigator.serviceWorker;

      // Listen for messages from service worker
      swRef.current.controller?.postMessage({ type: 'CHECK_OFFLINE_STATUS' });

      const onMessage = (event: MessageEvent) => {
        const { type, isOnline: swIsOnline } = event.data;

        if (type === 'ONLINE_STATUS_CHANGED') {
          setOnlineStable(swIsOnline);
          onOnlineStatusChangeRef.current?.(swIsOnline);

          if (swIsOnline && autoSync) {
            void requestSync();
          }
        }

        if (type === 'SYNC_COMPLETE') {
          handleSyncComplete();
        }
      };

      navigator.serviceWorker?.addEventListener('message', onMessage);

      // Check initial online status
      await checkOnlineStatus();
      await updateSyncStats();

      return () => {
        navigator.serviceWorker?.removeEventListener('message', onMessage);
      };
    };

    let cleanup: (() => void) | undefined;
    void initServiceWorker().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [autoSync, checkOnlineStatus, handleSyncComplete, requestSync, setOnlineStable, updateSyncStats]);

  useEffect(() => {
    let timer: number | null = null;
    let canceled = false;

    const schedule = () => {
      if (canceled) return;
      const busy = syncStatsRef.current.pending > 0 || syncStatsRef.current.failed > 0;
      const nextMs = busy ? 8000 : 30000;
      timer = window.setTimeout(async () => {
        await updateSyncStats();
        schedule();
      }, nextMs);
    };

    schedule();

    return () => {
      canceled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [updateSyncStats]);

  /**
   * Get pending operations
   */
  const getPendingOps = async () => {
    return getPendingOperations();
  };

  /**
   * Check if should show offline indicator
   */
  const shouldShowOfflineIndicator = (): boolean => {
    return !isOnline || (syncStats.pending > 0 && syncStats.pending <= 5);
  };

  /**
   * Format last sync time for display
   */
  const getLastSyncTimeFormatted = (): string => {
    if (!lastSyncTime) return 'Belum pernah disinkronkan';

    const now = Date.now();
    const diff = now - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} hari terakhir`;
    if (hours > 0) return `${hours} jam terakhir`;
    if (minutes > 0) return `${minutes} menit terakhir`;
    return 'Baru saja';
  };

  return {
    isOnline,
    isSyncing,
    syncStats,
    lastSyncTime,
    checkOnlineStatus,
    requestSync,
    getPendingOps,
    updateSyncStats,
    shouldShowOfflineIndicator,
    getLastSyncTimeFormatted,
  };
}

/**
 * Hook for offline operation queueing
 */
export function useOfflineQueue() {
  const swRef = useRef<ServiceWorkerContainer | null>(null);

  useEffect(() => {
    if (navigator.serviceWorker) {
      swRef.current = navigator.serviceWorker;
    }
  }, []);

  /**
   * Queue offline operation in service worker and IndexedDB
   */
  const queueOperation = async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    _data?: Record<string, unknown>,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!swRef.current?.controller) {
        reject(new Error('Service Worker not available'));
        return;
      }

      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.timestamp?.toString() || 'queued');
        } else {
          reject(new Error('Failed to queue operation'));
        }
      };

      swRef.current!.controller!.postMessage(
        {
          type: 'QUEUE_OPERATION',
          payload: {
            endpoint,
            method,
            data: _data,
            id: crypto.randomUUID(),
            status: 'pending',
            max_retries: 5,
          },
        },
        [channel.port2]
      );

      // Timeout
      setTimeout(() => {
        reject(new Error('Queue operation timeout'));
      }, 5000);
    });
  };

  /**
   * Get pending operations from service worker
   */
  const getPendingOperations = async (): Promise<{ id: string; endpoint: string; status: string }[]> => {
    return new Promise((resolve) => {
      if (!swRef.current?.controller) {
        resolve([]);
        return;
      }

      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        resolve(event.data.operations || []);
      };

      swRef.current.controller!.postMessage({ type: 'GET_PENDING_OPS' }, [channel.port2]);

      // Timeout
      setTimeout(() => {
        resolve([]);
      }, 2000);
    });
  };

  return {
    queueOperation,
    getPendingOperations,
  };
}
