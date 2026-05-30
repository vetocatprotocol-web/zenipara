import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGatePass } from '@/features/shared/hooks/useGatePass';
import { useAuthStore } from '@/features/store/authStore';
import { supabase } from '@/features/shared/lib/supabase';
import type { GatePass } from '@/types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const sampleGatePasses: GatePass[] = [
  { id: 'gp1', user_id: 'u1', qr_token: 'token-123', status: 'pending', created_at: '2026-04-14T00:00:00Z', updated_at: '2026-04-14T00:00:00Z' } as GatePass,
];

describe('useGatePass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'u1', nrp: '11111', nama: 'Prajurit A', role: 'prajurit', satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-14T00:00:00Z', updated_at: '2026-04-14T00:00:00Z' },
      isAuthenticated: true, isLoading: false, isInitialized: true, error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: sampleGatePasses, error: null });
  });

  it('loads gate passes on mount', async () => {
    const { result } = renderHook(() => useGatePass());

    await waitFor(() => expect(result.current.gatePasses).toHaveLength(1));
    expect(result.current.gatePasses[0].id).toBe('gp1');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_gate_passes', expect.objectContaining({ p_target_user_id: 'u1' }));
  });

  it('creates a gate pass via rpc and refetches list', async () => {
    const { result } = renderHook(() => useGatePass());
    await waitFor(() => expect(result.current.gatePasses).toHaveLength(1));

    await act(async () => { await result.current.createGatePass({ keperluan: 'Kunjungan' }); });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_gate_pass', expect.objectContaining({ p_user_id: 'u1' }));
    expect(result.current.gatePasses).toHaveLength(1);
  });
});
