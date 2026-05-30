import { create } from 'zustand';
import { fetchGatePassesByUser, fetchAllGatePasses, fetchGatePassByQrToken, insertGatePass, patchGatePassStatus, rpcScanGatePass, type InsertGatePassResponse } from '@/features/shared/lib/api/gatepass';
import { GatePass, GatePassStatus } from '@/types';
import { isRoleAdmin, isRolePrajurit } from '@/features/shared/lib/rolePermissions';
import { generateQrToken, normalizeScannedQrToken } from '@/utils/gatepass';
import { useAuthStore } from './authStore';
import { notifyDataChanged } from '@/features/shared/lib/dataSync';

interface GatePassState {
  gatePasses: GatePass[];
  fetchGatePasses: (options?: { force?: boolean; suppressErrors?: boolean }) => Promise<void>;
  createGatePass: (payload: Partial<GatePass>) => Promise<InsertGatePassResponse>;
  cancelGatePass: (id: string) => Promise<void>;
  approveGatePass: (id: string, approved: boolean) => Promise<void>;
  approvePendingGatePasses: (ids: string[]) => Promise<{ approved: number; failed: number }>;
  /**
   * Scan a gate pass QR token.
   * Returns the updated GatePass with joined user data so the caller can
   * display scan results without an additional fetch.
   */
  scanGatePass: (qrToken: string) => Promise<GatePass>;
}

const GATEPASS_FETCH_COOLDOWN_MS = 900;
const GATEPASS_CACHE_TTL_MS = 5 * 60 * 1000;
let gatePassFetchInFlight: Promise<void> | null = null;
let gatePassLastFetchAt = 0;
let gatePassFetchScope = '';
let gatePassLastSuppressedWarnAt = 0;
const SUPPRESSED_ERROR_WARN_COOLDOWN_MS = 10000;

interface GatePassCachePayload {
  ts: number;
  gatePasses: GatePass[];
}

function getGatePassCacheKey(userId: string, role: string) {
  return `karyo:gatepass-cache:${userId}:${role}`;
}

function readGatePassCache(cacheKey: string): GatePass[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GatePassCachePayload;
    if (!parsed || !Array.isArray(parsed.gatePasses)) return null;
    if (Date.now() - (parsed.ts ?? 0) > GATEPASS_CACHE_TTL_MS) return null;
    return parsed.gatePasses;
  } catch {
    return null;
  }
}

function writeGatePassCache(cacheKey: string, gatePasses: GatePass[]) {
  if (typeof window === 'undefined') return;
  try {
    const payload: GatePassCachePayload = { ts: Date.now(), gatePasses };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/access errors.
  }
}

export const useGatePassStore = create<GatePassState>()((set, get) => ({
  gatePasses: [],

  async fetchGatePasses(options) {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ gatePasses: [] });
      return;
    }

    const fetchScope = `${user.id}:${user.role}`;
    if (gatePassFetchScope !== fetchScope) {
      gatePassFetchScope = fetchScope;
      gatePassLastFetchAt = 0;
      gatePassFetchInFlight = null;
    }
    const cacheKey = getGatePassCacheKey(user.id, user.role);

    const force = options?.force === true;
    const suppressErrors = options?.suppressErrors === true;

    if (!force && get().gatePasses.length === 0) {
      const cached = readGatePassCache(cacheKey);
      if (cached && cached.length > 0) {
        set({ gatePasses: cached });
      }
    }

    if (gatePassFetchInFlight) {
      await gatePassFetchInFlight;
      return;
    }

    const now = Date.now();
    if (!force && now - gatePassLastFetchAt < GATEPASS_FETCH_COOLDOWN_MS) {
      return;
    }

    gatePassFetchInFlight = (async () => {
      // Admin dan komandan perlu melihat semua gate pass (untuk monitoring & approval).
      // Prajurit hanya perlu melihat gate pass milik sendiri.
      const data =
        isRolePrajurit(user.role)
          ? await fetchGatePassesByUser(user.id, user.role, user.id)
          : await fetchAllGatePasses(user.id, user.role);

      gatePassLastFetchAt = Date.now();
      // Store fetched gate passes as-is
      // Overdue status is now determined by the backend
      set({ gatePasses: data });
      writeGatePassCache(cacheKey, data);
    })();

    try {
      await gatePassFetchInFlight;
    } catch (error) {
      const fallback = readGatePassCache(cacheKey);
      if (fallback && fallback.length > 0) {
        set({ gatePasses: fallback });
        if (import.meta.env.DEV) {
          console.warn('[GatePassStore] Using stale cache fallback after fetch error', error);
        }
        return;
      }

      if (suppressErrors) {
        const now = Date.now();
        if (import.meta.env.DEV && now - gatePassLastSuppressedWarnAt >= SUPPRESSED_ERROR_WARN_COOLDOWN_MS) {
          gatePassLastSuppressedWarnAt = now;
          console.warn('[GatePassStore] Suppressed fetch error from background refresh', error);
        }
        return;
      }

      throw error;
    } finally {
      gatePassFetchInFlight = null;
    }
  },

  async createGatePass(payload) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const qr_token = generateQrToken();
    const response = await insertGatePass(user.id, user.role, { ...payload, user_id: user.id, qr_token });
    await get().fetchGatePasses({ force: true });
    notifyDataChanged('gate_pass');
    return response;
  },

  async cancelGatePass(id) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    if (!isRolePrajurit(user.role)) {
      throw new Error('Hanya prajurit yang dapat membatalkan gate pass miliknya');
    }

    const targetGatePass = get().gatePasses.find((item) => item.id === id);
    if (targetGatePass) {
      const canCancel =
        (targetGatePass.status === 'pending' || targetGatePass.status === 'approved')
        && !targetGatePass.actual_keluar;

      if (!canCancel) {
        throw new Error('Gate pass ini tidak dapat dibatalkan');
      }
    }

    await patchGatePassStatus(user.id, user.role, id, 'cancelled', undefined, 'Dibatalkan oleh pemohon');
    await get().fetchGatePasses({ force: true });
    notifyDataChanged('gate_pass');
  },

  async approveGatePass(id, approved) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const status: GatePassStatus = approved ? 'approved' : 'rejected';
    await patchGatePassStatus(user.id, user.role, id, status, user.id);
    await get().fetchGatePasses({ force: true });
    notifyDataChanged('gate_pass');
  },

  async approvePendingGatePasses(ids) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');

    if (ids.length === 0) {
      return { approved: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      ids.map((id) => patchGatePassStatus(user.id, user.role, id, 'approved', user.id)),
    );
    const approved = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - approved;

    await get().fetchGatePasses({ force: true });
    notifyDataChanged('gate_pass');

    return { approved, failed };
  },

  async scanGatePass(qrToken) {
    const user = useAuthStore.getState().user;
    if (!user || !isRoleAdmin(user.role)) {
      throw new Error('Akses hanya untuk admin');
    }
    const normalizedToken = normalizeScannedQrToken(qrToken);
    await rpcScanGatePass(user.id, user.role, normalizedToken);
    // Fetch the updated gate pass with user data so callers can render scan result
    const updated = await fetchGatePassByQrToken(user.id, user.role, normalizedToken);
    if (!updated) throw new Error('Gate pass tidak ditemukan setelah scan');
    await get().fetchGatePasses({ force: true });
    notifyDataChanged('gate_pass');
    return updated;
  },
}));
