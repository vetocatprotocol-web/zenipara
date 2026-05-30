import { supabase } from '../supabase';
import type { LeaveRequest, LeaveStatus } from '../../types';

export interface FetchLeaveRequestsParams {
  callerId: string;
  callerRole: string;
  userId?: string;
}

export async function fetchLeaveRequests(params: FetchLeaveRequestsParams): Promise<LeaveRequest[]> {
  const { data, error } = await supabase.rpc('api_get_leave_requests', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_target_user_id: params.userId ?? null,
  });
  if (error) throw error;
  return (data as LeaveRequest[]) ?? [];
}

export async function insertLeaveRequest(_callerId: string, callerRole: string, data: {
  user_id: string;
  jenis_izin: 'cuti' | 'sakit' | 'dinas_luar';
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
}): Promise<void> {
  const { error } = await supabase.rpc('api_insert_leave_request', {
    p_user_id: data.user_id,
    p_caller_role: callerRole,
    p_jenis_izin: data.jenis_izin,
    p_tanggal_mulai: data.tanggal_mulai,
    p_tanggal_selesai: data.tanggal_selesai,
    p_alasan: data.alasan,
  });
  if (error) throw error;
}

export async function patchLeaveRequestStatus(
  callerId: string,
  callerRole: string,
  id: string,
  status: LeaveStatus,
  reviewedBy: string,
): Promise<void> {
  const { error } = await supabase.rpc('api_update_leave_request_status', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
    p_status: status,
    p_reviewed_by: reviewedBy,
  });
  if (error) throw error;
}
