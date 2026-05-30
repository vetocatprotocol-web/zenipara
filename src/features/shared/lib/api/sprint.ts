import { supabase } from '../supabase';
import { ensureSessionContext } from './sessionContext';
import type { Sprint, SprintPersonel, SprintStatus } from '../../types';

export interface FetchSprintParams {
  callerId: string;
  callerRole: string;
  status?: SprintStatus;
}

export async function fetchSprint(params: FetchSprintParams): Promise<Sprint[]> {
  await ensureSessionContext(params.callerId, params.callerRole);
  const { data, error } = await supabase.rpc('api_get_sprint', {
    p_status: params.status ?? null,
  });
  if (error) throw error;
  return (data as Sprint[]) ?? [];
}

export async function fetchSprintPersonel(callerId: string, callerRole: string, sprintId: string): Promise<SprintPersonel[]> {
  await ensureSessionContext(callerId, callerRole);
  const { data, error } = await supabase.rpc('api_get_sprint_personel', {
    p_sprint_id: sprintId,
  });
  if (error) throw error;
  return (data as SprintPersonel[]) ?? [];
}

export interface CreateSprintParams {
  callerId: string;
  callerRole: string;
  judul: string;
  tujuan: string;
  tempatTujuan: string;
  tanggalBerangkat: string;
  tanggalKembali: string;
  dasar?: string;
  personelIds?: string[];
  jabatanIds?: string[];
}

export async function createSprint(params: CreateSprintParams): Promise<string> {
  await ensureSessionContext(params.callerId, params.callerRole);
  const { data, error } = await supabase.rpc('api_create_sprint', {
    p_judul: params.judul,
    p_tujuan: params.tujuan,
    p_tempat_tujuan: params.tempatTujuan,
    p_tanggal_berangkat: params.tanggalBerangkat,
    p_tanggal_kembali: params.tanggalKembali,
    p_dasar: params.dasar ?? null,
    p_personel_ids: params.personelIds ?? null,
    p_jabatan_ids: params.jabatanIds ?? null,
  });

  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('Gagal membuat sprint');
  return data;
}

export async function updateSprintStatus(
  callerId: string,
  callerRole: string,
  sprintId: string,
  status: SprintStatus,
): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_update_sprint_status', {
    p_sprint_id: sprintId,
    p_status: status,
  });
  if (error) throw error;
}

export async function laporanKembaliSprint(callerId: string, callerRole: string, sprintId: string, laporan: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_laporan_kembali_sprint', {
    p_sprint_id: sprintId,
    p_laporan: laporan,
  });
  if (error) throw error;
}

export async function deleteSprint(callerId: string, callerRole: string, sprintId: string): Promise<void> {
  await ensureSessionContext(callerId, callerRole);
  const { error } = await supabase.rpc('api_delete_sprint', {
    p_sprint_id: sprintId,
  });
  if (error) throw error;
}
