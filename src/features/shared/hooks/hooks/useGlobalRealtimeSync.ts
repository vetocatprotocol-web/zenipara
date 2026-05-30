import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { notifyDataChanged, type DataResource } from '../lib/dataSync';
import { useAuthStore } from '../store/authStore';

const REALTIME_FLUSH_DEBOUNCE_MS = 240;

const realtimeTableMap: Array<{ table: string; resource: DataResource }> = [
  { table: 'users', resource: 'users' },
  { table: 'tasks', resource: 'tasks' },
  { table: 'announcements', resource: 'announcements' },
  { table: 'messages', resource: 'messages' },
  { table: 'attendance', resource: 'attendance' },
  { table: 'leave_requests', resource: 'leave_requests' },
  { table: 'logistics_requests', resource: 'logistics_requests' },
  { table: 'logistics_items', resource: 'logistics_items' },
  { table: 'audit_logs', resource: 'audit_logs' },
  { table: 'gate_pass', resource: 'gate_pass' },
  { table: 'system_feature_flags', resource: 'feature_flags' },
];

export function useGlobalRealtimeSync() {
  const hasUser = useAuthStore((s) => Boolean(s.user));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNonceRef = useRef(`global-sync-${Math.random().toString(36).slice(2, 10)}`);
  const pendingResourcesRef = useRef<Set<DataResource>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const flushPendingResources = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (pendingResourcesRef.current.size === 0) return;

    const resources = Array.from(pendingResourcesRef.current);
    pendingResourcesRef.current.clear();
    notifyDataChanged(resources);
  };

  useEffect(() => {
    let disposed = false;

    const clearReconnectTimer = () => {
      if (!reconnectTimerRef.current) return;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const removeCurrentChannel = () => {
      if (!channelRef.current) return;
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };

    const scheduleReconnect = () => {
      if (disposed || !hasUser || reconnectTimerRef.current) return;

      removeCurrentChannel();
      const delay = Math.min(5000, 500 * (2 ** reconnectAttemptRef.current));
      reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, 6);

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        subscribeChannel();
      }, delay);
    };

    const subscribeChannel = () => {
      if (disposed || !hasUser) return;

      removeCurrentChannel();
      const channel = supabase.channel(channelNonceRef.current);

      for (const { table, resource } of realtimeTableMap) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          pendingResourcesRef.current.add(resource);
          if (flushTimerRef.current) return;

          flushTimerRef.current = setTimeout(() => {
            flushPendingResources();
          }, REALTIME_FLUSH_DEBOUNCE_MS);
        });
      }

      channel.subscribe((status) => {
        if (disposed) return;

        if (status === 'SUBSCRIBED') {
          reconnectAttemptRef.current = 0;
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (import.meta.env.DEV) {
            console.warn('[Realtime] Global sync reconnect triggered:', status);
          }
          scheduleReconnect();
        }
      });

      channelRef.current = channel;
    };

    if (!hasUser) {
      clearReconnectTimer();
      removeCurrentChannel();
      flushPendingResources();
      return () => {
        disposed = true;
      };
    }

    subscribeChannel();

    return () => {
      disposed = true;
      clearReconnectTimer();
      flushPendingResources();
      removeCurrentChannel();
    };
  }, [hasUser]);
}
