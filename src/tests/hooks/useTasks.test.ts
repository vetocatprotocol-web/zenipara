import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks, clearTasksCache } from '@/features/shared/hooks/useTasks';
import { supabase } from '@/features/shared/lib/supabase';
import { useAuthStore } from '@/features/auth/authStore';
import type { Task } from '@/types';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const mockUser = {
  id: 'user-1', nrp: '12345', nama: 'Komandan A', role: 'komandan' as const,
  satuan: 'Satuan A', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const mockTasks: Task[] = [
  { id: 't1', judul: 'Tugas Pertama', status: 'pending', prioritas: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 't2', judul: 'Tugas Kedua', status: 'in_progress', prioritas: 2, created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
];

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTasksCache();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    mockSupabase.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
    mockSupabase.removeChannel.mockResolvedValue(undefined);
  });

  it('loads tasks on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0].judul).toBe('Tugas Pertama');
  });

  it('sets error when fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('db error') });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('db error');
    expect(result.current.tasks).toHaveLength(0);
  });

  it('createTask calls rpc insert with correct data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTask({ judul: 'New Task', assigned_to: 'user-2', prioritas: 1 });
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_task',
      expect.objectContaining({ p_judul: 'New Task', p_assigned_to: 'user-2', p_assigned_by: 'user-1' })
    );
  });

  it('createTask throws when rpc returns error', async () => {
    mockSupabase.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'set_session_context') {
        return Promise.resolve({ data: null, error: null });
      }
      if (rpcName === 'api_get_tasks') {
        return Promise.resolve({ data: mockTasks, error: null });
      }
      if (rpcName === 'api_insert_task') {
        return Promise.resolve({ data: null, error: new Error('insert failed') });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.createTask({ judul: 'Bad', assigned_to: 'u2', prioritas: 2 })).rejects.toThrow('insert failed');
  });

  it('approveTask calls rpc with approved status', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.approveTask('t1'); });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_task_status',
      expect.objectContaining({ p_task_id: 't1', p_status: 'approved' })
    );
  });

  it('rejectTask saves rejection note and sets status to in_progress', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.rejectTask('t1', 'Revisi diperlukan'); });

    // report insert
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_task_report',
      expect.objectContaining({ p_isi_laporan: '[DITOLAK] Revisi diperlukan', p_task_id: 't1' })
    );
    // status update
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_task_status',
      expect.objectContaining({ p_task_id: 't1', p_status: 'in_progress' })
    );
  });

  it('rejectTask without note skips insert', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.rejectTask('t1'); });

    const rpcCalls = (mockSupabase.rpc as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(rpcCalls).not.toContain('api_insert_task_report');
    expect(rpcCalls).toContain('api_update_task_status');
  });

  it('submitTaskReport calls insert and then update', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockTasks, error: null });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.submitTaskReport('t1', 'Laporan selesai'); });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_insert_task_report',
      expect.objectContaining({ p_isi_laporan: 'Laporan selesai', p_task_id: 't1' })
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_task_status',
      expect.objectContaining({ p_task_id: 't1', p_status: 'done' })
    );
  });

  it('getTaskReport calls api_get_latest_task_report rpc', async () => {
    mockSupabase.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'api_get_tasks') return Promise.resolve({ data: mockTasks, error: null });
      if (rpcName === 'api_get_latest_task_report') return Promise.resolve({ data: [{ id: 'r1', task_id: 't1', isi_laporan: 'report' }], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let report: unknown;
    await act(async () => { report = await result.current.getTaskReport('t1'); });

    expect(report).toMatchObject({ id: 'r1', task_id: 't1' });
  });
});
