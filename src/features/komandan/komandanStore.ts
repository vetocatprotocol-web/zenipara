import { create } from 'zustand';
import { handleError } from '@/features/shared/lib/handleError';
import { fetchKomandanDashboardStats } from '@/features/shared/lib/api/dashboard';
import { requestCoalescer } from '@/features/shared/lib/requestCoalescer';
import { CacheWithTTL } from '@/features/shared/lib/cacheWithTTL';

interface KomandanDashboardStore {
  onlineCount: number;
  totalPersonel: number;
  isLoading: boolean;
  error: string | null;
  fetchStats: (satuan?: string) => Promise<void>;
}

export const useKomandanDashboardStore = create<KomandanDashboardStore>((set) => ({
  onlineCount: 0,
  totalPersonel: 0,
  isLoading: false,
  error: null,

  fetchStats: async (satuan) => {
    if (!satuan) {
      set({ onlineCount: 0, totalPersonel: 0, isLoading: false, error: null });
      return;
    }

    const cacheKey = `komandan_stats:${satuan}`;
    const cache = new CacheWithTTL<string, { onlineCount: number; totalPersonel: number }>(5000);

    set({ isLoading: true, error: null });
    try {
      const stats = await requestCoalescer.coalesce(cacheKey, async () => {
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        const result = await fetchKomandanDashboardStats(satuan);
        cache.set(cacheKey, result, 5000);
        return result;
      });

      set({
        onlineCount: stats.onlineCount,
        totalPersonel: stats.totalPersonel,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: handleError(err, 'Gagal memuat statistik personel'),
      });
    }
  },
}));
