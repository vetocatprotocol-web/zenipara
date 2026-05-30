import { supabase } from '../supabase';
import type { Kegiatan, RsvpStatus } from '../../types';

export interface FetchKegiatanParams {
  tanggalDari?: string;
  tanggalSampai?: string;
}

export async function fetchKegiatan(params: FetchKegiatanParams = {}): Promise<Kegiatan[]> {
  const { data, error } = await supabase.rpc('api_get_kegiatan', {
    p_tanggal_dari: params.tanggalDari ?? null,
    p_tanggal_sampai: params.tanggalSampai ?? null,
  });
  if (error) throw error;
  return (data as Kegiatan[]) ?? [];
}

export interface CreateKegiatanParams {
  judul: string;
  jenis: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  deskripsi?: string;
  lokasi?: string;
  targetRole?: string[];
  isWajib?: boolean;
  satuan?: string;
}

export async function createKegiatan(params: CreateKegiatanParams): Promise<string> {
  const { data, error } = await supabase.rpc('api_create_kegiatan', {
    p_judul: params.judul,
    p_jenis: params.jenis,
    p_tanggal_mulai: params.tanggalMulai,
    p_tanggal_selesai: params.tanggalSelesai,
    p_deskripsi: params.deskripsi ?? null,
    p_lokasi: params.lokasi ?? null,
    p_target_role: params.targetRole ?? null,
    p_is_wajib: params.isWajib ?? true,
    p_satuan: params.satuan ?? null,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('Gagal membuat kegiatan');
  return data;
}

export async function rsvpKegiatan(kegiatanId: string, status: RsvpStatus, alasan?: string): Promise<void> {
  const { error } = await supabase.rpc('api_rsvp_kegiatan', {
    p_kegiatan_id: kegiatanId,
    p_status: status,
    p_alasan: alasan ?? null,
  });
  if (error) throw error;
}

export async function deleteKegiatan(kegiatanId: string): Promise<void> {
  const { error } = await supabase.rpc('api_delete_kegiatan', {
    p_kegiatan_id: kegiatanId,
  });
  if (error) throw error;
}
