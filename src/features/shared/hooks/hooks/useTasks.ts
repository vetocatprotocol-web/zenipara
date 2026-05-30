import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchTasks as apiFetchTasks, insertTask, patchTaskStatus, insertTaskReport, fetchLatestTaskReport } from '../lib/api/tasks';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { SimpleCache } from '../lib/cache';
import type { Task, TaskStatus } from '../types';
import { useAuthStore } from '../store/authStore';

interface UseTasksOptions {
  assignedTo?: string;
  assignedBy?: string;
  status?: TaskStatus;
  satuan?: string;
}

/** Module-level cache: data tasks di-cache 5 menit per kombinasi filter */
const tasksCache = new SimpleCache<Task[]>();

function buildCacheKey(opts: UseTasksOptions): string {
  return JSON.stringify({
    a: opts.assignedTo ?? '',
    b: opts.assignedBy ?? '',
    s: opts.status ?? '',
    t: opts.satuan ?? '',
  });
}

/** Hapus semua cache tugas — berguna untuk pengujian unit. */
export function clearTasksCache(): void {
  tasksCache.clear();
}

export function useTasks(options: UseTasksOptions = {}) {
  const { user } = useAuthStore();

  // Request coalescing: prevent duplicate simultaneous fetches when realtime burst occurs
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchTasksRef = useRef<(() => Promise<void>) | null>(null);
  const hasLoadedRef = useRef(false);

  // Stabilize cacheKey so it only changes when the option values change (not object references)
  const cacheKey = useMemo(
    () => buildCacheKey(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.assignedTo, options.assignedBy, options.status, options.satuan],
  );

  // Seed initial state from cache so the list renders immediately on revisit
  const [tasks, setTasks] = useState<Task[]>(() => tasksCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(() => !tasksCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const setTasksIfChanged = useCallback((next: Task[]) => {
    setTasks((prev) => {
      if (prev.length === next.length) {
        const unchanged = prev.every((item, idx) => item.id === next[idx]?.id && item.updated_at === next[idx]?.updated_at);
        if (unchanged) return prev;
      }
      return next;
    });
  }, []);

  const fetchTasks = useCallback(async (force = false) => {
    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    if (!user) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    if (!force) {
      const cached = tasksCache.get(cacheKey);
      if (cached) {
        setTasksIfChanged(cached);
        hasLoadedRef.current = true;
        setIsLoading(false);
        return;
      }
    }
    isFetchingRef.current = true;
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await apiFetchTasks({
        callerId: user.id,
        callerRole: user.role,
        assignedTo: options.assignedTo,
        assignedBy: options.assignedBy,
        status: options.status,
        satuan: options.satuan,
      });
      tasksCache.set(cacheKey, data);
      setTasksIfChanged(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(handleError(err, 'Gagal memuat data tugas'));
    } finally {
      isFetchingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        await fetchTasksRef.current?.();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, cacheKey, options.assignedTo, options.assignedBy, options.status, options.satuan, setTasksIfChanged]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    return subscribeDataChanges('tasks', () => {
      tasksCache.invalidate(cacheKey);
      void fetchTasks(true);
    }, { debounceMs: 220 });
  }, [cacheKey, fetchTasks]);

  /**
   * Sync the current fetchTasks function to the ref so queued refreshes
   * have access to the latest version with updated dependencies.
   */
  useEffect(() => {
    fetchTasksRef.current = fetchTasks;
  }, [fetchTasks]);

  const createTask = async (taskData: {
    judul: string;
    deskripsi?: string;
    assigned_to: string;
    deadline?: string;
    prioritas: 1 | 2 | 3;
    satuan?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');
    await insertTask(user.id, user.role, { ...taskData, assigned_by: user.id });
    tasksCache.invalidate(cacheKey);
    notifyDataChanged('tasks');
    await fetchTasks(true);
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!user) throw new Error('Not authenticated');
    await patchTaskStatus(user.id, user.role, taskId, status);
    tasksCache.invalidate(cacheKey);
    notifyDataChanged('tasks');
    await fetchTasks(true);
  };

  /**
   * Approve a task: status → 'approved' and log the action.
   */
  const approveTask = async (taskId: string) => {
    await updateTaskStatus(taskId, 'approved');
  };

  /**
   * Reject a task per spec §8.3: status reverts to 'in_progress' so the
   * prajurit can revise and resubmit. An optional rejection note is saved
   * as a new task_report row (type = 'rejection').
   */
  const rejectTask = async (taskId: string, catatan?: string) => {
    if (!user) throw new Error('Not authenticated');
    if (catatan?.trim()) {
      await insertTaskReport(user.id, user.role, {
        task_id: taskId,
        user_id: user.id,
        isi_laporan: `[DITOLAK] ${catatan.trim()}`,
      });
    }
    await updateTaskStatus(taskId, 'in_progress');
  };

  const submitTaskReport = async (taskId: string, isiLaporan: string, fileUrl?: string) => {
    if (!user) throw new Error('Not authenticated');
    await insertTaskReport(user.id, user.role, { task_id: taskId, user_id: user.id, isi_laporan: isiLaporan, file_url: fileUrl });
    await updateTaskStatus(taskId, 'done');
    notifyDataChanged('tasks');
  };

  /**
   * Fetch the most recent task report for a given task_id (for approval review).
   */
  const getTaskReport = async (taskId: string) => {
    if (!user) return null;
    return fetchLatestTaskReport(user.id, user.role, taskId);
  };

  return {
    tasks,
    isLoading,
    error,
    refetch: () => fetchTasks(true),
    createTask,
    updateTaskStatus,
    approveTask,
    rejectTask,
    submitTaskReport,
    getTaskReport,
  };
}
