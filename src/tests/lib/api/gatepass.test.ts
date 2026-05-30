import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  fetchGatePassesByUser,
  fetchAllGatePasses,
  fetchGatePassByQrToken,
  insertGatePass,
  patchGatePassStatus,
  rpcScanGatePass,
} from '@/features/shared/lib/api/gatepass';
import type { GatePass } from '../../../types';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'prajurit';

const now = new Date().toISOString();
const sampleGatePasses: GatePass[] = [
  {
    id: 'gp1', user_id: 'u1', keperluan: 'Cuti', tujuan: 'Rumah',
    waktu_keluar: now, waktu_kembali: now, status: 'pending',
    qr_token: 'qr-1', created_at: now, updated_at: now,
  },
];

function buildFromQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = chain;
  q.eq = chain;
  q.order = chain;
  q.single = () => Promise.resolve(result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  q.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  return q;
}

describe('gatepass API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── fetchGatePassesByUser ──────────────────────────────────
  describe('fetchGatePassesByUser', () => {
    it('returns gate passes for a user', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleGatePasses, error: null });
      const result = await fetchGatePassesByUser(CALLER_ID, CALLER_ROLE, 'u1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_gate_passes', expect.objectContaining({ p_target_user_id: 'u1' }));
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('u1');
    });

    it('returns empty array when no gate passes', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await fetchGatePassesByUser(CALLER_ID, CALLER_ROLE, 'u1');
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });
      await expect(fetchGatePassesByUser(CALLER_ID, CALLER_ROLE, 'u1')).rejects.toThrow('fetch error');
    });
  });

  // ── fetchAllGatePasses ─────────────────────────────────────
  describe('fetchAllGatePasses', () => {
    it('returns all gate passes', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleGatePasses, error: null });
      const result = await fetchAllGatePasses(CALLER_ID, CALLER_ROLE);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_gate_passes', expect.objectContaining({ p_target_user_id: null }));
      expect(result).toHaveLength(1);
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await fetchAllGatePasses(CALLER_ID, CALLER_ROLE);
      expect(result).toEqual([]);
    });
  });

  // ── fetchGatePassByQrToken ────────────────────────────────
  describe('fetchGatePassByQrToken', () => {
    it('returns gate pass matching QR token', async () => {
      // first rpc call = set_session_context (resolved by global mock)
      // second from('gate_pass')... = single()
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue(buildFromQuery({ data: sampleGatePasses[0], error: null }));

      const result = await fetchGatePassByQrToken(CALLER_ID, CALLER_ROLE, 'qr-1');

      expect(result?.qr_token).toBe('qr-1');
    });

    it('returns null when not found or error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue(buildFromQuery({ data: null, error: new Error('not found') }));

      const result = await fetchGatePassByQrToken(CALLER_ID, CALLER_ROLE, 'missing');
      expect(result).toBeNull();
    });
  });

  // ── insertGatePass ─────────────────────────────────────────
  describe('insertGatePass', () => {
    it('calls rpc with correct payload', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await insertGatePass(CALLER_ID, CALLER_ROLE, { user_id: 'u1', qr_token: 'qr-new', keperluan: 'Cuti', tujuan: 'Rumah', waktu_keluar: now, waktu_kembali: now });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_gate_pass', expect.objectContaining({ p_user_id: 'u1', p_qr_token: 'qr-new' }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('insert failed') });
      await expect(insertGatePass(CALLER_ID, CALLER_ROLE, { user_id: 'u1', qr_token: 'x' })).rejects.toThrow('insert failed');
    });
  });

  // ── patchGatePassStatus ────────────────────────────────────
  describe('patchGatePassStatus', () => {
    it('calls rpc with correct status and approvedBy', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchGatePassStatus(CALLER_ID, CALLER_ROLE, 'gp1', 'approved', 'u2');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_gate_pass_status', expect.objectContaining({ p_id: 'gp1', p_status: 'approved', p_approved_by: 'u2' }));
    });

    it('passes approval reason for cancelled status', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchGatePassStatus(CALLER_ID, CALLER_ROLE, 'gp1', 'cancelled', undefined, 'Dibatalkan oleh pemohon');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_gate_pass_status', expect.objectContaining({
        p_id: 'gp1',
        p_status: 'cancelled',
        p_approval_reason: 'Dibatalkan oleh pemohon',
      }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('update failed') });
      await expect(patchGatePassStatus(CALLER_ID, CALLER_ROLE, 'gp1', 'rejected')).rejects.toThrow('update failed');
    });
  });

  // ── rpcScanGatePass ────────────────────────────────────────
  describe('rpcScanGatePass', () => {
    it('calls server_scan_gate_pass RPC and returns message', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: { message: 'Keluar berhasil' }, error: null });
      const result = await rpcScanGatePass(CALLER_ID, CALLER_ROLE, 'qr-1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('server_scan_gate_pass', { p_qr_token: 'qr-1' });
      expect(result).toBe('Keluar berhasil');
    });

    it('returns fallback message when data has no message field', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: {}, error: null });
      const result = await rpcScanGatePass(CALLER_ID, CALLER_ROLE, 'qr-1');
      expect(result).toBe('Scan berhasil');
    });

    it('throws on RPC error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('QR tidak valid') });
      await expect(rpcScanGatePass(CALLER_ID, CALLER_ROLE, 'bad')).rejects.toThrow('QR tidak valid');
    });
  });
});
