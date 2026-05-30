import { useCallback, useEffect, useState } from 'react';
import {
  createSprint,
  deleteSprint,
  fetchSprint,
  fetchSprintPersonel,
  laporanKembaliSprint,
  updateSprintStatus,
  type CreateSprintParams,
} from '../lib/api/sprint';
import { useAuthStore } from '../store/authStore';
import type { Sprint, SprintPersonel, SprintStatus } from '../types';

interface UseSprintReturn {
  sprint: Sprint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getPersonel: (sprintId: string) => Promise<SprintPersonel[]>;
  createNewSprint: (params: Omit<CreateSprintParams, 'callerId' | 'callerRole'>) => Promise<string>;
  setStatus: (sprintId: string, status: SprintStatus) => Promise<void>;
  kirimLaporanKembali: (sprintId: string, laporan: string) => Promise<void>;
  removeSprint: (sprintId: string) => Promise<void>;
}

export function useSprint(): UseSprintReturn {
  const user = useAuthStore((s) => s.user);
  const [sprint, setSprint] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setSprint([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSprint({ callerId: user.id, callerRole: user.role });
      setSprint(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat sprint');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const getPersonel = useCallback(async (sprintId: string) => {
    if (!user) throw new Error('Not authenticated');
    return fetchSprintPersonel(user.id, user.role, sprintId);
  }, [user]);

  const createNewSprint = useCallback(async (params: Omit<CreateSprintParams, 'callerId' | 'callerRole'>) => {
    if (!user) throw new Error('Not authenticated');
    const createdId = await createSprint({
      ...params,
      callerId: user.id,
      callerRole: user.role,
    });
    await load();
    return createdId;
  }, [load, user]);

  const setStatus = useCallback(async (sprintId: string, status: SprintStatus) => {
    if (!user) throw new Error('Not authenticated');
    await updateSprintStatus(user.id, user.role, sprintId, status);
    await load();
  }, [load, user]);

  const kirimLaporanKembali = useCallback(async (sprintId: string, laporan: string) => {
    if (!user) throw new Error('Not authenticated');
    await laporanKembaliSprint(user.id, user.role, sprintId, laporan);
    await load();
  }, [load, user]);

  const removeSprint = useCallback(async (sprintId: string) => {
    if (!user) throw new Error('Not authenticated');
    await deleteSprint(user.id, user.role, sprintId);
    setSprint((prev) => prev.filter((item) => item.id !== sprintId));
  }, [user]);

  return {
    sprint,
    isLoading,
    error,
    refetch: load,
    getPersonel,
    createNewSprint,
    setStatus,
    kirimLaporanKembali,
    removeSprint,
  };
}
