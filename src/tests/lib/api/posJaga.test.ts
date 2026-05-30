import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  fetchAllPosJaga,
  insertPosJaga,
  patchPosJagaActive,
  rpcScanPosJaga,
  rpcScanPosJagaWithCredentials,
} from '@/features/shared/lib/api/posJaga';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'admin_satuan';

describe('posJaga API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── fetchAllPosJaga ───────────────────────────────────────
  describe('fetchAllPosJaga', () => {
    it('returns array of pos jaga', async () => {
      const data = [{ id: 'p1', nama: 'Utara', qr_token: 'tok1', is_active: true, created_at: '2024-01-01' }];
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // set_session_context
        .mockResolvedValueOnce({ data, error: null });       // api_get_pos_jaga

      const result = await fetchAllPosJaga(CALLER_ID, CALLER_ROLE);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_pos_jaga');
      expect(result).toHaveLength(1);
      expect(result[0].nama).toBe('Utara');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await fetchAllPosJaga(CALLER_ID, CALLER_ROLE);
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('db error') });

      await expect(fetchAllPosJaga(CALLER_ID, CALLER_ROLE)).rejects.toThrow('db error');
    });
  });

  // ── insertPosJaga ─────────────────────────────────────────
  describe('insertPosJaga', () => {
    it('calls RPC with correct payload and returns created row', async () => {
      const created = { id: 'p3', nama: 'Pos Baru', qr_token: 'tok3', is_active: true, created_at: '2024-01-01' };
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })   // set_session_context
        .mockResolvedValueOnce({ data: created, error: null }); // api_insert_pos_jaga

      const result = await insertPosJaga(CALLER_ID, CALLER_ROLE, { nama: 'Pos Baru' });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_pos_jaga', {
        p_caller_id: CALLER_ID,
        p_caller_role: CALLER_ROLE,
        p_nama: 'Pos Baru',
      });
      expect(result.id).toBe('p3');
      expect(result.qr_token).toBe('tok3');
    });

    it('throws when insert fails', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('insert error') });

      await expect(insertPosJaga(CALLER_ID, CALLER_ROLE, { nama: 'Bad' })).rejects.toThrow('insert error');
    });
  });

  // ── patchPosJagaActive ────────────────────────────────────
  describe('patchPosJagaActive', () => {
    it('calls RPC with correct is_active value', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })   // set_session_context
        .mockResolvedValueOnce({ data: null, error: null });  // api_set_pos_jaga_active

      await patchPosJagaActive(CALLER_ID, CALLER_ROLE, 'p1', false);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_set_pos_jaga_active', {
        p_caller_id: CALLER_ID,
        p_caller_role: CALLER_ROLE,
        p_id: 'p1',
        p_is_active: false,
      });
    });

    it('throws when update fails', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('update error') });

      await expect(patchPosJagaActive(CALLER_ID, CALLER_ROLE, 'p1', true)).rejects.toThrow('update error');
    });
  });

  // ── rpcScanPosJaga ────────────────────────────────────────
  describe('rpcScanPosJaga', () => {
    it('calls RPC with correct params and returns result', async () => {
      const scanResult = { gate_pass_id: 'gp1', pos_nama: 'Pos Jaga Utara', status: 'checked_in', message: 'Scan keluar berhasil (Checked-In)' };
      mockSupabase.rpc.mockResolvedValue({ data: scanResult, error: null });

      const result = await rpcScanPosJaga('tok1', 'u1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('scan_pos_jaga', { p_pos_token: 'tok1', p_user_id: 'u1' });
      expect(result.status).toBe('checked_in');
    });

    it('throws when RPC returns error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('QR tidak valid') });
      await expect(rpcScanPosJaga('bad-tok', 'u1')).rejects.toThrow('QR tidak valid');
    });

    it('throws with fallback message when data is null and no error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await expect(rpcScanPosJaga('tok', 'u1')).rejects.toThrow('QR pos jaga tidak valid');
    });
  });

  // ── rpcScanPosJagaWithCredentials ─────────────────────────
  describe('rpcScanPosJagaWithCredentials', () => {
    it('calls authenticated_scan_pos_jaga with NRP, PIN, and pos token', async () => {
      const scanResult = { gate_pass_id: 'gp1', pos_nama: 'Pos Jaga Utara', status: 'checked_in', message: 'Scan keluar berhasil (Checked-In)' };
      mockSupabase.rpc.mockResolvedValueOnce({ data: scanResult, error: null });

      const result = await rpcScanPosJagaWithCredentials('tok1', '1000001', '123456');

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('authenticated_scan_pos_jaga', {
        p_nrp: '1000001',
        p_pin: '123456',
        p_pos_token: 'tok1',
      });
      expect(result.status).toBe('checked_in');
    });

    it('throws when RPC returns an error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('NRP atau PIN salah') });
      await expect(rpcScanPosJagaWithCredentials('tok1', '1000001', '999999')).rejects.toThrow('NRP atau PIN salah');
    });

    it('throws with fallback message when data is null and no error', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
      await expect(rpcScanPosJagaWithCredentials('tok1', '1000001', '123456')).rejects.toThrow('Scan pos jaga gagal');
    });
  });
});
