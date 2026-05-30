import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchAuditLogs as apiFetchAuditLogs } from '../lib/api/auditLogs';
import { handleError } from '../lib/handleError';
import { subscribeDataChanges } from '../lib/dataSync';
import { supabase } from '../lib/supabase';
import { SimpleCache } from '../lib/cache';
import type { AuditLog } from '../types';
import { useAuthStore } from '../store/authStore';

interface UseAuditLogsOptions {
  userId?: string;
  action?: string;
  limit?: number;
}

/** Module-level cache: audit log di-cache 5 menit per kombinasi filter */
const auditLogsCache = new SimpleCache<AuditLog[]>();

function buildAuditKey(userId?: string, action?: string, limit?: number): string {
  return JSON.stringify({ u: userId ?? '', a: action ?? '', l: limit ?? 0 });
}

/** Hapus semua cache audit log — berguna untuk pengujian unit. */
export function clearAuditLogsCache(): void {
  auditLogsCache.clear();
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { user } = useAuthStore();

  const cacheKey = useMemo(
    () => buildAuditKey(options.userId, options.action, options.limit),
    [options.userId, options.action, options.limit],
  );

  const [logs, setLogs] = useState<AuditLog[]>(() => auditLogsCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(() => !auditLogsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchLogsRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  const fetchLogs = useCallback(async (force = false) => {
    if (!user) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      if (force) refreshQueuedRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    if (!force) {
      const cached = auditLogsCache.get(cacheKey);
      if (cached) {
        setLogs(cached);
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetchAuditLogs({
        callerId: user.id,
        callerRole: user.role,
        userId: options.userId,
        action: options.action,
        limit: options.limit,
      });
      auditLogsCache.set(cacheKey, data);
      setLogs(data);
    } catch (err) {
      setError(handleError(err, 'Gagal memuat audit log'));
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void fetchLogsRef.current?.(true);
      }
    }
  }, [user, cacheKey, options.userId, options.action, options.limit]);

  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
  }, [fetchLogs]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    return subscribeDataChanges(['audit_logs', 'users', 'tasks', 'gate_pass'], () => {
      auditLogsCache.invalidate(cacheKey);
      void fetchLogs(true);
    }, { debounceMs: 260 });
  }, [cacheKey, fetchLogs]);

  useEffect(() => {
    if (!user) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`audit-logs-changes-${user.id}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
      auditLogsCache.invalidate(cacheKey);
      void fetchLogs(true);
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, cacheKey, fetchLogs]);

  return { logs, isLoading, error, refetch: () => fetchLogs(true) };
}
