import { create } from 'zustand';
import { handleError } from '@/features/shared/lib/handleError';
import {
  fetchAdminDashboardSnapshot,
  refreshAdminDashboardSnapshot,
  type AdminDashboardSnapshot,
} from '@/features/shared/lib/api/dashboard';

interface AdminDashboardStore {
  snapshot: AdminDashboardSnapshot | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchDashboard: () => Promise<boolean>;
  refreshDashboard: () => Promise<boolean>;
  getStats: () => AdminDashboardSnapshot['stats'] | null;
  getGatePassStats: () => AdminDashboardSnapshot['gatePassStats'] | null;
}

export const useAdminDashboardStore = create<AdminDashboardStore>((set, get) => ({
  snapshot: null,
  isLoading: true,
  isRefreshing: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await fetchAdminDashboardSnapshot();
      set({ snapshot, isLoading: false, isRefreshing: false, error: null });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        isRefreshing: false,
        error: handleError(err, 'Gagal memuat dashboard'),
      });
      return false;
    }
  },

  refreshDashboard: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const snapshot = await refreshAdminDashboardSnapshot();
      set({ snapshot, isLoading: false, isRefreshing: false, error: null });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        isRefreshing: false,
        error: handleError(err, 'Gagal memuat dashboard'),
      });
      return false;
    }
  },

  getStats: () => get().snapshot?.stats ?? null,

  getGatePassStats: () => get().snapshot?.gatePassStats ?? null,
}));
