import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnnouncements, clearAnnouncementsCache } from '@/features/shared/hooks/useAnnouncements';
import { useAuthStore } from '@/features/store/authStore';
import { supabase } from '@/features/shared/lib/supabase';
import type { Announcement } from '@/types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const mockUser = {
  id: 'u1', nrp: '11111', nama: 'Admin A', role: 'admin_satuan' as const,
  satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const sampleAnnouncements: Announcement[] = [
  { id: 'a1', judul: 'Pengumuman Upacara', isi: 'Besok ada upacara', is_pinned: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'a2', judul: 'Jadwal Piket', isi: 'Piket minggu ini', is_pinned: false, created_at: '2024-01-02T00:00:00Z' },
];

describe('useAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAnnouncementsCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
  });

  it('loads announcements on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

    const { result } = renderHook(() => useAnnouncements());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.announcements).toHaveLength(2);
    expect(result.current.announcements[0].judul).toBe('Pengumuman Upacara');
  });

  it('sets error when fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });

    const { result } = renderHook(() => useAnnouncements());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('fetch error');
    expect(result.current.announcements).toHaveLength(0);
  });

  it('returns empty list for empty dataset', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAnnouncements());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.announcements).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  describe('createAnnouncement', () => {
    it('calls rpc for insert and refreshes list', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

      const { result } = renderHook(() => useAnnouncements());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.createAnnouncement({ judul: 'Baru', isi: 'Isi baru' });
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_announcement',
        expect.objectContaining({ p_judul: 'Baru', p_created_by: 'u1' })
      );
    });
  });

  describe('updateAnnouncement', () => {
    it('calls rpc for update and refreshes list', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

      const { result } = renderHook(() => useAnnouncements());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.updateAnnouncement('a1', { judul: 'Updated' }); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_announcement',
        expect.objectContaining({ p_id: 'a1', p_updates: { judul: 'Updated' } })
      );
    });
  });

  describe('deleteAnnouncement', () => {
    it('calls rpc for delete with correct id', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

      const { result } = renderHook(() => useAnnouncements());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.deleteAnnouncement('a2'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_delete_announcement',
        expect.objectContaining({ p_id: 'a2' })
      );
    });
  });

  describe('togglePin', () => {
    it('toggles is_pinned for an announcement via update rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

      const { result } = renderHook(() => useAnnouncements());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.togglePin('a2', false); });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_announcement',
        expect.objectContaining({ p_updates: { is_pinned: true } })
      );

      await act(async () => { await result.current.togglePin('a1', true); });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_announcement',
        expect.objectContaining({ p_updates: { is_pinned: false } })
      );
    });
  });

  it('refetch re-fetches announcements', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });

    const { result } = renderHook(() => useAnnouncements());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = (mockSupabase.rpc as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => { await result.current.refetch(); });

    expect((mockSupabase.rpc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
