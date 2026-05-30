import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const PERM_ASKED_KEY = 'karyo_notif_asked';

/**
 * Requests browser Notification permission once per session,
 * then subscribes to new messages & task assignments via Supabase Realtime.
 */
export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;

    // Ask only once per browser session
    const alreadyAsked = sessionStorage.getItem(PERM_ASKED_KEY);
    if (alreadyAsked) return;

    sessionStorage.setItem(PERM_ASKED_KEY, '1');
    await Notification.requestPermission();
  }, []);

  const sendNotification = useCallback((title: string, body: string, icon?: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        icon: icon ?? '/favicon.ico',
        badge: '/favicon.ico',
        tag: `karyo-${Date.now()}`,
      });
      // Auto-close after 6 seconds
      setTimeout(() => n.close(), 6000);
    } catch {
      // Silently ignore (e.g., permission revoked mid-session)
    }
  }, []);

  useEffect(() => {
    if (!userId || !notificationsEnabled) return;

    void requestPermission();

    // Unsubscribe any previous channel
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`karyo-notif-${userId}`);
    // New message received
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user=eq.${userId}` },
      (payload) => {
        const row = payload.new as { isi: string };
        sendNotification('Pesan Baru', row.isi?.slice(0, 120) ?? 'Anda mendapat pesan baru');
      }
    );
    // New task assigned
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${userId}` },
      (payload) => {
        const row = payload.new as { judul: string };
        sendNotification('Tugas Baru', `"${row.judul ?? 'Tugas baru'}" telah diberikan kepada Anda`);
      }
    );
    // Task status updated (e.g., approved/rejected)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `assigned_to=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { judul: string; status: string };
        if (row.status === 'approved') {
          sendNotification('Tugas Disetujui', `"${row.judul}" telah disetujui oleh Komandan`);
        } else if (row.status === 'in_progress' && (payload.old as { status: string }).status === 'done') {
          sendNotification('Tugas Dikembalikan', `"${row.judul}" perlu direvisi. Cek catatan Komandan.`);
        }
      }
    );
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, notificationsEnabled, requestPermission, sendNotification]);

  return { sendNotification };
}
