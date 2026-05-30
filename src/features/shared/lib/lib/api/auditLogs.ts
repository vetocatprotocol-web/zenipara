import { supabase } from '../supabase';
import type { AuditLog } from '../../types';

function isMissingExtendedClearRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === 'PGRST202'
    || maybeError.message?.includes('api_clear_audit_logs(p_caller_id, p_caller_role, p_older_than_days)')
    || maybeError.message?.includes('api_clear_audit_logs(uuid,text,integer)')
    || false;
}

export interface FetchAuditLogsParams {
  callerId: string;
  callerRole: string;
  userId?: string;
  action?: string;
  limit?: number;
}

export async function fetchAuditLogs(params: FetchAuditLogsParams): Promise<AuditLog[]> {
  const { data, error } = await supabase.rpc('api_get_audit_logs', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_filter_user_id: params.userId ?? null,
    p_action_filter: params.action ?? null,
    p_limit: params.limit ?? 100,
  });
  if (error) throw error;
  return (data as AuditLog[]) ?? [];
}

export async function clearAuditLogs(
  callerId: string,
  callerRole: string,
  olderThanDays: number | null = null,
): Promise<number> {
  const { data, error } = await supabase.rpc('api_clear_audit_logs', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_older_than_days: olderThanDays,
  });

  if (error && isMissingExtendedClearRpc(error)) {
    if (olderThanDays !== null) {
      throw new Error('Fitur hapus berdasarkan rentang hari belum tersedia di server. Jalankan migrasi Supabase terbaru.');
    }

    const fallback = await supabase.rpc('api_clear_audit_logs', {
      p_caller_id: callerId,
      p_caller_role: callerRole,
    });
    if (fallback.error) throw fallback.error;
    return Number(fallback.data ?? 0);
  }

  if (error) throw error;
  return Number(data ?? 0);
}
