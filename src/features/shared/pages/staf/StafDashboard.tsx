import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard, { StatsGrid } from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import DashboardShortcutGrid from '../../components/ui/DashboardShortcutGrid';
import { StatCardsSkeleton, CardListSkeleton } from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { isPathEnabled } from '../../lib/featureFlags';
import { ICONS } from '../../icons';
import { supabase } from '../../lib/supabase';
import { subscribeDataChanges } from '../../lib/dataSync';
import { ensureStoredSessionContext } from '../../lib/api/sessionContext';
import { useVisibilityAwareRefresh } from '../../hooks/useVisibilityAwareRefresh';
import type { IconName } from '../../icons';

interface StafStats {
  totalPersonel: number;
  hadirHariIni: number;
  tugasAktif: number;
  logistikPending: number;
}

const EMPTY_STATS: StafStats = {
  totalPersonel: 0,
  hadirHariIni: 0,
  tugasAktif: 0,
  logistikPending: 0,
};

async function fetchStafStats(satuan: string): Promise<StafStats> {
  await ensureStoredSessionContext();
  const { data, error } = await supabase.rpc('api_get_staf_stats', {
    p_satuan: satuan,
  });

  if (error) throw error;

  const row = ((data as Array<{
    total_personel: number;
    hadir_hari_ini: number;
    tugas_aktif: number;
    logistik_pending: number;
  }>) ?? [])[0];

  return {
    totalPersonel: row?.total_personel ?? 0,
    hadirHariIni: row?.hadir_hari_ini ?? 0,
    tugasAktif: row?.tugas_aktif ?? 0,
    logistikPending: row?.logistik_pending ?? 0,
  };
}

/** Detect staf bidang from jabatan field */
function detectBidang(jabatan?: string): 'pers' | 'log' | 'ops' | 'umum' {
  if (!jabatan) return 'umum';
  const j = jabatan.toLowerCase();
  if (j.includes('s-1') || j.includes('s1') || j.includes('pers')) return 'pers';
  if (j.includes('s-4') || j.includes('s4') || j.includes('log')) return 'log';
  if (j.includes('s-3') || j.includes('s3') || j.includes('ops')) return 'ops';
  return 'umum';
}

const BIDANG_LABEL: Record<string, string> = {
  pers: 'Staf Personel (S-1)',
  log: 'Staf Logistik (S-4)',
  ops: 'Staf Operasional (S-3)',
  umum: 'Staf Operasional',
};

/** Quick-access module cards per bidang */
const BIDANG_MODULES: Record<string, { path: string; label: string; icon: IconName; color: string }[]> = {
  pers: [
    { path: '/admin/users',       label: 'Manajemen Personel', icon: 'Users', color: 'border-blue-500/30 bg-blue-500/5' },
    { path: '/admin/attendance',  label: 'Rekap Absensi',      icon: 'ClipboardCheck', color: 'border-emerald-500/30 bg-emerald-500/5' },
    { path: '/admin/schedule',    label: 'Jadwal Shift',       icon: 'CalendarDays', color: 'border-amber-500/30 bg-amber-500/5' },
    { path: '/staf/messages',     label: 'Pesan',              icon: 'MessageSquare', color: 'border-purple-500/30 bg-purple-500/5' },
  ],
  log: [
    { path: '/admin/logistics',   label: 'Inventaris Logistik', icon: 'Package', color: 'border-orange-500/30 bg-orange-500/5' },
    { path: '/admin/users',       label: 'Data Personel',       icon: 'Users', color: 'border-blue-500/30 bg-blue-500/5' },
    { path: '/staf/messages',     label: 'Pesan',               icon: 'MessageSquare', color: 'border-purple-500/30 bg-purple-500/5' },
    { path: '/admin/attendance',  label: 'Rekap Absensi',       icon: 'ClipboardCheck', color: 'border-emerald-500/30 bg-emerald-500/5' },
  ],
  ops: [
    { path: '/komandan/tasks',    label: 'Manajemen Tugas',     icon: 'CheckCircle2', color: 'border-green-500/30 bg-green-500/5' },
    { path: '/staf/sprint',       label: 'Surat Perintah',      icon: 'ScrollText', color: 'border-cyan-500/30 bg-cyan-500/5' },
    { path: '/admin/pos-jaga',    label: 'Pos Jaga',            icon: 'Shield', color: 'border-red-500/30 bg-red-500/5' },
    { path: '/admin/users',       label: 'Data Personel',       icon: 'Users', color: 'border-blue-500/30 bg-blue-500/5' },
  ],
  umum: [
    { path: '/admin/users',       label: 'Data Personel',       icon: 'Users', color: 'border-blue-500/30 bg-blue-500/5' },
    { path: '/admin/attendance',  label: 'Rekap Absensi',       icon: 'ClipboardCheck', color: 'border-emerald-500/30 bg-emerald-500/5' },
    { path: '/admin/logistics',   label: 'Logistik',            icon: 'Package', color: 'border-orange-500/30 bg-orange-500/5' },
    { path: '/staf/messages',     label: 'Pesan',               icon: 'MessageSquare', color: 'border-purple-500/30 bg-purple-500/5' },
  ],
};

export default function StafDashboard() {
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { announcements, isLoading: announcementsLoading } = useAnnouncements();

  const [stats, setStats] = useState<StafStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bidang = useMemo(() => detectBidang(user?.jabatan), [user?.jabatan]);

  const loadStats = useCallback(async () => {
    if (!user?.satuan) return;
    setStatsError(null);
    try {
      const data = await fetchStafStats(user.satuan);
      setStats(data);
    } catch {
      setStatsError('Gagal memuat statistik. Coba muat ulang.');
    } finally {
      setStatsLoading(false);
    }
  }, [user?.satuan]);
  const { requestRefresh: requestStatsRefresh } = useVisibilityAwareRefresh(loadStats);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await loadStats();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    return subscribeDataChanges(['users', 'attendance', 'tasks', 'logistics_items'], () => {
      requestStatsRefresh();
    }, { debounceMs: 500 });
  }, [requestStatsRefresh]);

  const modules = useMemo(() => BIDANG_MODULES[bidang].filter((m) => isPathEnabled(m.path, flags)), [bidang, flags]);
  const pinnedAnnouncements = useMemo(() => announcements.filter((a) => a.is_pinned).slice(0, 3), [announcements]);

  const hadirPct = useMemo(() => (
    stats.totalPersonel > 0
      ? Math.round((stats.hadirHariIni / stats.totalPersonel) * 100)
      : 0
  ), [stats.hadirHariIni, stats.totalPersonel]);

  return (
    <DashboardLayout title="Pusat Staf">
      <div className="space-y-6">
        <PageHeader
          title={`${user?.pangkat ? `${user.pangkat} ` : ''}${user?.nama ?? 'Staf'}`}
          subtitle={`${BIDANG_LABEL[bidang]} · Satuan: ${user?.satuan ?? '—'} · ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          meta={
            <>
              <span>Personel Hadir: {stats.hadirHariIni}/{stats.totalPersonel} ({hadirPct}%)</span>
              <span>{stats.tugasAktif} tugas aktif</span>
            </>
          }
          actions={
            <Button variant="outline" onClick={() => void refresh()} isLoading={isRefreshing}>
              Muat Ulang
            </Button>
          }
        />

        {/* Stats */}
        {statsLoading ? (
          <StatCardsSkeleton />
        ) : statsError ? (
          <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
            {statsError}
          </div>
        ) : (
          <StatsGrid>
            <StatCard
              icon={<ICONS.UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />}
              label="Total Personel"
              value={stats.totalPersonel}
              accent="blue"
            />
            <StatCard
              icon={<ICONS.UserCheck className="h-5 w-5 text-success" aria-hidden="true" />}
              label="Hadir Hari Ini"
              value={stats.hadirHariIni}
              trend={`${hadirPct}% dari total`}
              trendUp={hadirPct >= 80}
              accent="green"
            />
            <StatCard
              icon={<ICONS.Clipboard className="h-5 w-5 text-accent-gold" aria-hidden="true" />}
              label="Tugas Aktif"
              value={stats.tugasAktif}
              accent="gold"
            />
            <StatCard
              icon={<ICONS.Package className="h-5 w-5 text-accent-red" aria-hidden="true" />}
              label="Logistik Pending"
              value={stats.logistikPending}
              accent={stats.logistikPending > 0 ? 'red' : 'green'}
            />
          </StatsGrid>
        )}

          <div className="grid-cards-responsive grid gap-6 lg:grid-cols-3">
          {/* Quick Access Modules */}
          <div className="app-card dashboard-section lg:col-span-1">
            <DashboardShortcutGrid
              title="Modul Akses Cepat"
              description="Pilih modul yang paling relevan dengan bidang Anda tanpa berpindah menu terlalu jauh."
              columnsClassName="grid-cols-1 sm:grid-cols-2"
              items={modules.map((mod) => ({
                href: mod.path,
                label: mod.label,
                description: getModuleDescription(mod.path),
                icon: mod.icon,
                toneClass: mod.color,
              }))}
            />
          </div>

          {/* Announcements */}
          <div className="app-card dashboard-section lg:col-span-2">
            <div className="panel-heading mb-3">
              <h3 className="panel-heading__title">Pengumuman Tersemat</h3>
            </div>
            <div className="space-y-3">
              {announcementsLoading ? (
                <CardListSkeleton count={2} />
              ) : pinnedAnnouncements.length === 0 ? (
                <EmptyState
                  icon={<ICONS.Megaphone className="h-6 w-6" aria-hidden="true" />}
                  title="Belum ada pengumuman"
                  description="Pengumuman penting akan muncul di sini"
                />
              ) : (
                pinnedAnnouncements.map((ann) => (
                  <div
                      key={ann.id}
                      className="rounded-2xl border border-surface/70 bg-surface/10 card-padding-responsive"
                    >
                    <div className="flex items-start gap-3">
                      <ICONS.Pin className="mt-0.5 h-4 w-4 text-accent-gold" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">{ann.judul}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{ann.isi}</p>
                        <p className="mt-2 text-[10px] text-text-muted/60">
                          {new Date(ann.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function getModuleDescription(path: string) {
  switch (path) {
    case '/admin/users':
      return 'Kelola akun, role, dan status personel.';
    case '/admin/attendance':
      return 'Tinjau rekap kehadiran harian dan tren.';
    case '/admin/schedule':
      return 'Atur rotasi dan jadwal jaga satuan.';
    case '/staf/messages':
      return 'Baca dan kirim pesan internal satuan.';
    case '/admin/logistics':
      return 'Pantau inventaris dan item yang perlu perhatian.';
    case '/komandan/tasks':
      return 'Kelola tugas operasional dan progres personel.';
    case '/staf/sprint':
      return 'Akses surat perintah dan dokumen tugas.';
    case '/admin/pos-jaga':
      return 'Kelola titik jaga dan QR statis.';
    default:
      return 'Akses cepat ke modul terkait.';
  }
}
