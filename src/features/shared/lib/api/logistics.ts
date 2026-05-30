import { supabase } from '../supabase';
import type { LogisticsRequest, LogisticsRequestStatus } from '../../types';

export interface FetchLogisticsRequestsParams {
  callerId: string;
  callerRole: string;
  satuan?: string;
  requestedBy?: string;
}

export async function fetchLogisticsRequests(
  params: FetchLogisticsRequestsParams,
): Promise<LogisticsRequest[]> {
  const { data, error } = await supabase.rpc('api_get_logistics_requests', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_satuan_filter: params.satuan ?? null,
    p_requested_by: params.requestedBy ?? null,
  });
  if (error) throw error;
  return (data as LogisticsRequest[]) ?? [];
}

export async function insertLogisticsRequest(callerId: string, callerRole: string, data: {
  nama_item: string;
  jumlah: number;
  satuan_item?: string;
  alasan: string;
  requested_by: string;
  satuan: string;
}): Promise<void> {
  const { error } = await supabase.rpc('api_insert_logistics_request', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_satuan: data.satuan,
    p_nama_item: data.nama_item,
    p_jumlah: data.jumlah,
    p_satuan_item: data.satuan_item ?? null,
    p_alasan: data.alasan,
  });
  if (error) throw error;
}

export async function patchLogisticsRequestStatus(
  callerId: string,
  callerRole: string,
  id: string,
  status: Extract<LogisticsRequestStatus, 'approved' | 'rejected'>,
  _reviewedBy: string,
  adminNote?: string,
): Promise<void> {
  const { error } = await supabase.rpc('api_update_logistics_status', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
    p_status: status,
    p_admin_note: adminNote ?? null,
  });
  if (error) throw error;
}
