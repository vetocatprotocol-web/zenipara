import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAttendance as apiFetchAttendance, rpcCheckIn, rpcCheckOut } from '../lib/api/attendance';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { SimpleCache } from '../lib/cache';
import type { Attendance } from '../types';
import { useAuthStore } from '../store/authStore';
import type { GeoCoordinates } from '../lib/geolocation';

/** Module-level cache: data absensi di-cache 5 menit per user */
const attendanceCache = new SimpleCache<Attendance[]>();

/** Hapus semua cache absensi — berguna untuk pengujian unit. */
export function clearAttendanceCache(): void {
  attendanceCache.clear();
}

export function useAttendance(userId?: string) {
  const { user } = useAuthStore();
  const targetUserId = userId ?? user?.id;

  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchAttendanceRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const hasLoadedRef = useRef(false);

  const cacheKey = useMemo(() => targetUserId ?? '', [targetUserId]);

  const today = new Date().toISOString().split('T')[0];

  const [attendances, setAttendances] = useState<Attendance[]>(() => attendanceCache.get(cacheKey) ?? []);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(() => {
    const cached = attendanceCache.get(cacheKey);
    return cached?.find((a) => a.tanggal === today) ?? null;
  });
  const [isLoading, setIsLoading] = useState(() => !attendanceCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const setAttendanceStateIfChanged = useCallback((next: Attendance[]) => {
    setAttendances((prev) => {
      if (prev.length === next.length) {
        const unchanged = prev.every((item, idx) => (
          item.id === next[idx]?.id
          && item.created_at === next[idx]?.created_at
          && item.status === next[idx]?.status
          && item.check_in === next[idx]?.check_in
          && item.check_out === next[idx]?.check_out
        ));
        if (unchanged) return prev;
      }
      return next;
    });
    const nextToday = next.find((a) => a.tanggal === today) ?? null;
    setTodayAttendance((prev) => {
      if (!prev && !nextToday) return prev;
      if (
        prev?.id === nextToday?.id
        && prev?.status === nextToday?.status
        && prev?.check_in === nextToday?.check_in
        && prev?.check_out === nextToday?.check_out
      ) {
        return prev;
      }
      return nextToday;
    });
  }, [today]);

  const fetchAttendance = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user || !targetUserId) {
      setAttendances([]);
      setTodayAttendance(null);
      setIsLoading(false);
      return;
    }
    if (!force) {
      const cached = attendanceCache.get(cacheKey);
      if (cached) {
        setAttendanceStateIfChanged(cached);
        hasLoadedRef.current = true;
        setIsLoading(false);
        return;
      }
    }
    isFetchingRef.current = true;
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const list = await apiFetchAttendance(user.id, user.role, targetUserId);
      attendanceCache.set(cacheKey, list);
      setAttendanceStateIfChanged(list);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(handleError(err, 'Gagal memuat absensi'));
    } finally {
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchAttendanceRef.current?.(true);
      } else {
        setIsLoading(false);
      }
    }
  }, [user, targetUserId, cacheKey, setAttendanceStateIfChanged]);

  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    return subscribeDataChanges('attendance', () => {
      attendanceCache.invalidate(cacheKey);
      void fetchAttendance(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchAttendance]);

  useEffect(() => {
    fetchAttendanceRef.current = fetchAttendance;
  }, [fetchAttendance]);

  const checkIn = async (gps?: GeoCoordinates | null) => {
    if (!targetUserId) throw new Error('User tidak ditemukan');
    if (todayAttendance?.check_in) throw new Error('Sudah check-in hari ini');
    await rpcCheckIn(targetUserId, gps);
    attendanceCache.invalidate(cacheKey);
    notifyDataChanged('attendance');
    await fetchAttendance(true);
  };

  const checkOut = async (gps?: GeoCoordinates | null) => {
    if (!targetUserId) throw new Error('User tidak ditemukan');
    if (!todayAttendance?.check_in) throw new Error('Belum check-in hari ini');
    if (todayAttendance.check_out) throw new Error('Sudah check-out hari ini');
    await rpcCheckOut(targetUserId, gps);
    attendanceCache.invalidate(cacheKey);
    notifyDataChanged('attendance');
    await fetchAttendance(true);
  };

  return { attendances, todayAttendance, isLoading, error, checkIn, checkOut, refetch: () => fetchAttendance(true) };
}
