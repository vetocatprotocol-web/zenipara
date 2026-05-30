import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLogisticsRequests, clearLogisticsRequestsCache } from '@/features/shared/hooks/useLogisticsRequests';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/features/shared/lib/supabase';
import type { LogisticsRequest } from '@/types';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const mockUser = {
  id: 'u1', nrp: '11111', nama: 'Prajurit A', role: 'prajurit' as const,
  satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const sampleRequests: LogisticsRequest[] = [
  { id: 'req1', nama_item: 'Peluru', jumlah: 100, satuan_item: 'butir', alasan: 'Latihan', requested_by: 'u1', satuan: 'Satuan X', status: 'pending', created_at: '2024-01-01T00:00:00Z' },
  { id: 'req2', nama_item: 'Seragam', jumlah: 5, satuan_item: 'buah', alasan: 'Rusak', requested_by: 'u2', satuan: 'Satuan Y', status: 'approved', created_at: '2024-01-02T00:00:00Z' },
] as LogisticsRequest[];

describe('useLogisticsRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLogisticsRequestsCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    mockSupabase.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
    mockSupabase.removeChannel.mockResolvedValue(undefined);
  });

  it('loads logistics requests on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleRequests, error: null });

    const { result } = renderHook(() => useLogisticsRequests());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toHaveLength(2);
    expect(result.current.requests[0].nama_item).toBe('Peluru');
  });

  it('sets error when fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });

    const { result } = renderHook(() => useLogisticsRequests());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('fetch error');
    expect(result.current.requests).toHaveLength(0);
  });

  it('returns empty list for empty dataset', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useLogisticsRequests());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  describe('submitRequest', () => {
    it('calls rpc for insert with correct data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleRequests, error: null });

      const { result } = renderHook(() => useLogisticsRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.submitRequest({ nama_item: 'Baju', jumlah: 2, alasan: 'Perlu' });
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_logistics_request',
        expect.objectContaining({ p_nama_item: 'Baju', p_jumlah: 2 })
      );
    });

    it('throws when not authenticated', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useLogisticsRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => { await result.current.submitRequest({ nama_item: 'X', jumlah: 1, alasan: 'Y' }); })
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('reviewRequest', () => {
    it('calls rpc for update with approved status and reviewer info', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleRequests, error: null });

      const { result } = renderHook(() => useLogisticsRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.reviewRequest('req1', 'approved', 'Disetujui'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_logistics_status',
        expect.objectContaining({ p_id: 'req1', p_status: 'approved', p_admin_note: 'Disetujui' })
      );
    });

    it('throws when not authenticated', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useLogisticsRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => { await result.current.reviewRequest('req1', 'rejected'); })
      ).rejects.toThrow('Not authenticated');
    });
  });
});
