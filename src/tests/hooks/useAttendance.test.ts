import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAttendance, clearAttendanceCache } from '@/features/shared/hooks/useAttendance';
import { supabase } from '@/features/shared/lib/supabase';
import { useAuthStore } from '@/features/auth/authStore';
import type { Attendance } from '@/types';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const mockUser = {
  id: 'user-1', nrp: '12345', nama: 'Prajurit A', role: 'prajurit' as const,
  satuan: 'Satuan A', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const today = new Date().toISOString().split('T')[0];

const mockAttendances: Attendance[] = [
  { id: 'a1', user_id: 'user-1', tanggal: today, status: 'hadir', created_at: '2024-01-01T07:00:00Z' },
];

describe('useAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttendanceCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    mockSupabase.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
    mockSupabase.removeChannel.mockResolvedValue(undefined);
  });

  it('loads attendance records on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockAttendances, error: null });

    const { result } = renderHook(() => useAttendance());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.attendances).toHaveLength(1);
    expect(result.current.todayAttendance?.tanggal).toBe(today);
  });

  it('sets error on fetch failure', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });

    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('fetch error');
  });

  it('todayAttendance is null when no record for today exists', async () => {
    const pastRecord: Attendance = { id: 'a2', user_id: 'user-1', tanggal: '2020-01-01', status: 'hadir', created_at: '2020-01-01T07:00:00Z' };
    mockSupabase.rpc.mockResolvedValue({ data: [pastRecord], error: null });

    const { result } = renderHook(() => useAttendance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todayAttendance).toBeNull();
  });

  describe('checkIn', () => {
    it('throws if already checked in today', async () => {
      const checkedIn: Attendance = { ...mockAttendances[0], check_in: '2024-01-01T07:00:00Z' };
      mockSupabase.rpc.mockResolvedValue({ data: [checkedIn], error: null });

      const { result } = renderHook(() => useAttendance());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.checkIn(); })).rejects.toThrow('Sudah check-in hari ini');
    });

    it('calls server_checkin rpc when no prior check-in', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_attendance') return Promise.resolve({ data: mockAttendances, error: null });
        if (rpcName === 'server_checkin') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useAttendance());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.checkIn(); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('server_checkin', expect.objectContaining({ p_user_id: 'user-1' }));
    });
  });

  describe('checkOut', () => {
    it('throws if not checked in', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: mockAttendances, error: null });

      const { result } = renderHook(() => useAttendance());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.checkOut(); })).rejects.toThrow('Belum check-in hari ini');
    });

    it('throws if already checked out', async () => {
      const checkedOut: Attendance = { ...mockAttendances[0], check_in: '2024-01-01T07:00:00Z', check_out: '2024-01-01T16:00:00Z' };
      mockSupabase.rpc.mockResolvedValue({ data: [checkedOut], error: null });

      const { result } = renderHook(() => useAttendance());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.checkOut(); })).rejects.toThrow('Sudah check-out hari ini');
    });

    it('calls server_checkout rpc when valid', async () => {
      const checkedIn: Attendance = { ...mockAttendances[0], check_in: '2024-01-01T07:00:00Z' };
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_attendance') return Promise.resolve({ data: [checkedIn], error: null });
        if (rpcName === 'server_checkout') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useAttendance());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.checkOut(); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('server_checkout', expect.objectContaining({ p_user_id: 'user-1' }));
    });
  });

  it('throws when no user is set', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAttendance());

    await expect(act(async () => { await result.current.checkIn(); })).rejects.toThrow('User tidak ditemukan');
  });
});
