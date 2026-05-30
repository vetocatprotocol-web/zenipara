import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeaveRequests, clearLeaveRequestsCache } from '@/features/shared/hooks/useLeaveRequests';
import { supabase } from '@/features/shared/lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type { LeaveRequest } from '../../types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const mockUser = {
  id: 'user-1', nrp: '12345', nama: 'Prajurit A', role: 'prajurit' as const,
  satuan: 'Satuan A', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const mockRequests: LeaveRequest[] = [
  { id: 'lr1', user_id: 'user-1', jenis_izin: 'cuti', tanggal_mulai: '2024-02-01', tanggal_selesai: '2024-02-05', alasan: 'Liburan', status: 'pending', created_at: '2024-01-15T00:00:00Z', user: { ...mockUser } },
  { id: 'lr2', user_id: 'user-2', jenis_izin: 'sakit', tanggal_mulai: '2024-02-10', tanggal_selesai: '2024-02-12', alasan: 'Demam', status: 'approved', created_at: '2024-01-20T00:00:00Z', user: { ...mockUser, id: 'user-2', satuan: 'Satuan B' } },
];

describe('useLeaveRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLeaveRequestsCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
  });

  it('loads leave requests on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockRequests, error: null });

    const { result } = renderHook(() => useLeaveRequests());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toHaveLength(2);
  });

  it('sets error on fetch failure', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('network error') });

    const { result } = renderHook(() => useLeaveRequests());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('network error');
  });

  it('filters by satuan via joined user data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockRequests, error: null });

    const { result } = renderHook(() => useLeaveRequests({ satuan: 'Satuan A' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requests[0].id).toBe('lr1');
  });

  it('returns all requests when no satuan filter', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockRequests, error: null });

    const { result } = renderHook(() => useLeaveRequests());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.requests).toHaveLength(2);
  });

  describe('submitLeaveRequest', () => {
    it('calls rpc for insert with correct data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: mockRequests, error: null });

      const { result } = renderHook(() => useLeaveRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.submitLeaveRequest({ jenis_izin: 'cuti', tanggal_mulai: '2024-03-01', tanggal_selesai: '2024-03-05', alasan: 'Keluarga' });
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_leave_request',
        expect.objectContaining({ p_user_id: 'user-1', p_jenis_izin: 'cuti', p_alasan: 'Keluarga' })
      );
    });

    it('throws when not authenticated', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useLeaveRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.submitLeaveRequest({ jenis_izin: 'sakit', tanggal_mulai: '2024-03-01', tanggal_selesai: '2024-03-03', alasan: 'Demam' });
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('throws when rpc returns error', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // fetch
        .mockResolvedValueOnce({ data: null, error: new Error('insert failed') }); // insert

      const { result } = renderHook(() => useLeaveRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.submitLeaveRequest({ jenis_izin: 'cuti', tanggal_mulai: '2024-04-01', tanggal_selesai: '2024-04-05', alasan: 'test' });
        })
      ).rejects.toThrow('insert failed');
    });
  });

  describe('reviewLeaveRequest', () => {
    it('calls rpc for update with approved status and reviewer info', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: mockRequests, error: null });

      const { result } = renderHook(() => useLeaveRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.reviewLeaveRequest('lr1', 'approved'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_leave_request_status',
        expect.objectContaining({ p_id: 'lr1', p_status: 'approved', p_reviewed_by: 'user-1' })
      );
    });

    it('throws when not authenticated', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useLeaveRequests());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => { await result.current.reviewLeaveRequest('lr1', 'rejected'); })
      ).rejects.toThrow('Not authenticated');
    });
  });
});
