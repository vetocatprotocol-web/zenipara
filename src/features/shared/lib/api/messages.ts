import { supabase } from '../supabase';
import type { Message } from '../../types';
import { ensureSessionContext } from './sessionContext';

export async function fetchInbox(callerId: string, callerRole: string): Promise<Message[]> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_get_inbox', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;
  return (data as Message[]) ?? [];
}

export async function fetchSent(callerId: string, callerRole: string): Promise<Message[]> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_get_sent', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;
  return (data as Message[]) ?? [];
}

export async function insertMessage(callerId: string, callerRole: string, fromUser: string, toUser: string, isi: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_insert_message', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_from_user: fromUser,
    p_to_user: toUser,
    p_isi: isi,
  });
  if (error) throw error;
}

export async function markMessageRead(callerId: string, callerRole: string, messageId: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_mark_message_read', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function markAllMessagesRead(callerId: string, callerRole: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_mark_all_messages_read', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
  });
  if (error) throw error;
}
