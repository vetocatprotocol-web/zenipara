import { supabase } from '../supabase';
import type { Announcement, Role } from '../../types';
import { ensureSessionContext } from './sessionContext';

export async function fetchAnnouncements(callerId: string, callerRole: string): Promise<Announcement[]> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_get_announcements', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;
  return (data as Announcement[]) ?? [];
}

export async function insertAnnouncement(callerId: string, callerRole: string, data: {
  judul: string;
  isi: string;
  created_by?: string;
  target_role?: Role[];
  target_satuan?: string;
  is_pinned?: boolean;
}): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_insert_announcement', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_judul: data.judul,
    p_isi: data.isi,
    p_created_by: data.created_by ?? null,
    p_target_role: data.target_role ?? null,
    p_target_satuan: data.target_satuan ?? null,
    p_is_pinned: data.is_pinned ?? false,
  });
  if (error) throw error;
}

export async function patchAnnouncement(callerId: string, callerRole: string, id: string, updates: Partial<Announcement>): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_update_announcement', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
    p_updates: updates,
  });
  if (error) throw error;
}

export async function deleteAnnouncement(callerId: string, callerRole: string, id: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_delete_announcement', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
  });
  if (error) throw error;
}
