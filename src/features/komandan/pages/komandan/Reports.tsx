import { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, CheckSquare, Clock, Calendar, RefreshCw, Download } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import BarChart from '../../components/ui/BarChart';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import { AttendanceBadge, TaskStatusBadge, LeaveStatusBadge } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { CardListSkeleton, StatCardsSkeleton } from '../../components/common/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import type { Attendance, Task } from '../../types';

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { requests: leaveRequests, reviewLeaveRequest } = useLeaveRequests({ satuan: user?.satuan });
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('api_get_komandan_reports', {
        p_satuan: user?.satuan ?? null,
        p_tanggal: selectedDate,
      });
      if (error) throw error;

      const payload = (data as { attendances?: Attendance[]; tasks?: Task[] } | null) ?? null;
      setAttendances(payload?.attendances ?? []);
      setTasks(payload?.tasks ?? []);
    } catch {
      setAttendances([]);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.satuan, selectedDate]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.satuan) void fetchData();
  }, [user?.satuan, fetchData]);

  useEffect(() => {
    if (!user?.satuan) return;
    const channel = supabase
      .channel('komandan-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => { void fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.satuan, fetchData]);

  const reportStats = useMemo(() => {
    let presentCount = 0;
    let absenCount = 0;
    let sakitCount = 0;
    let izinCount = 0;
    let approvedTasks = 0;
    let doneTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let rejectedTasks = 0;
    let pendingLeave = 0;
    let approvedLeave = 0;
    let rejectedLeave = 0;

    const taskByPersonMap = new Map<string, { nama: string; done: number; total: number }>();
    const pendingLeaveRequests: typeof leaveRequests = [];

    for (const attendance of attendances) {
      switch (attendance.status) {
        case 'hadir':
          presentCount += 1;
          break;
        case 'alpa':
          absenCount += 1;
          break;
        case 'sakit':
          sakitCount += 1;
          break;
        case 'izin':
          izinCount += 1;
          break;
      }
    }

    for (const task of tasks) {
      const key = task.assignee?.id ?? '';
      const nama = task.assignee?.nama ?? '—';
      const prev = taskByPersonMap.get(key) ?? { nama, done: 0, total: 0 };

      prev.total += 1;
      if (task.status === 'approved' || task.status === 'done') {
        prev.done += 1;
      }
      taskByPersonMap.set(key, prev);

      switch (task.status) {
        case 'approved':
          approvedTasks += 1;
          break;
        case 'done':
          doneTasks += 1;
          break;
        case 'pending':
          pendingTasks += 1;
          break;
        case 'in_progress':
          inProgressTasks += 1;
          pendingTasks += 1;
          break;
        case 'rejected':
          rejectedTasks += 1;
          break;
      }
    }

    for (const request of leaveRequests) {
      switch (request.status) {
        case 'pending':
          pendingLeave += 1;
          pendingLeaveRequests.push(request);
          break;
        case 'approved':
          approvedLeave += 1;
          break;
        case 'rejected':
          rejectedLeave += 1;
          break;
      }
    }

    const taskByPerson = Array.from(taskByPersonMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      presentCount,
      absenCount,
      sakitCount,
      izinCount,
      approvedTasks,
      doneTasks,
      pendingTasks,
      rejectedTasks,
      pendingLeave,
      approvedLeave,
      rejectedLeave,
      taskByPerson,
      attendanceRate: attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 0,
      taskStatusChart: [
        { label: 'Pending', value: pendingTasks, color: '#94a3b8' },
        { label: 'Dikerjakan', value: inProgressTasks, color: 'var(--color-accent-gold)' },
        { label: 'Selesai', value: doneTasks, color: '#60a5fa' },
        { label: 'Disetujui', value: approvedTasks, color: 'var(--color-success)' },
        { label: 'Ditolak', value: rejectedTasks, color: 'var(--color-accent-red)' },
      ],
      attendanceChart: [
        { label: 'Hadir', value: presentCount, color: 'var(--color-success)' },
        { label: 'Alpa', value: absenCount, color: 'var(--color-accent-red)' },
        { label: 'Sakit', value: sakitCount, color: 'var(--color-accent-gold)' },
        { label: 'Izin', value: izinCount, color: '#60a5fa' },
      ],
      pendingLeaveRequests,
    };
  }, [attendances, tasks, leaveRequests]);

  if (isLoading) return (
    <DashboardLayout title="Laporan Harian">
      <div className="space-y-6">
        <StatCardsSkeleton />
        <CardListSkeleton count={3} />
      </div>
    </DashboardLayout>
  );

  const { presentCount, absenCount, approvedTasks, pendingTasks, pendingLeave, approvedLeave, rejectedLeave, taskByPerson, attendanceRate, taskStatusChart, attendanceChart, pendingLeaveRequests } = reportStats;

  const handleExportCSV = () => {
    const headers = ['Tanggal', 'NRP', 'Nama', 'Pangkat', 'Status', 'Check-In', 'Check-Out', 'Keterangan'];
    const rows = attendances.map((a) => [
      a.tanggal,
      a.user?.nrp ?? '',
      a.user?.nama ?? '',
      a.user?.pangkat ?? '',
      a.status,
      a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '',
      a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '',
      a.keterangan ?? '',
    ]);
    downloadCSV([headers, ...rows], `laporan_${user?.satuan ?? 'unit'}_${selectedDate}.csv`);
    showNotification('CSV laporan diekspor', 'success');
  };

  const handleReviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    setReviewingId(id);
    try {
      await reviewLeaveRequest(id, status);
      showNotification(
        status === 'approved' ? 'Izin disetujui' : 'Izin ditolak',
        status === 'approved' ? 'success' : 'info',
      );
    } catch {
      showNotification('Gagal memproses permohonan', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout title="Laporan Harian">
      <div className="space-y-6">
        <PageHeader
          title="Laporan Harian"
          subtitle="Ringkasan cepat status kehadiran, tugas, dan izin personel untuk keputusan harian."
          meta={
            <>
              <span>Unit: {user?.satuan ?? '—'}</span>
              <span>Rasio hadir: {attendanceRate}%</span>
            </>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => void refresh()} isLoading={isRefreshing} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>Muat Ulang</Button>
              <Button variant="secondary" onClick={handleExportCSV} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>Export CSV</Button>
            </>
          }
        />

        <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-muted whitespace-nowrap">Tanggal laporan:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-control w-auto"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Izin menunggu: {pendingLeave}</span>
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Izin disetujui: {approvedLeave}</span>
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Izin ditolak: {rejectedLeave}</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: <CheckCircle className="h-5 w-5 text-success" aria-hidden="true" />, label: 'Hadir', value: presentCount, color: 'text-success' },
            { icon: <XCircle className="h-5 w-5 text-accent-red" aria-hidden="true" />, label: 'Alpa', value: absenCount, color: 'text-accent-red' },
            { icon: <CheckSquare className="h-5 w-5 text-primary" aria-hidden="true" />, label: 'Tugas Selesai', value: approvedTasks, color: 'text-primary' },
            { icon: <Clock className="h-5 w-5 text-accent-gold" aria-hidden="true" />, label: 'Tugas Aktif', value: pendingTasks, color: 'text-accent-gold' },
            { icon: <Calendar className="h-5 w-5 text-blue-400" aria-hidden="true" />, label: 'Izin Menunggu', value: pendingLeave, color: 'text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="app-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">{s.label}</span>
                {s.icon}
              </div>
              <div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Performance Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Attendance breakdown bar chart */}
          <div className="app-card p-5">
            <h3 className="font-semibold text-text-primary mb-1">Distribusi Kehadiran</h3>
            <p className="text-xs text-text-muted mb-4">Komposisi status absensi hari {new Date(selectedDate).toLocaleDateString('id-ID')}</p>
            {attendances.length === 0 ? (
              <EmptyState
                title="Belum ada data absensi"
                description="Data absensi untuk tanggal ini belum tersedia. Coba pilih tanggal lain atau muat ulang laporan."
                className="border-0 bg-transparent px-0 py-8"
              />
            ) : (
              <BarChart
                data={attendanceChart}
                maxValue={attendances.length}
                height={160}
              />
            )}
          </div>

          {/* Task status bar chart */}
          <div className="app-card p-5">
            <h3 className="font-semibold text-text-primary mb-1">Status Tugas Unit</h3>
            <p className="text-xs text-text-muted mb-4">Distribusi status seluruh tugas aktif unit</p>
            {tasks.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">Belum ada data tugas</p>
            ) : (
              <BarChart
                data={taskStatusChart}
                maxValue={tasks.length}
                height={160}
              />
            )}
          </div>

          {/* Per-person task chart */}
          {taskByPerson.length > 0 && (
            <div className="app-card p-5 lg:col-span-2">
              <h3 className="font-semibold text-text-primary mb-1">Beban Tugas per Personel</h3>
              <p className="text-xs text-text-muted mb-4">Jumlah total tugas yang ditugaskan (max 8 personel)</p>
              <BarChart
                data={taskByPerson.map((p) => ({
                  label: p.nama.split(' ')[0],
                  value: p.total,
                  color: p.done === p.total && p.total > 0 ? 'var(--color-success)' : 'var(--color-primary)',
                }))}
                maxValue={Math.max(...taskByPerson.map((p) => p.total), 1)}
                height={160}
                unit=" tugas"
              />
            </div>
          )}
        </div>

        {/* Leave Requests Pending Approval */}
        {pendingLeave > 0 && (
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface/80 px-5 py-4">
              <h3 className="font-semibold text-text-primary">Permohonan Izin — Perlu Persetujuan</h3>
              <span className="bg-blue-500/20 text-blue-400 text-xs rounded-full px-2.5 py-0.5 font-medium">
                {pendingLeave} menunggu
              </span>
            </div>
            <div className="divide-y divide-surface/50">
              {pendingLeaveRequests
                .map((req) => {
                  const jenisLabel: Record<string, string> = {
                    cuti: 'Cuti',
                    sakit: 'Sakit',
                    dinas_luar: 'Dinas Luar',
                  };
                  return (
                    <div key={req.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{req.user?.nama ?? '—'}</p>
                        <p className="text-xs text-text-muted">
                          {jenisLabel[req.jenis_izin] ?? req.jenis_izin}
                          {' · '}
                          {new Date(req.tanggal_mulai).toLocaleDateString('id-ID')}
                          {' — '}
                          {new Date(req.tanggal_selesai).toLocaleDateString('id-ID')}
                        </p>
                        <p className="text-xs text-text-muted truncate">{req.alasan}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={reviewingId === req.id}
                          onClick={() => handleReviewLeave(req.id, 'approved')}
                        >
                          Setuju
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={reviewingId === req.id}
                          onClick={() => handleReviewLeave(req.id, 'rejected')}
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Attendance Today */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-surface/80 px-5 py-4">
            <h3 className="font-semibold text-text-primary">
              Absensi Hari Ini — {new Date().toLocaleDateString('id-ID')}
            </h3>
          </div>
          <div className="divide-y divide-surface/50 max-h-64 overflow-y-auto">
            {attendances.length === 0 ? (
              <EmptyState title="Belum ada absensi hari ini" description="Absensi akan muncul otomatis begitu ada data check-in untuk tanggal yang dipilih." className="border-0 bg-transparent px-0 py-8" />
            ) : (
              attendances.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{a.user?.nama ?? '—'}</p>
                    <p className="text-xs text-text-muted font-mono">{a.user?.nrp}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">
                      {a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <AttendanceBadge status={a.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-surface/80 px-5 py-4">
            <h3 className="font-semibold text-text-primary">Status Tugas Terkini</h3>
          </div>
          <div className="divide-y divide-surface/50 max-h-64 overflow-y-auto">
            {tasks.length === 0 ? (
              <EmptyState title="Belum ada tugas" description="Belum ada tugas yang terdaftar untuk unit ini pada rentang data yang dipilih." className="border-0 bg-transparent px-0 py-8" />
            ) : (
              tasks.slice(0, 20).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{t.judul}</p>
                    <p className="text-xs text-text-muted">{t.assignee?.nama ?? '—'}</p>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* All Leave Requests */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-surface/80 px-5 py-4">
            <h3 className="font-semibold text-text-primary">Riwayat Permohonan Izin</h3>
          </div>
          <div className="divide-y divide-surface/50 max-h-64 overflow-y-auto">
            {leaveRequests.length === 0 ? (
              <EmptyState title="Belum ada permohonan izin" description="Permohonan izin belum masuk untuk unit ini. Data akan tampil otomatis saat ada pengajuan baru." className="border-0 bg-transparent px-0 py-8" />
            ) : (
              leaveRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{req.user?.nama ?? '—'}</p>
                    <p className="text-xs text-text-muted">
                      {req.jenis_izin} · {new Date(req.tanggal_mulai).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <LeaveStatusBadge status={req.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

