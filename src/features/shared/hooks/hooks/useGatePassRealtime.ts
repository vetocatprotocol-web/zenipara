import { useEffect, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useGatePassStore } from '../store/gatePassStore';
import { debounce } from '../lib/debounce';

interface UseGatePassRealtimeOptions {
  enabled?: boolean;
}

/**
 * Subscribes to real-time gate_pass table changes and syncs the store.
 *
 * Mount this hook in any page that displays gate pass data to keep it live.
 * The subscription is automatically cleaned up when the component unmounts.
 * 
 * Optimization:
 * - Debounced fetch (900ms) to prevent thrashing from multiple rapid updates
 * - Only subscribes to status changes (INSERT, UPDATE on specific columns)
 */
export function useGatePassRealtime(options: UseGatePassRealtimeOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuthStore();
  const fetchGatePasses = useGatePassStore((s) => s.fetchGatePasses);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNonceRef = useRef(`gate-pass-${Math.random().toString(36).slice(2, 10)}`);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pendingRefreshWhileHiddenRef = useRef(false);

  const debouncedFetch = useMemo(
    () => debounce(() => {
      void fetchGatePasses({ suppressErrors: true });
    }, 900),
    [fetchGatePasses],
  );

  useEffect(() => {
    if (!enabled) {
      return () => undefined;
    }

    let disposed = false;

    const clearReconnectTimer = () => {
      if (!reconnectTimerRef.current) return;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const removeCurrentChannel = () => {
      if (!channelRef.current) return;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };

    const scheduleReconnect = () => {
      if (disposed || !user || reconnectTimerRef.current) return;

      removeCurrentChannel();
      const delay = Math.min(5000, 500 * (2 ** reconnectAttemptRef.current));
      reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, 6);

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        subscribeChannel();
      }, delay);
    };

    const subscribeChannel = () => {
      if (disposed || !user) return;

      removeCurrentChannel();

      const channel = supabase
        .channel(`gate-pass-realtime-${user.id}-${channelNonceRef.current}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'gate_pass',
          },
          () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
              pendingRefreshWhileHiddenRef.current = true;
              return;
            }

            // Use debounced fetch to prevent multiple rapid updates
            debouncedFetch();
          },
        )
        .subscribe((status) => {
          if (disposed) return;

          if (status === 'SUBSCRIBED') {
            reconnectAttemptRef.current = 0;
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (import.meta.env.DEV) {
              console.warn('[Realtime] Gate pass reconnect triggered:', status);
            }
            scheduleReconnect();
          }
        });

      channelRef.current = channel;
    };

    if (!user) {
      clearReconnectTimer();
      removeCurrentChannel();
      return () => {
        disposed = true;
      };
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pendingRefreshWhileHiddenRef.current) return;

      pendingRefreshWhileHiddenRef.current = false;
      debouncedFetch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    subscribeChannel();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearReconnectTimer();
      removeCurrentChannel();
    };
  }, [enabled, user, debouncedFetch]);
}
