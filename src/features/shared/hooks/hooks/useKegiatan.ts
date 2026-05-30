import { useCallback, useEffect, useState } from 'react';
import {
  fetchKegiatan,
  createKegiatan,
  rsvpKegiatan,
  deleteKegiatan,
  type CreateKegiatanParams,
  type FetchKegiatanParams,
} from '../lib/api/kegiatan';
import type { Kegiatan, RsvpStatus } from '../types';

interface UseKegiatanOptions {
  autoFetch?: boolean;
  filters?: FetchKegiatanParams;
}

interface UseKegiatanReturn {
  kegiatan: Kegiatan[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNewKegiatan: (params: CreateKegiatanParams) => Promise<string>;
  respondRsvp: (kegiatanId: string, status: RsvpStatus, alasan?: string) => Promise<void>;
  removeKegiatan: (kegiatanId: string) => Promise<void>;
}

export function useKegiatan(options: UseKegiatanOptions = {}): UseKegiatanReturn {
  const { autoFetch = true, filters = {} } = options;
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchKegiatan(filters);
      setKegiatan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kegiatan');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tanggalDari, filters.tanggalSampai]);

  useEffect(() => {
    if (autoFetch) void load();
  }, [autoFetch, load]);

  const createNewKegiatan = useCallback(async (params: CreateKegiatanParams): Promise<string> => {
    const id = await createKegiatan(params);
    await load();
    return id;
  }, [load]);

  const respondRsvp = useCallback(async (kegiatanId: string, status: RsvpStatus, alasan?: string) => {
    await rsvpKegiatan(kegiatanId, status, alasan);
    await load();
  }, [load]);

  const removeKegiatan = useCallback(async (kegiatanId: string) => {
    await deleteKegiatan(kegiatanId);
    setKegiatan((prev) => prev.filter((k) => k.id !== kegiatanId));
  }, []);

  return {
    kegiatan,
    isLoading,
    error,
    refetch: load,
    createNewKegiatan,
    respondRsvp,
    removeKegiatan,
  };
}
