import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readSessionContext } from '../lib/sessionContext';
import type { SatuanBranding } from '../types';

export default function useSatuanBranding(satuanIdParam?: string) {
  const [branding, setBranding] = useState<SatuanBranding | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = readSessionContext();
  const satuanId = satuanIdParam ?? session?.satuan_id ?? null;

  const fetchBranding = useCallback(async () => {
    if (!satuanId) {
      setBranding(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('satuans').select('branding').eq('id', satuanId).single();
      if (error) throw error;
      setBranding((data as any)?.branding ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [satuanId]);

  useEffect(() => {
    void fetchBranding();
  }, [fetchBranding]);

  const updateBranding = useCallback(
    async (newBranding: SatuanBranding) => {
      if (!satuanId) throw new Error('Satuan ID tidak tersedia');
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('satuans')
          .update({ branding: newBranding })
          .eq('id', satuanId)
          .select()
          .single();
        if (error) throw error;
        setBranding((data as any)?.branding ?? null);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [satuanId],
  );

  return { branding, isLoading, error, fetchBranding, updateBranding };
}
