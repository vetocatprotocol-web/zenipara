import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard, { StatsGrid } from '../../components/ui/StatCard';
import TaskCard from '../../components/ui/TaskCard';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import WeatherWidget from '../../components/ui/WeatherWidget';
import { CardListSkeleton } from '../../components/common/Skeleton';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import UserDetailModal from '../../components/common/UserDetailModal';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { usePlatformStore } from '../../store/platformStore';
import { ICONS } from '../../icons';
import { useKomandanDashboardStore } from '../../store/komandanDashboardStore';
import { subscribeDataChanges } from '../../lib/dataSync';
import { useVisibilityAwareRefresh } from '../../hooks/useVisibilityAwareRefresh';
import { isPathEnabled } from '../../lib/featureFlags';
import { getKomandanScopeLabel, normalizeRole } from '../../lib/rolePermissions';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types';

export default function KomandanDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { weatherSettings } = usePlatformStore();
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks({ satuan: user?.satuan });
  const {
    users: personnelUsers,
    isLoading: isPersonnelLoading,
    getUserById,
    refetch: refetchPersonnel,
  } = useUsers({
    satuan: user?.satuan,
    isActive: true,
    orderBy: 'nama',
    ascending: true,
    serverPaginated: false,
  });
  const { announcements } = useAnnouncements();
  const { onlineCount, totalPersonel, error, fetchStats } = useKomandanDashboardStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [personnelFilter, setPersonnelFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedPersonnel, setSelectedPersonnel] = useState<User | null>(null);
  const [showPersonnelDetail, setShowPersonnelDetail] = useState(false);
  const [fallbackPersonnel, setFallbackPersonnel] = useState<User[]>([]);
  const [isFallbackPersonnelLoading, setIsFallbackPersonnelLoading] = useState(false);
  const refreshStatsOnly = useCallback(async () => {
    await fetchStats(user?.satuan);
  }, [fetchStats, user?.satuan]);
  const { requestRefresh: requestStatsRefresh } = useVisibilityAwareRefresh(refreshStatsOnly, {
    intervalMs: user?.satuan ? 60 * 1000 : undefined,
  });
  const { requestRefresh: requestPersonnelRefresh } = useVisibilityAwareRefresh(refetchPersonnel, {
    intervalMs: user?.satuan ? 60 * 1000 : undefined,
  });
  const { requestRefresh: requestTaskRefresh } = useVisibilityAwareRefresh(refetchTasks);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(user?.satuan), refetchTasks(), refetchPersonnel()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStats(user?.satuan);
  }, [fetchStats, user?.satuan]);

  useEffect(() => {
    return subscribeDataChanges(['users', 'tasks', 'announcements'], (changed) => {
      if (changed.includes('users')) {
        requestStatsRefresh();
        requestPersonnelRefresh();
      }
      if (changed.includes('announcements')) {
        requestStatsRefresh();
      }
      if (changed.includes('tasks')) {
        requestTaskRefresh();
      }
    }, { debounceMs: 500 });
  }, [requestPersonnelRefresh, requestStatsRefresh, requestTaskRefresh]);

  useEffect(() => {
    let mounted = true;

    const fetchFallbackPersonnel = async () => {
      if (!user?.satuan) {
        if (mounted) setFallbackPersonnel([]);
        return;
      }

      // Fallback only when primary source returns empty result.
      if (isPersonnelLoading || personnelUsers.length > 0) {
        if (mounted) setFallbackPersonnel([]);
        return;
      }

      setIsFallbackPersonnelLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id,nrp,nama,role,pangkat,jabatan,satuan,satuan_id,foto_url,is_active,is_online,login_attempts,locked_until,last_login,created_at,updated_at')
          .eq('is_active', true)
          .eq('satuan', user.satuan)
          .order('nama', { ascending: true })
          .limit(24);

        if (error) throw error;
        if (!mounted) return;

        const normalized = ((data as User[] | null) ?? []).map((row) => ({
          ...row,
          role: (normalizeRole(row.role) ?? row.role) as User['role'],
        }));
        setFallbackPersonnel(normalized);
      } catch {
        if (mounted) setFallbackPersonnel([]);
      } finally {
        if (mounted) setIsFallbackPersonnelLoading(false);
      }
    };

    void fetchFallbackPersonnel();

    return () => {
      mounted = false;
    };
  }, [isPersonnelLoading, personnelUsers.length, user?.satuan]);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);
  const approvedTasks = useMemo(() => tasks.filter((t) => t.status === 'approved'), [tasks]);
  const pinnedAnnouncements = useMemo(() => announcements.filter((a) => a.is_pinned), [announcements]);
  const activePersonnel = useMemo(() => (
    personnelUsers.length > 0 ? personnelUsers : fallbackPersonnel
  ), [personnelUsers, fallbackPersonnel]);

  const filteredPersonnel = useMemo(() => {
    if (personnelFilter === 'online') return activePersonnel.filter((u) => u.is_online);
    if (personnelFilter === 'offline') return activePersonnel.filter((u) => !u.is_online);
    return activePersonnel;
  }, [activePersonnel, personnelFilter]);

  const panelOnlineCount = useMemo(() => activePersonnel.filter((u) => u.is_online).length, [activePersonnel]);
  const isPersonnelPanelLoading = isPersonnelLoading || isFallbackPersonnelLoading;

  const handleOpenPersonnelDetail = useCallback(async (target: User) => {
    try {
      const detail = await getUserById(target.id);
      setSelectedPersonnel(detail);
    } catch {
      setSelectedPersonnel(target);
    }
    setShowPersonnelDetail(true);
  }, [getUserById]);

  const canOpenTasks = isPathEnabled('/komandan/tasks', flags);
  const canOpenReports = isPathEnabled('/komandan/reports', flags);
  const canOpenAttendance = isPathEnabled('/komandan/attendance', flags);
  const canOpenPersonnel = isPathEnabled('/komandan/personnel', flags);
  const canOpenSprint = isPathEnabled('/komandan/sprint', flags);
  const canOpenGatePass = isPathEnabled('/komandan/gatepass-approval', flags);
  const canOpenGatePassMonitor = isPathEnabled('/komandan/gatepass-monitor', flags);

  return (
    <DashboardLayout title="Pusat Operasi">
      <div className="space-y-6">
        <PageHeader
          title={`${user?.pangkat ? `${user.pangkat} ` : ''}${user?.nama ?? 'Komandan'}`}
          subtitle={`${getKomandanScopeLabel(user?.level_komando)} · Satuan: ${user?.satuan ?? '—'} · ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          meta={
            <>
              <span>Aktif: {onlineCount}/{totalPersonel}</span>
              {canOpenTasks && <span>{pendingTasks.length} tugas aktif</span>}
              {(canOpenGatePass || canOpenGatePassMonitor) && <span>Gate Pass aktif</span>}
            </>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => void refresh()} isLoading={isRefreshing}>Muat Ulang</Button>
              {canOpenTasks && (
                <Link to="/komandan/tasks" className="inline-flex touch-target-sm items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25">
                  Kelola Tugas
                </Link>
              )}
              {canOpenGatePassMonitor && (
                <Link to="/komandan/gatepass-monitor" className="inline-flex touch-target-sm items-center justify-center rounded-xl border border-surface/70 bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-all hover:border-primary/40 hover:text-primary">
                  Monitor Gate Pass
                </Link>
              )}
            </>
          }
        />

        {error && (
          <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Weather Widget */}
        <WeatherWidget
          apiKey={weatherSettings.weatherApiKey || null}
          city={weatherSettings.weatherCity || null}
          onConfigureClick={() => navigate('/admin/settings')}
        />

        <StatsGrid>
          {canOpenPersonnel && <StatCard accent="blue" icon={<ICONS.UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />} label="Total Personel" value={totalPersonel} />}
          {canOpenPersonnel && <StatCard accent="green" icon={<ICONS.UserCheck className="h-5 w-5 text-success" aria-hidden="true" />} label="Sedang Online" value={onlineCount} trend="aktif sekarang" trendUp />}
          {canOpenTasks && <StatCard accent="gold" icon={<ICONS.Clipboard className="h-5 w-5 text-accent-gold" aria-hidden="true" />} label="Tugas Aktif" value={pendingTasks.length} />}
          {canOpenTasks && <StatCard accent="green" icon={<ICONS.BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />} label="Tugas Disetujui" value={approvedTasks.length} trend={doneTasks.length > 0 ? `${doneTasks.length} menunggu review` : 'belum ada'} />}
        </StatsGrid>

        <div className="dashboard-grid-secondary">
          <div className="app-card dashboard-section">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ICONS.LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-text-primary">Ringkasan Operasi</h3>
                  <p className="text-xs text-text-muted">Situasi cepat untuk pengambilan keputusan harian.</p>
                </div>
              </div>
              {canOpenReports && <Link to="/komandan/reports" className="text-sm font-medium text-primary hover:underline">Lihat laporan →</Link>}
            </div>
            <div className="mt-4 grid-cards-responsive gap-2.5 sm:grid-cols-3">
              {[
                ...(canOpenTasks ? [
                  { label: 'Pending', value: pendingTasks.length, color: 'text-accent-gold', bg: 'bg-amber-500/10' },
                  { label: 'Selesai', value: doneTasks.length, color: 'text-success', bg: 'bg-emerald-500/10' },
                ] : []),
                { label: 'Pin pengumuman', value: pinnedAnnouncements.length, color: 'text-primary', bg: 'bg-primary/10' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-surface/70 bg-surface/15 card-padding-responsive">
                  <div className={`mb-2 grid h-8 w-8 place-items-center rounded-lg ${item.bg}`}>
                    <span className={`text-lg font-black leading-none ${item.color}`}>{item.value}</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canOpenAttendance && <Link to="/komandan/attendance" className="dashboard-quick-link">Absensi</Link>}
              {canOpenPersonnel && <Link to="/komandan/personnel" className="dashboard-quick-link">Personel</Link>}
              {canOpenSprint && <Link to="/komandan/sprint" className="dashboard-quick-link">Sprint</Link>}
            </div>
          </div>

          <div className="app-card dashboard-section">
            <div className="panel-heading mb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-gold/15 text-accent-gold">
                  <ICONS.Pin className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Pengumuman Terbaru</h3>
                  <p className="text-xs text-text-muted">Informasi yang disematkan untuk satuan.</p>
                </div>
              </div>
              {canOpenReports && <Link to="/komandan/reports" className="text-sm font-medium text-primary hover:underline">Ke laporan →</Link>}
            </div>
            {pinnedAnnouncements.length === 0 ? (
              <EmptyState
                title="Belum ada pengumuman penting"
                description="Pengumuman yang disematkan akan muncul di sini agar komandan cepat melihat informasi prioritas."
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : (
              <div className="space-y-2">
                {pinnedAnnouncements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="rounded-2xl border border-accent-gold/30 bg-gradient-to-r from-amber-50/80 to-transparent card-padding-responsive dark:from-amber-900/10">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-md bg-accent-gold/15 text-accent-gold">
                        <ICONS.Pin className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-semibold text-text-primary">{announcement.judul}</p>
                    </div>
                    <p className="mt-1 text-xs text-text-muted line-clamp-2 sm:ml-7 sm:mt-0">{announcement.isi}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canOpenPersonnel && (
          <div className="app-card dashboard-section">
            <div className="panel-heading">
              <div>
                <h3 className="panel-heading__title">Personel Operasional</h3>
                <p className="panel-heading__desc">Pantau personel satuan dan buka detail profil tanpa keluar dari dashboard.</p>
              </div>
              <Link to="/komandan/personnel" className="text-xs text-primary hover:underline">Kelola personel lengkap →</Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-surface/70 bg-surface/20 px-2.5 py-1 text-xs text-text-muted">
                {panelOnlineCount}/{activePersonnel.length} online
              </span>
              {(['all', 'online', 'offline'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPersonnelFilter(option)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    personnelFilter === option
                      ? 'bg-primary text-white'
                      : 'border border-surface/70 bg-bg-card text-text-muted hover:text-text-primary'
                  }`}
                >
                  {option === 'all' ? 'Semua' : option === 'online' ? 'Online' : 'Offline'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {isPersonnelPanelLoading ? (
                <p className="text-sm text-text-muted">Memuat personel...</p>
              ) : filteredPersonnel.length === 0 ? (
                <EmptyState
                  title="Belum ada personel"
                  description="Personel akan muncul di sini sesuai filter yang dipilih."
                  className="border-0 bg-transparent px-0 py-6"
                />
              ) : (
                filteredPersonnel.slice(0, 6).map((personel) => (
                  <div key={personel.id} className="flex flex-col gap-3 rounded-2xl border border-surface/60 bg-surface/15 card-padding-responsive sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{personel.nama}</p>
                      <p className="text-xs text-text-muted">NRP {personel.nrp} · {personel.pangkat ?? '—'} {personel.jabatan ? `· ${personel.jabatan}` : ''}</p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${personel.is_online ? 'bg-success/10 text-success' : 'bg-surface/40 text-text-muted'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${personel.is_online ? 'bg-success' : 'bg-text-muted/50'}`} aria-hidden="true" />
                        {personel.is_online ? 'Online' : 'Offline'}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => void handleOpenPersonnelDetail(personel)}>
                        Detail
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Recent tasks */}
        {canOpenTasks && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold text-text-primary">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-accent-gold">
                  <ICONS.CheckSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                Tugas Terkini
              </h3>
              <Link to="/komandan/tasks" className="text-sm font-medium text-primary hover:underline">Lihat semua →</Link>
            </div>

            {tasksLoading ? (
              <CardListSkeleton count={4} />
            ) : tasks.length === 0 ? (
              <EmptyState
                title="Belum ada tugas dibuat"
                description="Mulai distribusikan pekerjaan ke personel agar progres harian bisa dipantau dari dashboard ini."
                action={(
                  <Link
                    to="/komandan/tasks"
                    className="inline-flex min-h-[40px] items-center rounded-xl border border-surface bg-slate-50 px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary dark:bg-surface/45"
                  >
                    Buat atau kelola tugas
                  </Link>
                )}
                className="py-10"
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {tasks.slice(0, 6).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee
                  onAction={() => {
                    if (canOpenTasks) navigate('/komandan/tasks');
                  }}
                />
              ))}
              </div>
            )}
          </div>
        )}
      </div>

      <UserDetailModal
        isOpen={showPersonnelDetail}
        onClose={() => {
          setShowPersonnelDetail(false);
          setSelectedPersonnel(null);
        }}
        user={selectedPersonnel}
        viewerRole="komandan"
        mode="view"
      />
    </DashboardLayout>
  );
}
