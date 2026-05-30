import { useCallback, useEffect, useRef } from 'react';

interface UseVisibilityAwareRefreshOptions {
  enabled?: boolean;
  intervalMs?: number;
}

type RefreshFn = () => Promise<unknown> | unknown;

/**
 * Menjalankan refresh secara hemat: pause saat tab hidden, lalu catch-up sekali
 * saat tab kembali aktif, serta mencegah refresh paralel yang menumpuk.
 */
export function useVisibilityAwareRefresh(
  refreshFn: RefreshFn,
  options: UseVisibilityAwareRefreshOptions = {},
) {
  const { enabled = true, intervalMs } = options;
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const runRefresh = useCallback(async () => {
    if (!enabled) return false;

    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return false;
    }

    isRefreshingRef.current = true;

    try {
      await refreshFn();
      return true;
    } finally {
      isRefreshingRef.current = false;

      if (
        pendingRefreshRef.current
        && (typeof document === 'undefined' || document.visibilityState === 'visible')
      ) {
        pendingRefreshRef.current = false;
        void runRefresh();
      }
    }
  }, [enabled, refreshFn]);

  const requestRefresh = useCallback(() => {
    if (!enabled) return;

    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      pendingRefreshRef.current = true;
      return;
    }

    void runRefresh();
  }, [enabled, runRefresh]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pendingRefreshRef.current) return;

      pendingRefreshRef.current = false;
      void runRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [runRefresh]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        pendingRefreshRef.current = true;
        return;
      }

      void runRefresh();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, runRefresh]);

  return {
    runRefresh,
    requestRefresh,
  };
}
