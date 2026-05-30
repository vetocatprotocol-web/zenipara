import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  fetchLogisticsRequests,
  insertLogisticsRequest,
  patchLogisticsRequestStatus,
} from '@/features/shared/lib/api/logistics';
import type { LogisticsRequest } from '../../../types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'prajurit';

const sampleRequests: LogisticsRequest[] = [
  {
    id: 'req1', nama_item: 'Peluru', jumlah: 100, satuan_item: 'butir',
    alasan: 'Latihan', requested_by: 'u1', satuan: 'Satuan A',
    status: 'pending', created_at: '2024-01-01T00:00:00Z',
  },
] as LogisticsRequest[];

describe('logistics API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('fetchLogisticsRequests', () => {
    it('returns list of logistics requests', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleRequests, error: null });
      const result = await fetchLogisticsRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_logistics_requests', expect.objectContaining({ p_user_id: CALLER_ID, p_role: CALLER_ROLE }));
      expect(result).toHaveLength(1);
      expect(result[0].nama_item).toBe('Peluru');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await fetchLogisticsRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });
      await expect(fetchLogisticsRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE })).rejects.toThrow('fetch error');
    });
  });

  describe('insertLogisticsRequest', () => {
    it('calls rpc with correct data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await insertLogisticsRequest(CALLER_ID, CALLER_ROLE, {
        nama_item: 'Seragam', jumlah: 5, alasan: 'Rusak', requested_by: 'u1', satuan: 'Satuan B',
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_logistics_request', expect.objectContaining({ p_nama_item: 'Seragam', p_jumlah: 5 }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('insert failed') });
      await expect(insertLogisticsRequest(CALLER_ID, CALLER_ROLE, { nama_item: 'X', jumlah: 1, alasan: 'Y', requested_by: 'u1', satuan: 'A' })).rejects.toThrow('insert failed');
    });
  });

  describe('patchLogisticsRequestStatus', () => {
    it('calls rpc with status approved and admin_note', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchLogisticsRequestStatus(CALLER_ID, 'admin', 'req1', 'approved', 'u2', 'Disetujui');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_logistics_status', expect.objectContaining({
        p_id: 'req1', p_status: 'approved', p_admin_note: 'Disetujui',
      }));
    });

    it('passes null admin_note when not provided', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchLogisticsRequestStatus(CALLER_ID, 'admin', 'req1', 'rejected', 'u2');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_logistics_status', expect.objectContaining({ p_admin_note: null }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('update failed') });
      await expect(patchLogisticsRequestStatus(CALLER_ID, 'admin', 'req1', 'approved', 'u2')).rejects.toThrow('update failed');
    });
  });
});
