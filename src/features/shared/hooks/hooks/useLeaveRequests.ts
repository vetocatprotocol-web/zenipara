import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchLeaveRequests as apiFetchLeaveRequests, insertLeaveRequest, patchLeaveRequestStatus } from '../lib/api/leaveRequests';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { supabase } from '../lib/supabase';
import { SimpleCache } from '../lib/cache';
import type { LeaveRequest, LeaveStatus } from '../types';
import { useAuthStore } from '../store/authStore';

interface UseLeaveRequestsOptions {
  userId?: string;
  satuan?: string;
}

/** Module-level cache: data permintaan izin di-cache 5 menit per kombinasi filter */
const leaveRequestsCache = new SimpleCache<LeaveRequest[]>();

function buildLeaveKey(userId?: string, satuan?: string): string {
  return JSON.stringify({ u: userId ?? '', s: satuan ?? '' });
}

/** Hapus semua cache permintaan izin — berguna untuk pengujian unit. */
export function clearLeaveRequestsCache(): void {
  leaveRequestsCache.clear();
}

export function useLeaveRequests(options: UseLeaveRequestsOptions = {}) {
  const { user } = useAuthStore();

  // Request coalescing: prevent duplicate simultaneous fetches when realtime burst occurs
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchRequestsRef = useRef<(() => Promise<void>) | null>(null);

  const cacheKey = useMemo(
    () => buildLeaveKey(options.userId, options.satuan),
    [options.userId, options.satuan],
  );

  const [requests, setRequests] = useState<LeaveRequest[]>(() => leaveRequestsCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(() => !leaveRequestsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchRequests = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    if (!force) {
      const cached = leaveRequestsCache.get(cacheKey);
      if (cached) {
        setRequests(cached);
        setIsLoading(false);
        return;
      }
    }
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      let result = await apiFetchLeaveRequests({
        callerId: user.id,
        callerRole: user.role,
        userId: options.userId,
      });

      // Filter by satuan if specified (via joined user data)
      if (options.satuan) {
        result = result.filter((r) => r.user?.satuan === options.satuan);
      }

      leaveRequestsCache.set(cacheKey, result);
      setRequests(result);
    } catch (err) {
      setError(handleError(err, 'Gagal memuat permintaan izin'));
    } finally {
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchRequestsRef.current?.();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, cacheKey, options.userId, options.satuan]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    return subscribeDataChanges('leave_requests', () => {
      leaveRequestsCache.invalidate(cacheKey);
      void fetchRequests(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchRequests]);

  useEffect(() => {
    if (!user) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`leave-requests-changes-${user.id}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
      leaveRequestsCache.invalidate(cacheKey);
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

  /**
   * Sync the current fetchRequests function to the ref so queued refreshes
   * have access to the latest version with updated dependencies.
   */
  useEffect(() => {
    fetchRequestsRef.current = fetchRequests;
  }, [fetchRequests]);

  const submitLeaveRequest = async (data: {
    jenis_izin: 'cuti' | 'sakit' | 'dinas_luar';
    tanggal_mulai: string;
    tanggal_selesai: string;
    alasan: string;
  }) => {
    if (!user) throw new Error('Not authenticated');
    await insertLeaveRequest(user.id, user.role, { ...data, user_id: user.id });
    leaveRequestsCache.invalidate(cacheKey);
    notifyDataChanged('leave_requests');
    await fetchRequests(true);
  };

  const reviewLeaveRequest = async (id: string, status: LeaveStatus) => {
    if (!user) throw new Error('Not authenticated');
    await patchLeaveRequestStatus(user.id, user.role, id, status, user.id);
    leaveRequestsCache.invalidate(cacheKey);
    notifyDataChanged('leave_requests');
    await fetchRequests(true);
  };

  return {
    requests,
    isLoading,
    error,
    refetch: () => fetchRequests(true),
    submitLeaveRequest,
    reviewLeaveRequest,
  };
}
