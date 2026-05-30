import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  fetchAnnouncements,
  insertAnnouncement,
  patchAnnouncement,
  deleteAnnouncement,
} from '@/features/shared/lib/api/announcements';
import type { Announcement } from '../../../types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'admin_satuan';

const sampleAnnouncements: Announcement[] = [
  { id: 'a1', judul: 'Pengumuman Upacara', isi: 'Upacara bendera dilaksanakan besok pagi', is_pinned: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'a2', judul: 'Jadwal Piket', isi: 'Harap cek jadwal piket minggu ini', is_pinned: false, created_at: '2024-01-02T00:00:00Z' },
];

describe('announcements API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('fetchAnnouncements', () => {
    it('returns list of announcements', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: sampleAnnouncements, error: null });
      const result = await fetchAnnouncements(CALLER_ID, CALLER_ROLE);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_announcements', { p_user_id: CALLER_ID, p_role: CALLER_ROLE });
      expect(result).toHaveLength(2);
      expect(result[0].judul).toBe('Pengumuman Upacara');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await fetchAnnouncements(CALLER_ID, CALLER_ROLE);
      expect(result).toEqual([]);
    });

    it('throws on supabase error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('fetch failed') });
      await expect(fetchAnnouncements(CALLER_ID, CALLER_ROLE)).rejects.toThrow('fetch failed');
    });
  });

  describe('insertAnnouncement', () => {
    it('calls rpc with correct data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await insertAnnouncement(CALLER_ID, CALLER_ROLE, { judul: 'Test', isi: 'Isi test', is_pinned: false });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_announcement', expect.objectContaining({ p_judul: 'Test', p_isi: 'Isi test' }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('insert failed') });
      await expect(insertAnnouncement(CALLER_ID, CALLER_ROLE, { judul: 'X', isi: 'Y' })).rejects.toThrow('insert failed');
    });
  });

  describe('patchAnnouncement', () => {
    it('calls rpc with correct params', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await patchAnnouncement(CALLER_ID, CALLER_ROLE, 'a1', { is_pinned: true });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_announcement', expect.objectContaining({ p_id: 'a1', p_updates: { is_pinned: true } }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('patch failed') });
      await expect(patchAnnouncement(CALLER_ID, CALLER_ROLE, 'a1', { judul: 'New' })).rejects.toThrow('patch failed');
    });
  });

  describe('deleteAnnouncement', () => {
    it('calls rpc with correct id', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      await deleteAnnouncement(CALLER_ID, CALLER_ROLE, 'a2');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_delete_announcement', expect.objectContaining({ p_id: 'a2' }));
    });

    it('throws when rpc fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('delete failed') });
      await expect(deleteAnnouncement(CALLER_ID, CALLER_ROLE, 'a99')).rejects.toThrow('delete failed');
    });
  });
});
