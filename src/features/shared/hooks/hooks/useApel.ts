import { useCallback, useEffect, useState } from 'react';
import {
  createApelSession as apiCreateApelSession,
  fetchApelSessionAttendance as apiFetchApelSessionAttendance,
  fetchApelSessions as apiFetchApelSessions,
  laporHadirApel as apiLaporHadirApel,
} from '../lib/api/apel';
import { handleError } from '../lib/handleError';
import type { ApelAttendance, ApelJenis, ApelSession } from '../types';

interface CreateApelInput {
  jenis: ApelJenis;
  tanggal: string;
  waktuBukaISO: string;
  waktuTutupISO: string;
  satuan?: string;
}

export function useApel() {
  const [sessions, setSessions] = useState<ApelSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (tanggal?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetchApelSessions(tanggal);
      setSessions(data);
    } catch (err) {
      setError(handleError(err, 'Gagal memuat sesi apel'));
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSession = useCallback(async (payload: CreateApelInput) => {
    await apiCreateApelSession(payload);
    await loadSessions(payload.tanggal);
  }, [loadSessions]);

  const laporHadir = useCallback(async (sessionId: string, keterangan?: string) => {
    const result = await apiLaporHadirApel(sessionId, keterangan);
    return result;
  }, []);

  const getSessionAttendance = useCallback(async (sessionId: string): Promise<ApelAttendance[]> => {
    return apiFetchApelSessionAttendance(sessionId);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    loadSessions,
    createSession,
    laporHadir,
    getSessionAttendance,
  };
}
