import { supabase } from '../supabase';
import type { AuditLog, Attendance, LogisticsItem } from '../../types';
import { CacheWithTTL } from '../cacheWithTTL';
import { requestCoalescer } from '../requestCoalescer';
import { ensureStoredSessionContext } from './sessionContext';

// Cache dashboard snapshot for 2 minutes (can be manually refreshed)
const dashboardCache = new CacheWithTTL<string, AdminDashboardSnapshot>(120000);

export interface DashboardStats {
  totalPersonel: number;
  totalOnline: number;
  totalTugas: number;
  tugasAktif: number;
  pendingIzin: number;
  absensiHariIni: number;
  absensiMasuk: number;
  pinnedPengumuman: number;
}

export interface GatePassStats {
  checkedIn: number;
  completed: number;
  overdue: number;
  personilTersedia: number;
  personilDiLuar: number;
}

export interface AdminDashboardSnapshot {
  stats: DashboardStats;
  recentLogs: AuditLog[];
  lowStockItems: LogisticsItem[];
  heatmapAttendances: Attendance[];
  gatePassStats: GatePassStats;
  fetchedAt: string;
}

function ensureNoError(context: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`Gagal memuat ${context}: ${error.message}`);
  }
}

async function fetchAdminDashboardSnapshotImpl(): Promise<AdminDashboardSnapshot> {
  await ensureStoredSessionContext();
  const { data, error } = await supabase.rpc('api_get_admin_dashboard_snapshot');
  ensureNoError('snapshot dashboard admin', error);

  const snapshot = (data as AdminDashboardSnapshot | null) ?? null;
  if (!snapshot) {
    throw new Error('Snapshot dashboard admin kosong');
  }

  return snapshot;
}

/**
 * Public wrapper with caching and request coalescing
 * - Uses cache to avoid duplicate requests within 2 minutes
 * - Coalesces multiple simultaneous requests to same endpoint
 * - Manual refresh clears cache for fresh data
 */
export async function fetchAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  // Try to use request coalescing to prevent multiple simultaneous requests
  return requestCoalescer.coalesce('admin_dashboard', async () => {
    // Try cache first
    const cached = dashboardCache.get('dashboard_snapshot');
    if (cached) {
      return cached;
    }

    // Fetch from database and cache result
    const snapshot = await fetchAdminDashboardSnapshotImpl();
    dashboardCache.set('dashboard_snapshot', snapshot);
    return snapshot;
  });
}

/**
 * Force refresh dashboard data, bypassing cache
 */
export async function refreshAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  dashboardCache.delete('dashboard_snapshot');
  return fetchAdminDashboardSnapshot();
}

export async function fetchKomandanDashboardStats(
  satuan: string,
): Promise<{ onlineCount: number; totalPersonel: number }> {
  await ensureStoredSessionContext();
  const { data, error } = await supabase.rpc('api_get_komandan_dashboard_stats', {
    p_satuan: satuan,
  });
  ensureNoError('statistik dashboard komandan', error);

  const row = ((data as Array<{ online_count: number; total_personel: number }>) ?? [])[0];

  return {
    onlineCount: row?.online_count ?? 0,
    totalPersonel: row?.total_personel ?? 0,
  };
}
