import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import { AttendanceBadge } from '../../components/common/Badge';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import type { Attendance } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import { useUIStore } from '../../store/uiStore';

export default function KomandanAttendance() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('api_get_attendance_report', {
      p_date_from: selectedDate,
      p_date_to: selectedDate,
      p_status: null,
      p_satuan: user?.satuan ?? null,
    });
    setAttendances((data as Attendance[]) ?? []);
    setIsLoading(false);
  }, [selectedDate, user?.satuan]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAttendance();
      showNotification('Data absensi diperbarui', 'success');
    } catch {
      showNotification('Gagal memuat absensi', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void fetchAttendance(); }, [fetchAttendance]);

  useEffect(() => {
    if (!user?.satuan) return;
    const channel = supabase
      .channel('komandan-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => { void fetchAttendance(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.satuan, fetchAttendance]);

  const total = attendances.length;
  const hadir = attendances.filter((a) => a.status === 'hadir').length;
  const alpa = attendances.filter((a) => a.status === 'alpa').length;
  const sakit = attendances.filter((a) => a.status === 'sakit').length;
  const izin = attendances.filter((a) => a.status === 'izin').length;
  const hadirRate = total > 0 ? Math.round((hadir / total) * 100) : 0;

  const handleExportCSV = () => {
    const headers = ['Nama', 'NRP', 'Pangkat', 'Status', 'Check-In', 'Check-Out', 'Keterangan'];
    const rows = attendances.map((a) => [
      a.user?.nama ?? '',
      a.user?.nrp ?? '',
      a.user?.pangkat ?? '',
      a.status,
      a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '',
      a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '',
      a.keterangan ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absensi_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV absensi diekspor', 'success');
  };

  return (
    <DashboardLayout title="Kehadiran Unit">
      <div className="space-y-5">
        <PageHeader
          title="Kehadiran Unit"
          subtitle="Pantau check-in, check-out, dan distribusi kehadiran untuk satuan Anda."
          meta={
            <>
              <span>{user?.satuan ?? '—'}</span>
              <span>Hadir {hadirRate}%</span>
            </>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => void refresh()} isLoading={isRefreshing}>Muat Ulang</Button>
              <Button variant="secondary" onClick={handleExportCSV}>Export CSV</Button>
            </>
          }
        />

        <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-muted">Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-control w-auto"
            />
          </div>
          <div className="flex gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Hadir: {hadir}</span>
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Alpa: {alpa}</span>
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Sakit: {sakit}</span>
            <span className="rounded-full border border-surface/70 px-2.5 py-1">Izin: {izin}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: total, color: 'text-text-primary' },
            { label: 'Hadir', value: hadir, color: 'text-success' },
            { label: 'Alpa', value: alpa, color: 'text-accent-red' },
            { label: 'Sakit / Izin', value: sakit + izin, color: 'text-accent-gold' },
          ].map((s) => (
            <div key={s.label} className="bg-bg-card border border-surface rounded-xl p-4">
              <p className="text-xs text-text-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <Table<Attendance>
          columns={[
            {
              key: 'user',
              header: 'Personel',
              render: (a) => (
                <div>
                  <p className="font-medium text-text-primary">{a.user?.nama ?? '—'}</p>
                  <p className="font-mono text-xs text-text-muted">{a.user?.nrp}</p>
                </div>
              ),
            },
            { key: 'pangkat', header: 'Pangkat', render: (a) => a.user?.pangkat ?? '—' },
            { key: 'status', header: 'Status', render: (a) => <AttendanceBadge status={a.status} /> },
            {
              key: 'check_in',
              header: 'Check-In',
              render: (a) => a.check_in
                ? new Date(a.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : '—',
            },
            {
              key: 'check_out',
              header: 'Check-Out',
              render: (a) => a.check_out
                ? new Date(a.check_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : '—',
            },
            {
              key: 'keterangan',
              header: 'Keterangan',
              render: (a) => <span className="text-sm text-text-muted">{a.keterangan ?? '—'}</span>,
            },
          ]}
          data={attendances}
          keyExtractor={(a) => a.id}
          isLoading={isLoading}
          emptyMessage={`Tidak ada data absensi untuk ${new Date(selectedDate).toLocaleDateString('id-ID')}`}
        />
      </div>
    </DashboardLayout>
  );
}
