import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import { useGatePassStore } from '@/store/gatePassStore';
import { useAuthStore } from '@/store/authStore';
import type { GatePass } from '@/types';

// Supabase mocks typed
const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
};

const now = new Date();
const overdueTime = new Date(now.getTime() - 1000 * 60 * 60).toISOString();
const gatePassCheckedIn: GatePass = {
  id: 'gp1', user_id: 'u1', keperluan: 'Cuti', tujuan: 'Rumah',
  waktu_keluar: now.toISOString(), waktu_kembali: overdueTime,
  actual_keluar: now.toISOString(), actual_kembali: null,
  status: 'checked_in', approved_by: 'u2', qr_token: 'qr-1',
  created_at: now.toISOString(), updated_at: now.toISOString(),
};

const approvedGatePass: GatePass = {
  id: 'gp2', user_id: 'u1', keperluan: 'Urusan', tujuan: 'Kota',
  waktu_keluar: now.toISOString(),
  waktu_kembali: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
  actual_keluar: null, actual_kembali: null, status: 'approved',
  qr_token: 'qr-2', created_at: now.toISOString(), updated_at: now.toISOString(),
};

// For fetchGatePassByQrToken which still uses supabase.from
function buildFromQuery(data: unknown) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = chain;
  q.eq = chain;
  q.order = chain;
  q.single = () => Promise.resolve({ data, error: null });
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  q.catch = (reject: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).catch(reject);
  return q;
}

describe('gatePassStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGatePassStore.setState({ gatePasses: [] });
    useAuthStore.setState({
      user: { id: 'u1', nrp: '11111', nama: 'Prajurit A', role: 'prajurit', satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0, created_at: now.toISOString(), updated_at: now.toISOString() },
      isAuthenticated: true, isLoading: false, isInitialized: true, error: null,
    });
    mockSupabase.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
  });

  it('fetches gate passes for prajurit tanpa normalisasi status di frontend store', async () => {
    // fetchGatePassesByUser uses rpc('api_get_gate_passes')
    mockSupabase.rpc.mockResolvedValue({ data: [gatePassCheckedIn], error: null });

    const store = useGatePassStore.getState();
    await store.fetchGatePasses();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_gate_passes', expect.objectContaining({ p_target_user_id: 'u1' }));
    expect(useGatePassStore.getState().gatePasses[0].status).toBe('checked_in');
  });

  it('creates a gate pass via rpc and refreshes list', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [approvedGatePass], error: null });

    const store = useGatePassStore.getState();
    await store.createGatePass({ tujuan: 'Aman', keperluan: 'Urusan' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_gate_pass',
      expect.objectContaining({ p_user_id: 'u1', p_tujuan: 'Aman' })
    );
  });

  it('approves a gate pass via rpc', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [approvedGatePass], error: null });

    const store = useGatePassStore.getState();
    await store.approveGatePass('gp2', true);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_gate_pass_status',
      expect.objectContaining({ p_id: 'gp2', p_status: 'approved', p_approved_by: 'u1' })
    );
  });

  it('cancels a gate pass via rpc', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [approvedGatePass], error: null });

    const store = useGatePassStore.getState();
    await store.cancelGatePass('gp2');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_gate_pass_status',
      expect.objectContaining({
        p_id: 'gp2',
        p_status: 'cancelled',
        p_approval_reason: 'Dibatalkan oleh pemohon',
      })
    );
  });

  it('rejects cancel gate pass for non-prajurit role', async () => {
    useAuthStore.setState({
      user: { id: 'u3', nrp: '33333', nama: 'Admin A', role: 'admin', satuan: 'Mabes', is_active: true, is_online: true, login_attempts: 0, created_at: now.toISOString(), updated_at: now.toISOString() },
      isAuthenticated: true, isLoading: false, isInitialized: true, error: null,
    });

    const store = useGatePassStore.getState();
    await expect(store.cancelGatePass('gp2')).rejects.toThrow('Hanya prajurit yang dapat membatalkan gate pass miliknya');
  });

  it('scans gate pass and returns the updated GatePass object', async () => {
    useAuthStore.setState({
      user: { id: 'u2', nrp: '22222', nama: 'Petugas Scan', role: 'admin', satuan: 'Pos X', is_active: true, is_online: true, login_attempts: 0, created_at: now.toISOString(), updated_at: now.toISOString() },
      isAuthenticated: true, isLoading: false, isInitialized: true, error: null,
    });

    // scanGatePass calls rpcScanGatePass then fetchGatePassByQrToken
    // rpcScanGatePass → rpc('server_scan_gate_pass')
    // fetchGatePassByQrToken → rpc('set_session_context') then from('gate_pass').select...single()
    mockSupabase.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'server_scan_gate_pass') return Promise.resolve({ data: { message: 'Keluar berhasil' }, error: null });
      if (rpcName === 'set_session_context') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue(buildFromQuery(approvedGatePass));

    const store = useGatePassStore.getState();
    const result = await store.scanGatePass('qr-1');

    expect(result).toMatchObject({ id: approvedGatePass.id, status: approvedGatePass.status });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('server_scan_gate_pass', { p_qr_token: 'qr-1' });
  });
});
