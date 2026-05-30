import { supabase } from '../supabase';
import type { LaporanOps } from '../../types';

export interface FetchLaporanOpsParams {
  status?: string;
  jenis?: string;
  tanggalDari?: string;
  tanggalSampai?: string;
}

export async function fetchLaporanOps(params: FetchLaporanOpsParams = {}): Promise<LaporanOps[]> {
  const { data, error } = await supabase.rpc('api_get_laporan_ops', {
    p_status: params.status ?? null,
    p_jenis: params.jenis ?? null,
    p_tanggal_dari: params.tanggalDari ?? null,
    p_tanggal_sampai: params.tanggalSampai ?? null,
  });
  if (error) throw error;
  return (data as LaporanOps[]) ?? [];
}

export interface CreateLaporanOpsParams {
  judul: string;
  jenis: string;
  tanggalKejadian: string;
  uraian: string;
  waktuKejadian?: string;
  lokasi?: string;
  tindakan?: string;
  rekomendasi?: string;
}

export async function createLaporanOps(params: CreateLaporanOpsParams): Promise<string> {
  const { data, error } = await supabase.rpc('api_create_laporan_ops', {
    p_judul: params.judul,
    p_jenis: params.jenis,
    p_tanggal_kejadian: params.tanggalKejadian,
    p_uraian: params.uraian,
    p_waktu_kejadian: params.waktuKejadian ?? null,
    p_lokasi: params.lokasi ?? null,
    p_tindakan: params.tindakan ?? null,
    p_rekomendasi: params.rekomendasi ?? null,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('Gagal membuat laporan');
  return data;
}

export async function updateLaporanOpsStatus(laporanId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('api_update_laporan_ops_status', {
    p_laporan_id: laporanId,
    p_status: status,
  });
  if (error) throw error;
}

export async function deleteLaporanOps(laporanId: string): Promise<void> {
  const { error } = await supabase.rpc('api_delete_laporan_ops', {
    p_laporan_id: laporanId,
  });
  if (error) throw error;
}
