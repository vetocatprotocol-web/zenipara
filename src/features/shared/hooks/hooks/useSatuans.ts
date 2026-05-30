import { useCallback, useEffect, useState } from 'react';
import { fetchSatuans as fetchSatuansApi } from '../lib/api/satuans';
import type { Satuan } from '../types';

interface UseSatuansOptions {
  onlyActive?: boolean;
}

export function useSatuans(options: UseSatuansOptions = {}) {
  const { onlyActive = true } = options;
  const [satuans, setSatuans] = useState<Satuan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSatuans = useCallback(async (forceRefresh = false): Promise<Satuan[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchSatuansApi(!onlyActive, { forceRefresh });

      setSatuans(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data satuan';
      setError(message);
      setSatuans([]);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [onlyActive]);

  const refreshSatuans = useCallback(() => loadSatuans(true), [loadSatuans]);

  useEffect(() => {
    void loadSatuans().catch(() => undefined);
  }, [loadSatuans]);

  return {
    satuans,
    isLoading,
    error,
    fetchSatuans: loadSatuans,
    refreshSatuans,
  };
}
