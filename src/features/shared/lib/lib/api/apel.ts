import { supabase } from '../supabase';
import type { ApelAttendance, ApelJenis, ApelSession } from '../../types';

interface CreateApelSessionParams {
  jenis: ApelJenis;
  tanggal: string;
  waktuBukaISO: string;
  waktuTutupISO: string;
  satuan?: string;
}

export async function fetchApelSessions(tanggal?: string): Promise<ApelSession[]> {
  const { data, error } = await supabase.rpc('api_get_apel_sessions', {
    p_tanggal: tanggal ?? null,
  });
  if (error) throw error;
  return (data as ApelSession[]) ?? [];
}

export async function createApelSession(params: CreateApelSessionParams): Promise<string> {
  const { data, error } = await supabase.rpc('api_create_apel_session', {
    p_jenis: params.jenis,
    p_tanggal: params.tanggal,
    p_waktu_buka: params.waktuBukaISO,
    p_waktu_tutup: params.waktuTutupISO,
    p_satuan: params.satuan ?? null,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('Sesi apel gagal dibuat');
  return data;
}

export async function laporHadirApel(sessionId: string, keterangan?: string): Promise<ApelAttendance> {
  const { data, error } = await supabase.rpc('api_lapor_hadir_apel', {
    p_session_id: sessionId,
    p_keterangan: keterangan?.trim() || null,
  });
  if (error) throw error;
  return data as ApelAttendance;
}

export async function fetchApelSessionAttendance(sessionId: string): Promise<ApelAttendance[]> {
  const { data, error } = await supabase.rpc('api_get_apel_session_attendance', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return (data as ApelAttendance[]) ?? [];
}
