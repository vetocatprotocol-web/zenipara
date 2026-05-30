import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuditLogs, clearAuditLogsCache } from '@/features/shared/hooks/useAuditLogs';
import { supabase } from '@/features/shared/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { AuditLog } from '@/types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const mockUser = {
  id: 'u-admin', nrp: '11111', nama: 'Admin A', role: 'admin' as const,
  satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const sampleLogs: AuditLog[] = [
  { id: 'l1', action: 'LOGIN', created_at: '2024-01-01T08:00:00Z' },
  { id: 'l2', user_id: 'u1', action: 'GATE_PASS_CREATE', created_at: '2024-01-01T09:00:00Z' },
] as AuditLog[];

describe('useAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuditLogsCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
  });

  it('loads audit logs on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleLogs, error: null });

    const { result } = renderHook(() => useAuditLogs());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[0].action).toBe('LOGIN');
  });

  it('sets error when fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('db error') });

    const { result } = renderHook(() => useAuditLogs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('db error');
    expect(result.current.logs).toHaveLength(0);
  });

  it('returns empty list for empty dataset', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAuditLogs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logs).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('refetch re-fetches audit logs', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleLogs, error: null });

    const { result } = renderHook(() => useAuditLogs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = (mockSupabase.rpc as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => { await result.current.refetch(); });

    expect((mockSupabase.rpc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('passes userId filter to RPC when option is provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [sampleLogs[1]], error: null });

    const { result } = renderHook(() => useAuditLogs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_audit_logs',
      expect.objectContaining({ p_filter_user_id: 'u1' })
    );
  });

  it('passes action filter to RPC when option is provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [sampleLogs[0]], error: null });

    const { result } = renderHook(() => useAuditLogs({ action: 'LOGIN' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_audit_logs',
      expect.objectContaining({ p_action_filter: 'LOGIN' })
    );
  });
});
