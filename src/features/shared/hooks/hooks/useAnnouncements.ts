import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchAnnouncements as apiFetchAnnouncements, insertAnnouncement, patchAnnouncement, deleteAnnouncement as apiDeleteAnnouncement } from '../lib/api/announcements';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { supabase } from '../lib/supabase';
import { SimpleCache } from '../lib/cache';
import type { Announcement, Role } from '../types';
import { useAuthStore } from '../store/authStore';

/** Module-level cache: data pengumuman di-cache 5 menit per user */
const announcementsCache = new SimpleCache<Announcement[]>();

/** Hapus semua cache pengumuman — berguna untuk pengujian unit. */
export function clearAnnouncementsCache(): void {
  announcementsCache.clear();
}

export function useAnnouncements() {
  const { user } = useAuthStore();

  // Request coalescing: prevent duplicate simultaneous fetches when realtime burst occurs
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchAnnouncementsRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const hasLoadedRef = useRef(false);
  const channelNonceRef = useRef(`ann-${Math.random().toString(36).slice(2, 10)}`);

  const cacheKey = useMemo(() => `${user?.id ?? ''}:${user?.role ?? ''}`, [user?.id, user?.role]);

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => announcementsCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(() => !announcementsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const setAnnouncementsIfChanged = useCallback((next: Announcement[]) => {
    setAnnouncements((prev) => {
      if (prev.length === next.length) {
        const unchanged = prev.every((item, idx) => {
          const nextItem = next[idx];
          return item.id === nextItem?.id && item.updated_at === nextItem?.updated_at;
        });
        if (unchanged) return prev;
      }
      return next;
    });
  }, []);

  const fetchAnnouncements = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user) {
      setAnnouncements([]);
      setIsLoading(false);
      return;
    }
    if (!force) {
      const cached = announcementsCache.get(cacheKey);
      if (cached) {
        setAnnouncementsIfChanged(cached);
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
      const data = await apiFetchAnnouncements(user.id, user.role);
      announcementsCache.set(cacheKey, data);
      setAnnouncementsIfChanged(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(handleError(err, 'Gagal memuat pengumuman'));
    } finally {
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchAnnouncementsRef.current?.(true);
      } else {
        setIsLoading(false);
      }
    }
  }, [user, cacheKey, setAnnouncementsIfChanged]);

  const fetchAnnouncementsOrThrow = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user) throw new Error('Not authenticated');
    if (!force) {
      const cached = announcementsCache.get(cacheKey);
      if (cached) {
        setAnnouncementsIfChanged(cached);
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
      const data = await apiFetchAnnouncements(user.id, user.role);
      announcementsCache.set(cacheKey, data);
      setAnnouncementsIfChanged(data);
      hasLoadedRef.current = true;
    } catch (err) {
      const message = handleError(err, 'Gagal memuat pengumuman');
      setError(message);
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchAnnouncementsRef.current?.(true);
      } else {
        setIsLoading(false);
      }
      throw new Error(message);
    }
    isFetchingRef.current = false;
    if (refreshQueuedRef.current) {
      refreshQueuedRef.current = false;
      await fetchAnnouncementsRef.current?.(true);
    } else {
      setIsLoading(false);
    }
  }, [user, cacheKey, setAnnouncementsIfChanged]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    return subscribeDataChanges('announcements', () => {
      announcementsCache.invalidate(cacheKey);
      void fetchAnnouncements(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchAnnouncements]);

  useEffect(() => {
    if (!user) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`announcements-changes-${user.id}-${channelNonceRef.current}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
      announcementsCache.invalidate(cacheKey);
      void fetchAnnouncements(true);
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, cacheKey, fetchAnnouncements]);

  /**
   * Sync the current fetchAnnouncements function to the ref so queued refreshes
   * have access to the latest version with updated dependencies.
   */
  useEffect(() => {
    fetchAnnouncementsRef.current = fetchAnnouncements;
  }, [fetchAnnouncements]);

  const createAnnouncement = async (data: {
    judul: string;
    isi: string;
    target_role?: Role[];
    target_satuan?: string;
    is_pinned?: boolean;
  }) => {
    if (!user) throw new Error('Not authenticated');
    await insertAnnouncement(user.id, user.role, { ...data, created_by: user.id });
    announcementsCache.invalidate(cacheKey);
    notifyDataChanged('announcements');
    void fetchAnnouncements(true);
  };

  const updateAnnouncement = async (id: string, updates: Partial<Announcement>) => {
    if (!user) throw new Error('Not authenticated');
    await patchAnnouncement(user.id, user.role, id, updates);
    announcementsCache.invalidate(cacheKey);
    notifyDataChanged('announcements');
    await fetchAnnouncementsOrThrow(true);
  };

  const deleteAnnouncement = async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    await apiDeleteAnnouncement(user.id, user.role, id);
    announcementsCache.invalidate(cacheKey);
    notifyDataChanged('announcements');
    await fetchAnnouncementsOrThrow(true);
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    await updateAnnouncement(id, { is_pinned: !isPinned });
  };

  return {
    announcements,
    isLoading,
    error,
    refetch: () => fetchAnnouncements(true),
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    togglePin,
  };
}
