import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMessages } from '@/features/shared/hooks/useMessages';
import { useAuthStore } from '@/features/store/authStore';
import { supabase } from '@/features/shared/lib/supabase';
import type { Message } from '@/types';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const inboxMessages: Message[] = [
  { id: 'm1', isi: 'Halo', is_read: false, from_user: 'u2', to_user: 'u1', created_at: '2026-04-14T08:00:00Z' } as Message,
];
const sentMessages: Message[] = [
  { id: 'm2', isi: 'Siap', is_read: true, from_user: 'u1', to_user: 'u2', created_at: '2026-04-14T08:01:00Z' } as Message,
];

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'u1', nrp: '11111', nama: 'Prajurit A', role: 'prajurit', satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-14T00:00:00Z', updated_at: '2026-04-14T00:00:00Z' },
      isAuthenticated: true, isLoading: false, isInitialized: true, error: null,
    });
    // rpc mock: first call = api_get_inbox, second = api_get_sent (both via Promise.all)
    mockSupabase.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'api_get_inbox') return Promise.resolve({ data: inboxMessages, error: null });
      if (rpcName === 'api_get_sent') return Promise.resolve({ data: sentMessages, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
    mockSupabase.removeChannel.mockResolvedValue(undefined);
  });

  it('loads inbox, sent, and unread count on mount', async () => {
    const { result } = renderHook(() => useMessages());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.inbox).toHaveLength(1);
    expect(result.current.sent).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  it('sends a message and refreshes', async () => {
    const { result } = renderHook(() => useMessages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.sendMessage('u2', 'Tugas sudah diterima'); });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_message', expect.objectContaining({ p_to_user: 'u2' }));
    expect(result.current.error).toBeNull();
  });

  it('marks a message as read and decrements unread count', async () => {
    const { result } = renderHook(() => useMessages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markAsRead('m1'); });

    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all messages as read', async () => {
    const { result } = renderHook(() => useMessages());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markAllAsRead(); });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.inbox[0].is_read).toBe(true);
  });
});
