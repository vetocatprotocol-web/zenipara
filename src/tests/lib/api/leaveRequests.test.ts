import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  fetchLeaveRequests,
  insertLeaveRequest,
  patchLeaveRequestStatus,
} from '@/features/shared/lib/api/leaveRequests';
import type { LeaveRequest } from '@/types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'prajurit';

const sampleRequests: LeaveRequest[] = [
  {
    id: 'lr1', user_id: 'u1', jenis_izin: 'cuti',
    tanggal_mulai: '2024-02-01', tanggal_selesai: '2024-02-05',
    alasan: 'Liburan', status: 'pending', created_at: '2024-01-15T00:00:00Z',
  },
];

describe('leaveRequests API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('fetchLeaveRequests', () => {
    it('returns list of leave requests', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleRequests, error: null });
      const result = await fetchLeaveRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_leave_requests', expect.objectContaining({ p_user_id: CALLER_ID, p_role: CALLER_ROLE }));
      expect(result).toHaveLength(1);
      expect(result[0].jenis_izin).toBe('cuti');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await fetchLeaveRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch error') });
      await expect(fetchLeaveRequests({ callerId: CALLER_ID, callerRole: CALLER_ROLE })).rejects.toThrow('fetch error');
    });
  });

  describe('insertLeaveRequest', () => {
    it('calls rpc with correct data including status=pending via role', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await insertLeaveRequest(CALLER_ID, CALLER_ROLE, {
        user_id: 'u1', jenis_izin: 'cuti',
        tanggal_mulai: '2024-03-01', tanggal_selesai: '2024-03-05', alasan: 'Keluarga',
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_leave_request', expect.objectContaining({ p_user_id: 'u1', p_jenis_izin: 'cuti' }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('insert failed') });
      await expect(
        insertLeaveRequest(CALLER_ID, CALLER_ROLE, { user_id: 'u1', jenis_izin: 'sakit', tanggal_mulai: '2024-03-01', tanggal_selesai: '2024-03-03', alasan: 'Demam' })
      ).rejects.toThrow('insert failed');
    });
  });

  describe('patchLeaveRequestStatus', () => {
    it('calls rpc with status and reviewer info', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchLeaveRequestStatus(CALLER_ID, 'komandan', 'lr1', 'approved', 'u2');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_leave_request_status', expect.objectContaining({
        p_id: 'lr1', p_status: 'approved', p_reviewed_by: 'u2',
      }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('update failed') });
      await expect(patchLeaveRequestStatus(CALLER_ID, 'komandan', 'lr1', 'rejected', 'u2')).rejects.toThrow('update failed');
    });
  });
});
