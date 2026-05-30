import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import { usePosJagaStore } from '../../store/posJagaStore';
import { useAuthStore } from '../../store/authStore';
import type { PosJaga, ScanPosJagaResult } from '../../types';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

const now = new Date().toISOString();

const samplePos: PosJaga[] = [
  { id: 'p1', nama: 'Pos Jaga Utara', qr_token: 'token-utara', is_active: true, created_at: now },
  { id: 'p2', nama: 'Pos Jaga Selatan', qr_token: 'token-selatan', is_active: false, created_at: now },
];

const mockUser = {
  id: 'u1', nrp: '11111', nama: 'Prajurit A', role: 'prajurit' as const,
  satuan: 'Satuan X', is_active: true, is_online: true, login_attempts: 0,
  created_at: now, updated_at: now,
};

describe('posJagaStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePosJagaStore.setState({ posJagaList: [] });
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      error: null,
    });
  });

  // ── fetchPosJaga ──────────────────────────────────────────
  describe('fetchPosJaga', () => {
    it('fetches all pos jaga and updates store', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })        // set_session_context
        .mockResolvedValueOnce({ data: samplePos, error: null });  // api_get_pos_jaga

      await usePosJagaStore.getState().fetchPosJaga();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_pos_jaga');
      expect(usePosJagaStore.getState().posJagaList).toHaveLength(2);
      expect(usePosJagaStore.getState().posJagaList[0].nama).toBe('Pos Jaga Utara');
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('db error') });

      await expect(usePosJagaStore.getState().fetchPosJaga()).rejects.toThrow('db error');
    });
  });

  // ── createPosJaga ─────────────────────────────────────────
  describe('createPosJaga', () => {
    it('inserts a new pos jaga and prepends created row', async () => {
      usePosJagaStore.setState({ posJagaList: samplePos });

      const created: PosJaga = {
        id: 'p3',
        nama: 'Pos Baru',
        qr_token: 'token-baru',
        is_active: true,
        created_at: now,
      };

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })       // set_session_context
        .mockResolvedValueOnce({ data: created, error: null });   // api_insert_pos_jaga

      const result = await usePosJagaStore.getState().createPosJaga('Pos Baru');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_pos_jaga', expect.objectContaining({ p_nama: 'Pos Baru' }));
      expect(result.qr_token).toBe('token-baru');
      expect(usePosJagaStore.getState().posJagaList).toHaveLength(3);
      expect(usePosJagaStore.getState().posJagaList[0].id).toBe('p3');
    });
  });

  // ── setActive ─────────────────────────────────────────────
  describe('setActive', () => {
    it('calls update with correct is_active value and refreshes', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })       // set_session_context (patchPosJagaActive)
        .mockResolvedValueOnce({ data: null, error: null })       // api_set_pos_jaga_active
        .mockResolvedValueOnce({ data: null, error: null })       // set_session_context (fetchPosJaga refresh)
        .mockResolvedValueOnce({ data: samplePos, error: null }); // api_get_pos_jaga

      await usePosJagaStore.getState().setActive('p2', true);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_set_pos_jaga_active', expect.objectContaining({ p_id: 'p2', p_is_active: true }));
      expect(usePosJagaStore.getState().posJagaList).toHaveLength(2);
    });

    it('deactivates a pos jaga (is_active = false)', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: samplePos, error: null });

      await usePosJagaStore.getState().setActive('p1', false);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_set_pos_jaga_active', expect.objectContaining({ p_id: 'p1', p_is_active: false }));
    });
  });

  // ── scanPosJaga ───────────────────────────────────────────
  describe('scanPosJaga', () => {
    it('calls authenticated_scan_pos_jaga RPC and returns result', async () => {
      const scanResult: ScanPosJagaResult = {
        gate_pass_id: 'gp1',
        pos_nama: 'Pos Jaga Utara',
        status: 'checked_in',
        message: 'Scan keluar berhasil (Checked-In)',
      };
      mockSupabase.rpc.mockResolvedValueOnce({ data: scanResult, error: null });

      const result = await usePosJagaStore.getState().scanPosJaga('token-utara', '1000001', '123456');

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('authenticated_scan_pos_jaga', {
        p_nrp: '1000001',
        p_pin: '123456',
        p_pos_token: 'token-utara',
      });
      expect(result.status).toBe('checked_in');
      expect(result.message).toBe('Scan keluar berhasil (Checked-In)');
    });

    it('returns "completed" status when gate pass was already checked_in', async () => {
      const scanResult: ScanPosJagaResult = {
        gate_pass_id: 'gp2',
        pos_nama: 'Pos Jaga Selatan',
        status: 'completed',
        message: 'Scan kembali berhasil (Completed)',
      };
      mockSupabase.rpc.mockResolvedValueOnce({ data: scanResult, error: null });

      const result = await usePosJagaStore.getState().scanPosJaga('token-selatan', '1000001', '123456');

      expect(result.status).toBe('completed');
    });

    it('throws when RPC returns an error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('QR tidak valid') });

      await expect(
        usePosJagaStore.getState().scanPosJaga('bad-token', '1000001', '123456')
      ).rejects.toThrow('QR tidak valid');
    });

    it('throws when RPC returns null data', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        usePosJagaStore.getState().scanPosJaga('some-token', '1000001', '999999')
      ).rejects.toThrow('Scan pos jaga gagal');
    });
  });
});
