import { useCallback, useEffect, useState } from 'react';
import {
  fetchLaporanOps,
  createLaporanOps,
  updateLaporanOpsStatus,
  deleteLaporanOps,
  type CreateLaporanOpsParams,
  type FetchLaporanOpsParams,
} from '../lib/api/laporanOps';
import type { LaporanOps, LaporanOpsStatus } from '../types';

interface UseLaporanOpsOptions {
  autoFetch?: boolean;
  filters?: FetchLaporanOpsParams;
}

interface UseLaporanOpsReturn {
  laporan: LaporanOps[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createLaporan: (params: CreateLaporanOpsParams) => Promise<string>;
  updateStatus: (laporanId: string, status: LaporanOpsStatus) => Promise<void>;
  removeLaporan: (laporanId: string) => Promise<void>;
}

export function useLaporanOps(options: UseLaporanOpsOptions = {}): UseLaporanOpsReturn {
  const { autoFetch = true, filters = {} } = options;
  const [laporan, setLaporan] = useState<LaporanOps[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLaporanOps(filters);
      setLaporan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.jenis, filters.tanggalDari, filters.tanggalSampai]);

  useEffect(() => {
    if (autoFetch) void load();
  }, [autoFetch, load]);

  const createLaporan = useCallback(async (params: CreateLaporanOpsParams): Promise<string> => {
    const id = await createLaporanOps(params);
    await load();
    return id;
  }, [load]);

  const updateStatus = useCallback(async (laporanId: string, status: LaporanOpsStatus) => {
    await updateLaporanOpsStatus(laporanId, status);
    setLaporan((prev) =>
      prev.map((l) => l.id === laporanId ? { ...l, status } : l)
    );
  }, []);

  const removeLaporan = useCallback(async (laporanId: string) => {
    await deleteLaporanOps(laporanId);
    setLaporan((prev) => prev.filter((l) => l.id !== laporanId));
  }, []);

  return {
    laporan,
    isLoading,
    error,
    refetch: load,
    createLaporan,
    updateStatus,
    removeLaporan,
  };
}
