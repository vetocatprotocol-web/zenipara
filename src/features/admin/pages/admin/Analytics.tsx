import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import StatCard, { StatsGrid } from '../../components/ui/StatCard';
import BarChart from '../../components/ui/BarChart';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { StatCardsSkeleton } from '../../components/common/Skeleton';
import { ICONS } from '../../icons';
import { useSatuans } from '../../hooks/useSatuans';
import { fetchAnalyticsSnapshot, type AnalyticsSnapshot } from '../../lib/api/analytics';
import { handleError } from '../../lib/handleError';
import { getRoleDisplayLabel } from '../../lib/rolePermissions';

// Colour map for task statuses
const TASK_STATUS_COLOR: Record<string, string> = {
  pending: 'var(--color-accent-gold)',
  in_progress: 'var(--color-primary)',
  done: '#22c55e',
  approved: '#10b981',
  rejected: 'var(--color-accent-red)',
};

// Colour map for attendance statuses
const ATTENDANCE_STATUS_COLOR: Record<string, string> = {
  hadir: '#10b981',
  izin: 'var(--color-accent-gold)',
  sakit: '#f59e0b',
  dinas_luar: 'var(--color-primary)',
  alpa: 'var(--color-accent-red)',
};

// Indonesian task status label
const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Berjalan',
  done: 'Selesai',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

// Indonesian attendance status label
const ATTENDANCE_LABEL: Record<string, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  dinas_luar: 'Dinas Luar',
  alpa: 'Alpa',
};

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div>
        <h3 className="text-base font-bold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [filterSatuan, setFilterSatuan] = useState('');
  const { satuans } = useSatuans({ onlyActive: false });

  const load = useCallback(async (satuan?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAnalyticsSnapshot(satuan || null);
      setSnapshot(data);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(handleError(err, 'Gagal memuat data analitik'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filterSatuan);
  }, [load, filterSatuan]);

  // Task status bar chart data
  const taskChartData = useMemo(
    () =>
      (snapshot?.taskStatusCounts ?? [])
        .sort((a, b) => b.count - a.count)
        .map((item) => ({
          label: TASK_STATUS_LABEL[item.status] ?? item.status,
          value: item.count,
          color: TASK_STATUS_COLOR[item.status],
        })),
    [snapshot],
  );

  // Attendance status bar chart data
  const attendanceChartData = useMemo(
    () =>
      (snapshot?.attendanceStatusCounts ?? [])
        .sort((a, b) => b.count - a.count)
        .map((item) => ({
          label: ATTENDANCE_LABEL[item.status] ?? item.status,
          value: item.count,
          color: ATTENDANCE_STATUS_COLOR[item.status],
        })),
    [snapshot],
  );

  // Personnel role bar chart data
  const personnelChartData = useMemo(
    () =>
      (snapshot?.personnelRoleCounts ?? [])
        .sort((a, b) => b.count - a.count)
        .map((item) => ({
          label: getRoleDisplayLabel(item.role),
          value: item.count,
        })),
    [snapshot],
  );

  // Weekly task activity chart
  const weeklyTaskChartData = useMemo(
    () =>
      (snapshot?.weeklyTaskActivity ?? []).map((item) => ({
        label: item.week,
        value: item.created,
        color: 'var(--color-primary)',
      })),
    [snapshot],
  );

  const weeklyTaskCompletedChartData = useMemo(
    () =>
      (snapshot?.weeklyTaskActivity ?? []).map((item) => ({
        label: item.week,
        value: item.completed,
        color: '#10b981',
      })),
    [snapshot],
  );

  // Daily attendance rate data
  const dailyAttendanceChartData = useMemo(
    () =>
      (snapshot?.dailyAttendanceRates ?? []).map((item) => {
        const rate = item.total > 0 ? Math.round((item.hadir / item.total) * 100) : 0;
        const d = new Date(item.date + 'T12:00:00');
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        return {
          label,
          value: rate,
          color: rate >= 80 ? '#10b981' : rate >= 50 ? 'var(--color-accent-gold)' : 'var(--color-accent-red)',
        };
      }),
    [snapshot],
  );

  // Summary totals
  const totalTasks = useMemo(
    () => (snapshot?.taskStatusCounts ?? []).reduce((s, t) => s + t.count, 0),
    [snapshot],
  );
  const approvedTasks = useMemo(
    () =>
      (snapshot?.taskStatusCounts ?? []).find((t) => t.status === 'approved')?.count ?? 0,
    [snapshot],
  );
  const totalPersonnel = useMemo(
    () => (snapshot?.personnelRoleCounts ?? []).reduce((s, r) => s + r.count, 0),
    [snapshot],
  );
  const completionRate = totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 100) : 0;

  return (
    <DashboardLayout title="Analitik">
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Analitik"
          subtitle={`Data diperbarui pada ${lastFetchedAt ? lastFetchedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="form-control text-sm"
                value={filterSatuan}
                onChange={(e) => setFilterSatuan(e.target.value)}
                aria-label="Filter analitik per satuan"
              >
                <option value="">Semua Satuan</option>
                {satuans.map((s) => (
                  <option key={s.id} value={s.nama}>{s.nama}</option>
                ))}
              </select>
              <Button variant="outline" onClick={() => void load(filterSatuan)} isLoading={isLoading}>
                Muat Ulang
              </Button>
            </div>
          }
        />

        {error && (
          <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Summary KPIs */}
        {isLoading ? (
          <StatCardsSkeleton />
        ) : (
          <StatsGrid>
            <StatCard
              accent="blue"
              icon={<ICONS.ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />}
              label="Total Tugas"
              value={totalTasks}
            />
            <StatCard
              accent="green"
              icon={<ICONS.TrendingUp className="h-5 w-5 text-success" aria-hidden="true" />}
              label="Tingkat Penyelesaian"
              value={`${completionRate}%`}
              trend={`${approvedTasks} tugas disetujui`}
              trendUp={completionRate >= 50}
            />
            <StatCard
              accent="blue"
              icon={<ICONS.UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />}
              label="Total Personel Aktif"
              value={totalPersonnel}
            />
            <StatCard
              accent={snapshot && snapshot.overdueGatePassThisMonth > 0 ? 'red' : 'green'}
              icon={<ICONS.ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              label="Gate Pass Bulan Ini"
              value={snapshot?.totalGatePassThisMonth ?? 0}
              trend={
                snapshot && snapshot.overdueGatePassThisMonth > 0
                  ? `${snapshot.overdueGatePassThisMonth} overdue`
                  : 'tidak ada overdue'
              }
              trendUp={snapshot?.overdueGatePassThisMonth === 0}
            />
          </StatsGrid>
        )}

        {/* Charts Row 1 */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Task status distribution */}
          <div className="app-card p-5">
            <SectionHeader
              title="Distribusi Status Tugas"
              subtitle="Semua tugas berdasarkan status saat ini"
              icon={<ICONS.CheckSquare className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
            ) : taskChartData.length === 0 ? (
              <EmptyState title="Belum ada tugas" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <BarChart data={taskChartData} height={160} unit=" tugas" />
            )}
          </div>

          {/* Attendance status distribution */}
          <div className="app-card p-5">
            <SectionHeader
              title="Status Absensi (14 Hari Terakhir)"
              subtitle="Distribusi status kehadiran seluruh personel"
              icon={<ICONS.CalendarDays className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
            ) : attendanceChartData.length === 0 ? (
              <EmptyState title="Belum ada data absensi" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <BarChart data={attendanceChartData} height={160} unit=" orang" />
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Weekly task activity */}
          <div className="app-card p-5">
            <SectionHeader
              title="Aktivitas Tugas Mingguan"
              subtitle="Tugas dibuat dan diselesaikan per minggu (4 minggu terakhir)"
              icon={<ICONS.Activity className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
            ) : weeklyTaskChartData.length === 0 ? (
              <EmptyState title="Belum ada data" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <div className="space-y-4">
                <BarChart
                  data={weeklyTaskChartData}
                  height={120}
                  unit=""
                  title="Dibuat"
                />
                <BarChart
                  data={weeklyTaskCompletedChartData}
                  height={100}
                  unit=""
                  title="Selesai/Disetujui"
                />
              </div>
            )}
          </div>

          {/* Daily attendance rate */}
          <div className="app-card p-5">
            <SectionHeader
              title="Tingkat Kehadiran Harian"
              subtitle="Persentase hadir per hari (14 hari terakhir)"
              icon={<ICONS.BarChart2 className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
            ) : dailyAttendanceChartData.length === 0 ? (
              <EmptyState title="Belum ada data" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <BarChart data={dailyAttendanceChartData} height={160} unit="%" maxValue={100} />
            )}
          </div>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Personnel by role */}
          <div className="app-card p-5">
            <SectionHeader
              title="Personel Aktif per Role"
              subtitle="Distribusi role seluruh akun aktif"
              icon={<ICONS.PieChart className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
            ) : personnelChartData.length === 0 ? (
              <EmptyState title="Belum ada personel" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <BarChart data={personnelChartData} height={140} unit=" orang" />
            )}
          </div>

          {/* Top active users */}
          <div className="app-card p-5">
            <SectionHeader
              title="Top 5 Personel Paling Aktif"
              subtitle="Berdasarkan jumlah tugas dalam 30 hari terakhir"
              icon={<ICONS.Award className="h-4 w-4" aria-hidden="true" />}
            />
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-xl bg-surface/40" />
                ))}
              </div>
            ) : !snapshot?.topActiveUsers.length ? (
              <EmptyState title="Belum ada data aktivitas" className="border-0 bg-transparent px-0 py-6" />
            ) : (
              <div className="space-y-2">
                {snapshot.topActiveUsers.map((u, idx) => (
                  <div
                    key={u.nrp}
                    className="flex items-center gap-3 rounded-2xl border border-surface/70 bg-surface/15 px-4 py-2.5"
                  >
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{u.nama}</p>
                      <p className="text-xs text-text-muted font-mono">{u.nrp}</p>
                    </div>
                    <span className="text-sm font-bold text-primary">{u.taskCount} tugas</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
