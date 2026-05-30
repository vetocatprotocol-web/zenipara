import { supabase } from '../supabase';
import type { Document } from '../../types';

export async function fetchDocuments(callerId: string, callerRole: string): Promise<Document[]> {
  const { data, error } = await supabase.rpc('api_get_documents', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;
  return (data as Document[]) ?? [];
}

export async function insertDocument(callerId: string, callerRole: string, data: {
  nama: string;
  kategori?: string | null;
  file_url: string;
  satuan?: string | null;
  file_size?: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc('api_insert_document', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_nama: data.nama,
    p_kategori: data.kategori ?? null,
    p_file_url: data.file_url,
    p_satuan: data.satuan ?? null,
    p_file_size: data.file_size ?? null,
  });
  if (error) throw error;
}

export async function deleteDocument(callerId: string, callerRole: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('api_delete_document', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_id: id,
  });
  if (error) throw error;
}
