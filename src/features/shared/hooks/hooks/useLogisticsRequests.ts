import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchLogisticsRequests as apiFetchLogistics, insertLogisticsRequest, patchLogisticsRequestStatus } from '../lib/api/logistics';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { SimpleCache } from '../lib/cache';
import type { LogisticsRequest, LogisticsRequestStatus } from '../types';
import { useAuthStore } from '../store/authStore';

interface UseLogisticsRequestsOptions {
  satuan?: string;
  requestedBy?: string;
}

/** Module-level cache: data permintaan logistik di-cache 5 menit per kombinasi filter */
const logisticsCache = new SimpleCache<LogisticsRequest[]>();

function buildLogisticsKey(satuan?: string, requestedBy?: string): string {
  return JSON.stringify({ s: satuan ?? '', r: requestedBy ?? '' });
}

/** Hapus semua cache permintaan logistik — berguna untuk pengujian unit. */
export function clearLogisticsRequestsCache(): void {
  logisticsCache.clear();
}

export function useLogisticsRequests(options: UseLogisticsRequestsOptions = {}) {
  const { user } = useAuthStore();

  const cacheKey = useMemo(
    () => buildLogisticsKey(options.satuan, options.requestedBy),
    [options.satuan, options.requestedBy],
  );

  const [requests, setRequests] = useState<LogisticsRequest[]>(() => logisticsCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(() => !logisticsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (force = false) => {
    if (!user) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    if (!force) {
      const cached = logisticsCache.get(cacheKey);
      if (cached) {
        setRequests(cached);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetchLogistics({
        callerId: user.id,
        callerRole: user.role,
        satuan: options.satuan,
        requestedBy: options.requestedBy,
      });
      logisticsCache.set(cacheKey, data);
      setRequests(data);
    } catch (err) {
      setError(handleError(err, 'Gagal memuat permintaan logistik'));
    } finally {
      setIsLoading(false);
    }
  }, [user, cacheKey, options.satuan, options.requestedBy]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    return subscribeDataChanges('logistics_requests', () => {
      logisticsCache.invalidate(cacheKey);
      void fetchRequests(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchRequests]);

  // Realtime subscription
  // Gunakan ref agar tidak terjadi duplicate subscription
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNonceRef = useRef(`logistics-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!user) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`logistics-requests-changes-${channelNonceRef.current}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_requests' }, () => {
      logisticsCache.invalidate(cacheKey);
      void fetchRequests(true);
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, cacheKey, fetchRequests]);

  const submitRequest = async (data: {
    nama_item: string;
    jumlah: number;
    satuan_item?: string;
    alasan: string;
  }) => {
    if (!user) throw new Error('Not authenticated');
    await insertLogisticsRequest(user.id, user.role, { ...data, requested_by: user.id, satuan: user.satuan });
    logisticsCache.invalidate(cacheKey);
    notifyDataChanged('logistics_requests');
    await fetchRequests(true);
  };

  const reviewRequest = async (
    id: string,
    status: Extract<LogisticsRequestStatus, 'approved' | 'rejected'>,
    adminNote?: string,
  ) => {
    if (!user) throw new Error('Not authenticated');
    await patchLogisticsRequestStatus(user.id, user.role, id, status, user.id, adminNote);
    logisticsCache.invalidate(cacheKey);
    notifyDataChanged('logistics_requests');
    await fetchRequests(true);
  };

  return {
    requests,
    isLoading,
    error,
    refetch: () => fetchRequests(true),
    submitRequest,
    reviewRequest,
  };
}
