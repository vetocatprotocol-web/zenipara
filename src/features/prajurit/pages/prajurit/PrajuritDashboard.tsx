import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard, { StatsGrid } from '../../components/ui/StatCard';
import TaskCard from '../../components/ui/TaskCard';
import { useTasks } from '../../hooks/useTasks';
import { useAttendance } from '../../hooks/useAttendance';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useMessages } from '../../hooks/useMessages';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useUIStore } from '../../store/uiStore';
import { useGatePassStore } from '../../store/gatePassStore';
import { useGatePassRealtime } from '../../hooks/useGatePassRealtime';
import { useVisibilityAwareRefresh } from '../../hooks/useVisibilityAwareRefresh';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { AttendanceBadge } from '../../components/common/Badge';
import { CardListSkeleton } from '../../components/common/Skeleton';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { ICONS } from '../../icons';
import { isPathEnabled } from '../../lib/featureFlags';

export default function PrajuritDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { showNotification } = useUIStore();
  const { tasks, isLoading: tasksLoading } = useTasks({ assignedTo: user?.id });
  const { todayAttendance, isLoading: attnLoading, checkIn, checkOut } = useAttendance();
  const { announcements, isLoading: annLoading } = useAnnouncements();
  const { unreadCount } = useMessages({ includeSent: false, enableDirectRealtime: false, subscribeToDataChanges: false });
  const { gatePasses, fetchGatePasses } = useGatePassStore();
  const canOpenGatePass = isPathEnabled('/prajurit/gatepass', flags);
  const { requestRefresh: requestGatePassRefresh } = useVisibilityAwareRefresh(fetchGatePasses, {
    enabled: canOpenGatePass,
    intervalMs: 2 * 60 * 1000,
  });
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  useGatePassRealtime({ enabled: canOpenGatePass });

  const activeTasks = useMemo(() => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done' || t.status === 'approved'), [tasks]);
  const rejectedTasks = useMemo(() => tasks.filter((t) => t.status === 'rejected'), [tasks]);

  // Active gate pass: sudah scan keluar (checked_in) atau overdue
  const activeGatePass = useMemo(
    () => (canOpenGatePass ? gatePasses.find((gp) => gp.status === 'checked_in' || gp.status === 'overdue') : undefined),
    [canOpenGatePass, gatePasses],
  );

  useEffect(() => {
    requestGatePassRefresh();
  }, [requestGatePassRefresh]);

  // Recent announcements: pinned first, limit 3
  const recentAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).slice(0, 3),
    [announcements],
  );

  const canOpenTasks = isPathEnabled('/prajurit/tasks', flags);
  const canOpenMessages = isPathEnabled('/prajurit/messages', flags);
  const canOpenAttendance = isPathEnabled('/prajurit/attendance', flags);
  const canOpenScanPos = isPathEnabled('/prajurit/scan-pos', flags);
  const canOpenLeave = isPathEnabled('/prajurit/leave', flags);
  const canViewTaskModules = canOpenTasks;
  const canViewAttendanceModules = canOpenAttendance;

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await checkIn();
      showNotification('Absen masuk berhasil!', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal absen masuk', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      await checkOut();
      showNotification('Absen pulang berhasil!', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal absen pulang', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <PageHeader
          title={`${user?.pangkat ? `${user.pangkat} ` : ''}${user?.nama ?? 'Prajurit'}`}
          subtitle={`${user?.satuan ?? '—'} · ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          meta={
            <>
              {canViewAttendanceModules && (
                <span>{todayAttendance ? 'Absensi hari ini tercatat' : 'Belum absen masuk'}</span>
              )}
              {canOpenMessages && <span>{unreadCount} pesan belum dibaca</span>}
            </>
          }
          actions={
            <>
              {canViewAttendanceModules && (
                attnLoading ? (
                  <LoadingSpinner size="sm" />
                ) : todayAttendance ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <AttendanceBadge status={todayAttendance.status} />
                    {todayAttendance.check_in && !todayAttendance.check_out && (
                      <Button size="sm" variant="secondary" onClick={handleCheckOut} isLoading={checkingOut}>
                        Absen Pulang
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" onClick={handleCheckIn} isLoading={checkingIn}>
                    Absen Masuk
                  </Button>
                )
              )}
            </>
          }
        />

        {canOpenScanPos && (
          <Link
            to="/prajurit/scan-pos"
            className="hero-card hero-card-success group"
          >
            <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-success shadow-sm transition-transform duration-200 group-hover:scale-105">
                {ICONS.ScanLine ? <ICONS.ScanLine className="h-5 w-5" aria-hidden="true" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-success/80 sm:tracking-[0.28em]">Akses Cepat Scan</p>
                <p className="mt-0.5 text-base font-semibold text-text-primary">Scan Pos Jaga</p>
                <p className="mt-1 text-sm text-text-muted">
                  Buka kamera untuk scan QR pos jaga dan lanjutkan validasi NRP/PIN dalam satu alur.
                </p>
              </div>
              <span className="inline-flex w-full items-center justify-center rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors group-hover:bg-success/15 sm:w-auto">
                Mulai Scan
              </span>
            </div>
          </Link>
        )}

        {/* Alert: gate pass sedang aktif (checked_in / overdue) */}
        {activeGatePass && (
          <div className={`alert-card ${activeGatePass.status === 'overdue' ? 'alert-danger' : 'alert-info'}`}>
            <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl ${activeGatePass.status === 'overdue' ? 'bg-accent-red/15 text-accent-red' : 'bg-primary/15 text-primary'}`}>
              <ICONS.ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${activeGatePass.status === 'overdue' ? 'text-accent-red' : 'text-primary'}`}>
                {activeGatePass.status === 'overdue' ? 'Gate Pass Anda OVERDUE!' : 'Gate Pass Aktif — Anda Sedang di Luar'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {activeGatePass.status === 'overdue'
                  ? 'Segera kembali dan scan Pos Jaga untuk menyelesaikan gate pass.'
                  : 'Scan QR Pos Jaga saat kembali untuk menyelesaikan gate pass.'}
              </p>
              {canOpenGatePass && (
                <Link to="/prajurit/gatepass" className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:underline ${activeGatePass.status === 'overdue' ? 'text-accent-red' : 'text-primary'}`}>
                  Lihat detail gate pass →
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid-cards-responsive">
          {canOpenTasks && (
            <Link to="/prajurit/tasks" className="group app-card flex items-center gap-4 card-padding-responsive transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-accent-gold shadow-sm transition-transform duration-200 group-hover:scale-105">
                <ICONS.ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tugas Aktif</p>
                <p className="mt-0.5 text-2xl font-bold text-text-primary">{activeTasks.length}</p>
              </div>
            </Link>
          )}
          {canOpenMessages && (
            <Link to="/prajurit/messages" className="group app-card flex items-center gap-4 card-padding-responsive transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-600/10 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105">
                <ICONS.Megaphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pesan Belum Dibaca</p>
                <p className="mt-0.5 text-2xl font-bold text-text-primary">{unreadCount}</p>
              </div>
            </Link>
          )}
          {canOpenAttendance && (
            <Link to="/prajurit/attendance" className="group app-card flex items-center gap-4 card-padding-responsive transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${todayAttendance ? 'bg-gradient-to-br from-success/20 to-emerald-600/10 text-success' : 'bg-gradient-to-br from-surface/60 to-surface/30 text-text-muted'}`}>
                <ICONS.CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status Absensi</p>
                <p className={`mt-0.5 text-2xl font-bold ${todayAttendance ? 'text-success' : 'text-text-primary'}`}>{todayAttendance ? 'Hadir' : 'Belum'}</p>
              </div>
            </Link>
          )}
        </div>

        <div className="dashboard-quick-strip">
          {canOpenGatePass && !activeGatePass && (
            <Link to="/prajurit/gatepass" className="dashboard-quick-link group">
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                {ICONS.ClipboardCheck ? <ICONS.ClipboardCheck className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 leading-snug">Gate Pass</span>
            </Link>
          )}
          {canOpenTasks && (
            <Link to="/prajurit/tasks" className="dashboard-quick-link group">
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-amber-500/10 text-accent-gold transition-transform group-hover:scale-105">
                {ICONS.CheckSquare ? <ICONS.CheckSquare className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 leading-snug">Tugas Saya</span>
            </Link>
          )}
          {canOpenMessages && (
            <Link to="/prajurit/messages" className="dashboard-quick-link group">
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-105">
                {ICONS.Megaphone ? <ICONS.Megaphone className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 leading-snug">Pesan</span>
            </Link>
          )}
          {canOpenLeave && (
            <Link to="/prajurit/leave" className="dashboard-quick-link group">
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-rose-500/10 text-accent-red transition-transform group-hover:scale-105">
                {ICONS.UserCheck ? <ICONS.UserCheck className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 leading-snug">Ajukan Izin</span>
            </Link>
          )}
        </div>

        {/* Alert: rejected tasks */}
        {canViewTaskModules && rejectedTasks.length > 0 && (
          <div className="alert-card alert-danger">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-accent-red/15 text-accent-red">
              <ICONS.AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-accent-red text-sm">
                {rejectedTasks.length} tugas dikembalikan untuk direvisi
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Komandan telah memberikan catatan. Buka halaman Tugas Saya untuk melihat detail.
              </p>
              {canOpenTasks && (
                <Link to="/prajurit/tasks" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent-red hover:underline">
                  Lihat tugas yang ditolak →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        {(canViewTaskModules || canViewAttendanceModules) && (
          <StatsGrid>
            {canViewTaskModules && (
              <>
                <StatCard accent="gold" icon={<ICONS.Clipboard className="h-5 w-5 text-accent-gold" aria-hidden="true" />} label="Tugas Aktif" value={activeTasks.length} />
                <StatCard accent="green" icon={<ICONS.BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />} label="Tugas Selesai" value={doneTasks.length} />
                <StatCard accent="blue" icon={<ICONS.ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />} label="Total Tugas" value={tasks.length} />
              </>
            )}
            {canViewAttendanceModules && (
              <StatCard
                accent={todayAttendance ? 'green' : 'blue'}
                icon={<ICONS.CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />}
                label="Status Hari Ini"
                value={todayAttendance ? 'Hadir' : '—'}
              />
            )}
          </StatsGrid>
        )}

        {/* Announcements */}
        <div>
          <div className="panel-heading mb-3">
            <h3 className="flex items-center gap-2 font-bold text-text-primary">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <ICONS.Megaphone className="h-4 w-4" aria-hidden="true" />
              </span>
              Pengumuman
            </h3>
          </div>
          {annLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-surface/70 rounded-2xl" />
              ))}
            </div>
          ) : recentAnnouncements.length === 0 ? (
            <EmptyState
              title="Belum ada pengumuman"
              description="Info terbaru dari komando akan muncul otomatis di sini."
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {recentAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className={`group app-card flex flex-col gap-2.5 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-start sm:gap-3 ${ann.is_pinned ? 'border-accent-gold/40 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-900/10' : ''}`}
                >
                  {ann.is_pinned ? (
                    <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-accent-gold/15 text-accent-gold">
                      <ICONS.Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                      <ICONS.Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{ann.judul}</p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{ann.isi}</p>
                  </div>
                  <span className="self-start text-[11px] text-text-muted/70 sm:mt-0.5 sm:self-auto">
                    {new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My active tasks */}
        {canViewTaskModules && (
          <div>
            <div className="panel-heading mb-3">
              <h3 className="flex items-center gap-2 font-bold text-text-primary">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-accent-gold">
                  <ICONS.CheckSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                Tugas Aktif Saya
              </h3>
              <Link to="/prajurit/tasks" className="text-sm font-medium text-primary hover:underline">Lihat semua →</Link>
            </div>

            {tasksLoading ? (
              <CardListSkeleton count={2} />
            ) : activeTasks.length === 0 ? (
              <EmptyState
                title="Tidak ada tugas aktif"
                description="Tugas baru akan muncul di sini begitu komandan menugaskan Anda."
                action={(
                  <Link
                    to="/prajurit/tasks"
                    className="inline-flex min-h-[40px] items-center rounded-xl border border-surface bg-slate-50 px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary dark:bg-surface/45"
                  >
                    Buka daftar tugas
                  </Link>
                )}
                className="py-10"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3">
              {activeTasks.slice(0, 4).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onAction={() => {
                    if (canOpenTasks) navigate('/prajurit/tasks');
                  }}
                  actionLabel="Kerjakan"
                />
              ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
