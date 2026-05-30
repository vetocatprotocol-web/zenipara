import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

const mockSnapshot = {
  stats: {
    totalPersonel: 10,
    totalOnline: 7,
    totalTugas: 20,
    tugasAktif: 9,
    pendingIzin: 2,
    absensiHariIni: 8,
    absensiMasuk: 7,
    pinnedPengumuman: 1,
  },
  recentLogs: [],
  lowStockItems: [],
  heatmapAttendances: [],
  gatePassStats: {
    checkedIn: 3,
    completed: 4,
    overdue: 1,
    personilTersedia: 6,
    personilDiLuar: 4,
  },
  fetchedAt: '2026-04-20T00:00:00.000Z',
};

async function loadDashboardApi() {
  return import('@/features/shared/lib/api/dashboard');
}

describe('dashboard API', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.resetModules();
  });

  it('fetchAdminDashboardSnapshot memanggil RPC snapshot admin dan return data', async () => {
    const { fetchAdminDashboardSnapshot } = await loadDashboardApi();
    rpcMock.mockResolvedValueOnce({ data: mockSnapshot, error: null });

    const result = await fetchAdminDashboardSnapshot();

    expect(rpcMock).toHaveBeenCalledWith('api_get_admin_dashboard_snapshot');
    expect(result).toEqual(mockSnapshot);
  });

  it('fetchAdminDashboardSnapshot throw bila RPC error', async () => {
    const { fetchAdminDashboardSnapshot } = await loadDashboardApi();
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Unauthorized' } });

    await expect(fetchAdminDashboardSnapshot()).rejects.toThrow(
      'Gagal memuat snapshot dashboard admin: Unauthorized',
    );
  });

  it('refreshAdminDashboardSnapshot bypass cache dan memanggil RPC lagi', async () => {
    const { fetchAdminDashboardSnapshot, refreshAdminDashboardSnapshot } = await loadDashboardApi();
    rpcMock.mockResolvedValue({ data: mockSnapshot, error: null });

    await fetchAdminDashboardSnapshot();
    await refreshAdminDashboardSnapshot();

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'api_get_admin_dashboard_snapshot');
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'api_get_admin_dashboard_snapshot');
  });

  it('fetchKomandanDashboardStats memanggil RPC dengan p_satuan dan map hasil', async () => {
    const { fetchKomandanDashboardStats } = await loadDashboardApi();
    rpcMock.mockResolvedValueOnce({
      data: [{ online_count: 5, total_personel: 12 }],
      error: null,
    });

    const result = await fetchKomandanDashboardStats('Batalyon 1');

    expect(rpcMock).toHaveBeenCalledWith('api_get_komandan_dashboard_stats', {
      p_satuan: 'Batalyon 1',
    });
    expect(result).toEqual({ onlineCount: 5, totalPersonel: 12 });
  });

  it('fetchKomandanDashboardStats default 0 saat data kosong', async () => {
    const { fetchKomandanDashboardStats } = await loadDashboardApi();
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchKomandanDashboardStats('Batalyon 1');

    expect(result).toEqual({ onlineCount: 0, totalPersonel: 0 });
  });

  it('fetchKomandanDashboardStats throw saat RPC error', async () => {
    const { fetchKomandanDashboardStats } = await loadDashboardApi();
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Forbidden' } });

    await expect(fetchKomandanDashboardStats('Batalyon 1')).rejects.toThrow(
      'Gagal memuat statistik dashboard komandan: Forbidden',
    );
  });
});
