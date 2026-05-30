import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchInbox, fetchSent, insertMessage, markMessageRead as apiMarkRead, markAllMessagesRead as apiMarkAllRead } from '../lib/api/messages';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { SimpleCache } from '../lib/cache';
import { requestCoalescer } from '../lib/requestCoalescer';
import type { Message } from '../types';
import { useAuthStore } from '../store/authStore';

const inboxCache = new SimpleCache<Message[]>();
const sentCache = new SimpleCache<Message[]>();

function buildMessagesCacheKey(userId?: string, userRole?: string): string {
  return `${userId ?? ''}:${userRole ?? ''}`;
}

function isSameMessages(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((msg, idx) => {
    const target = b[idx];
    return (
      msg.id === target?.id
      && msg.is_read === target?.is_read
      && msg.created_at === target?.created_at
    );
  });
}

interface UseMessagesOptions {
  includeSent?: boolean;
  enableDirectRealtime?: boolean;
  subscribeToDataChanges?: boolean;
}

export function useMessages(options: UseMessagesOptions = {}) {
  const { includeSent = true, enableDirectRealtime = true, subscribeToDataChanges = true } = options;
  const { user } = useAuthStore();
  const cacheKey = buildMessagesCacheKey(user?.id, user?.role);
  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request coalescing: prevent duplicate simultaneous fetches when realtime burst occurs
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchMessagesRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const hasLoadedRef = useRef(false);

  const setInboxIfChanged = useCallback((next: Message[]) => {
    setInbox((prev) => (isSameMessages(prev, next) ? prev : next));
  }, []);

  const setSentIfChanged = useCallback((next: Message[]) => {
    setSent((prev) => (isSameMessages(prev, next) ? prev : next));
  }, []);

  const fetchMessages = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user) {
      setInbox([]);
      setSent([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    if (!force) {
      const cachedInbox = inboxCache.get(cacheKey);
      const cachedSent = includeSent ? sentCache.get(cacheKey) : [];
      if (cachedInbox && (!includeSent || cachedSent)) {
        setInboxIfChanged(cachedInbox);
        setSentIfChanged(cachedSent as Message[]);
        setUnreadCount(cachedInbox.filter((m) => !m.is_read).length);
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
      const inboxPromise = requestCoalescer.coalesce(
        `messages:inbox:${cacheKey}`,
        () => fetchInbox(user.id, user.role),
      );
      const sentPromise = includeSent
        ? requestCoalescer.coalesce(`messages:sent:${cacheKey}`, () => fetchSent(user.id, user.role))
        : Promise.resolve([] as Message[]);
      const [inboxData, sentData] = await Promise.all([inboxPromise, sentPromise]);
      inboxCache.set(cacheKey, inboxData);
      sentCache.set(cacheKey, sentData);
      setInboxIfChanged(inboxData);
      setSentIfChanged(sentData);
      setUnreadCount(inboxData.filter((m) => !m.is_read).length);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(handleError(err, 'Gagal memuat pesan'));
    } finally {
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchMessagesRef.current?.(true);
      } else {
        setIsLoading(false);
      }
    }
  }, [cacheKey, includeSent, setInboxIfChanged, setSentIfChanged, user]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!subscribeToDataChanges) return;
    return subscribeDataChanges('messages', () => {
      inboxCache.invalidate(cacheKey);
      sentCache.invalidate(cacheKey);
      void fetchMessages(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchMessages, subscribeToDataChanges]);

  // Realtime subscription for new messages
  // Use ref to avoid duplicate subscriptions and ensure cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNonceRef = useRef(`msg-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!enableDirectRealtime) return;
    if (!user) return;
    // Cleanup previous channel if exists
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    // Use a unique channel topic per mounted hook instance.
    // This avoids "cannot add postgres_changes callbacks ... after subscribe()"
    // when StrictMode remounts quickly and the previous topic is still subscribed.
    const channel = supabase.channel(`messages-inbox-${user.id}-${channelNonceRef.current}`);
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user=eq.${user.id}` },
      () => {
        inboxCache.invalidate(cacheKey);
        sentCache.invalidate(cacheKey);
        void fetchMessages(true);
      },
    );
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enableDirectRealtime, user, fetchMessages, cacheKey]);

  /**
   * Sync the current fetchMessages function to the ref so queued refreshes
   * have access to the latest version with updated dependencies.
   */
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  const sendMessage = async (toUserId: string, isi: string) => {
    if (!user) throw new Error('Not authenticated');
    await insertMessage(user.id, user.role, user.id, toUserId, isi);
    inboxCache.invalidate(cacheKey);
    sentCache.invalidate(cacheKey);
    notifyDataChanged('messages');
    await fetchMessages(true);
  };

  const markAsRead = async (messageId: string) => {
    if (!user) return;
    await apiMarkRead(user.id, user.role, messageId);
    inboxCache.invalidate(cacheKey);
    setInbox((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await apiMarkAllRead(user.id, user.role);
    inboxCache.invalidate(cacheKey);
    setInbox((prev) => prev.map((m) => ({ ...m, is_read: true })));
    setUnreadCount(0);
  };

  return {
    inbox,
    sent,
    unreadCount,
    isLoading,
    error,
    refetch: fetchMessages,
    sendMessage,
    markAsRead,
    markAllAsRead,
  };
}
