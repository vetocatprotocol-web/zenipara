import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import {
  createSprint,
  deleteSprint,
  fetchSprint,
  fetchSprintPersonel,
  updateSprintStatus,
} from '@/features/shared/lib/api/sprint';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
};

const CALLER_ID = 'u-1';
const CALLER_ROLE = 'komandan';

describe('sprint API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchSprint returns sprint rows', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: [{ id: 's1', nomor_surat: 'SPRINT/001/IV/2026/BAT', status: 'draft' }],
        error: null,
      });

    const result = await fetchSprint({ callerId: CALLER_ID, callerRole: CALLER_ROLE });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_sprint', { p_status: null });
    expect(result).toHaveLength(1);
  });

  it('fetchSprintPersonel returns personel rows', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: [{ sprint_id: 's1', user_id: 'u2' }], error: null });

    const result = await fetchSprintPersonel(CALLER_ID, CALLER_ROLE, 's1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_sprint_personel', { p_sprint_id: 's1' });
    expect(result[0].user_id).toBe('u2');
  });

  it('createSprint returns created id', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: 's-new', error: null });

    const id = await createSprint({
      callerId: CALLER_ID,
      callerRole: CALLER_ROLE,
      judul: 'Sprint Operasi',
      tujuan: 'Patroli',
      tempatTujuan: 'Sektor A',
      tanggalBerangkat: '2026-04-21',
      tanggalKembali: '2026-04-22',
    });

    expect(id).toBe('s-new');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_create_sprint', expect.objectContaining({
      p_judul: 'Sprint Operasi',
      p_tujuan: 'Patroli',
      p_tempat_tujuan: 'Sektor A',
    }));
  });

  it('updateSprintStatus calls status RPC', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await updateSprintStatus(CALLER_ID, CALLER_ROLE, 's1', 'approved');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_sprint_status', {
      p_sprint_id: 's1',
      p_status: 'approved',
    });
  });

  it('deleteSprint calls delete RPC', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await deleteSprint(CALLER_ID, CALLER_ROLE, 's1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_delete_sprint', { p_sprint_id: 's1' });
  });
});
