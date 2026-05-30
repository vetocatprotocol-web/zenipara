import { useState, useEffect, useCallback } from 'react';
import { Layers3, CalendarDays, Filter, Download, Printer, RotateCcw, Plus } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import UserSearchSelect from '../../components/common/UserSearchSelect';
import PageHeader from '../../components/ui/PageHeader';
import { AttendanceBadge } from '../../components/common/Badge';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useSatuans } from '../../hooks/useSatuans';
import { supabase } from '../../lib/supabase';
import { canWrite } from '../../lib/rolePermissions';
import type { Attendance } from '../../types';

const PAGE_SIZE = 50;

function getDefaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceReport() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const canWriteAttendance = canWrite(user, 'attendance');
  const { satuans } = useSatuans({ onlyActive: false });

  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    return getDefaultDateFrom();
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSatuan, setFilterSatuan] = useState('');

  // Manual entry modal state
  const [showManual, setShowManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [manualForm, setManualForm] = useState({
    user_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    status: 'hadir' as 'hadir' | 'alpa' | 'sakit' | 'izin' | 'dinas_luar',
    check_in: '',
    check_out: '',
    keterangan: '',
  });

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('api_get_attendance_report', {
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_status: filterStatus || null,
      p_satuan: filterSatuan || null,
    });
    setAttendances((data as Attendance[]) ?? []);
    setIsLoading(false);
  }, [dateFrom, dateTo, filterStatus, filterSatuan]);

  useEffect(() => { void fetchAttendance(); }, [fetchAttendance]);

  const handleManualSave = async () => {
    if (!manualForm.user_id) {
      showNotification('Pilih personel terlebih dahulu', 'error');
      return;
    }
    if (!user?.id || !user.role) {
      showNotification('Sesi tidak valid', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('api_upsert_attendance', {
        p_caller_id: user.id,
        p_caller_role: user.role,
        p_user_id: manualForm.user_id,
        p_tanggal: manualForm.tanggal,
        p_status: manualForm.status,
        p_check_in: manualForm.check_in || null,
        p_check_out: manualForm.check_out || null,
        p_keterangan: manualForm.keterangan || null,
      });
      if (error) throw error;
      showNotification('Entri absensi berhasil disimpan', 'success');
      setShowManual(false);
      setManualForm({ user_id: '', tanggal: new Date().toISOString().split('T')[0], status: 'hadir', check_in: '', check_out: '', keterangan: '' });
      await fetchAttendance();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan entri', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Tanggal', 'NRP', 'Nama', 'Satuan', 'Pangkat', 'Status', 'Check-In', 'Check-Out', 'Keterangan'];
    const rows = attendances.map((a) => [
      a.tanggal,
      a.user?.nrp ?? '',
      a.user?.nama ?? '',
      a.user?.satuan ?? '',
      a.user?.pangkat ?? '',
      a.status,
      a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '',
      a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '',
      a.keterangan ?? '',
    ]);
    downloadCSV([headers, ...rows], `absensi_${dateFrom}_${dateTo}.csv`);
  };

  // Summary counts
  const total = attendances.length;
  const hadir = attendances.filter((a) => a.status === 'hadir').length;
  const alpa = attendances.filter((a) => a.status === 'alpa').length;
  const sakit = attendances.filter((a) => a.status === 'sakit').length;
  const izin = attendances.filter((a) => a.status === 'izin').length;

  const { currentPage, totalPages, totalItems, paginated, setPage } = usePagination(attendances, PAGE_SIZE);
  const hasFilters = filterStatus !== '' || filterSatuan !== '' || dateFrom !== getDefaultDateFrom() || dateTo !== new Date().toISOString().split('T')[0];

  return (
    <>
      <DashboardLayout title="Rekap Kehadiran">
      <div className="space-y-5 animate-fade-up">
        <PageHeader
          title="Rekap Kehadiran"
          subtitle="Filter, analisis, dan ekspor data kehadiran personel berdasarkan rentang tanggal."
          breadcrumbs={[
            { label: 'Admin', href: '#/admin' },
            { label: 'Rekap Kehadiran' },
          ]}
          meta={
            <>
              <span>Total entri: {total}</span>
              <span>Satuan: {filterSatuan || 'Semua'}</span>
              <span>Status: {filterStatus || 'Semua'}</span>
            </>
          }
          actions={
            canWriteAttendance ? (
              <Button onClick={() => setShowManual(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Tambah Entri
              </Button>
            ) : undefined
          }
        />

        {/* Filters + Export */}
        <div className="app-card flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Periode {new Date(dateFrom).toLocaleDateString('id-ID')} - {new Date(dateTo).toLocaleDateString('id-ID')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <Filter className="h-3.5 w-3.5" />
              Status: {filterStatus || 'Semua'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <Layers3 className="h-3.5 w-3.5" />
              {attendances.length} terlihat
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">Dari:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="form-control"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">Sampai:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="form-control"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="form-control"
            >
              <option value="">Semua Status</option>
              <option value="hadir">Hadir</option>
              <option value="alpa">Alpa</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="dinas_luar">Dinas Luar</option>
            </select>
            <select
              value={filterSatuan}
              onChange={(e) => { setFilterSatuan(e.target.value); setPage(1); }}
              className="form-control"
              aria-label="Filter per satuan"
            >
              <option value="">Semua Satuan</option>
              {satuans.map((s) => (
                <option key={s.id} value={s.nama}>{s.nama}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleExportCSV} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
            <Button variant="ghost" onClick={() => window.print()} data-print-hide leftIcon={<Printer className="h-4 w-4" />}>Cetak / PDF</Button>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom(getDefaultDateFrom());
                  setDateTo(new Date().toISOString().split('T')[0]);
                  setFilterStatus('');
                  setFilterSatuan('');
                  setPage(1);
                }}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          {[
            { label: 'Total Entri', value: total, color: 'text-text-primary' },
            { label: 'Hadir', value: hadir, color: 'text-success' },
            { label: 'Alpa', value: alpa, color: 'text-accent-red' },
            { label: 'Sakit + Izin', value: sakit + izin, color: 'text-accent-gold' },
            { label: 'Halaman Aktif', value: currentPage, color: 'text-primary' },
          ].map((s) => (
            <div key={s.label} className="app-card p-4">
              <p className="text-xs text-text-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <>
            <Table<Attendance>
              columns={[
                {
                  key: 'tanggal',
                  header: 'Tanggal',
                  render: (a) => new Date(a.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
                },
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
                { key: 'satuan', header: 'Satuan', render: (a) => a.user?.satuan ?? '—' },
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
              ]}
              data={paginated}
              keyExtractor={(a) => a.id}
              isLoading={false}
              caption="Tabel rekap kehadiran personel berdasarkan rentang tanggal dan status"
              emptyMessage="Tidak ada data absensi untuk rentang tanggal ini"
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              compactOnMobile
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </DashboardLayout>

    {/* Manual attendance entry modal */}
    <Modal
      isOpen={showManual}
      onClose={() => setShowManual(false)}
      title="Tambah Entri Absensi Manual"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => setShowManual(false)}>Batal</Button>
          <Button isLoading={isSaving} onClick={() => void handleManualSave()}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">Personel</label>
          <UserSearchSelect
            value={manualForm.user_id}
            onChange={(id) => setManualForm((f) => ({ ...f, user_id: id }))}
            placeholder="Cari NRP atau nama..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tanggal"
            type="date"
            value={manualForm.tanggal}
            onChange={(e) => setManualForm((f) => ({ ...f, tanggal: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Status</label>
            <select
              value={manualForm.status}
              onChange={(e) => setManualForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
              className="form-control w-full"
            >
              <option value="hadir">Hadir</option>
              <option value="alpa">Alpa</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="dinas_luar">Dinas Luar</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Check-In (opsional)"
            type="time"
            value={manualForm.check_in}
            onChange={(e) => setManualForm((f) => ({ ...f, check_in: e.target.value }))}
          />
          <Input
            label="Check-Out (opsional)"
            type="time"
            value={manualForm.check_out}
            onChange={(e) => setManualForm((f) => ({ ...f, check_out: e.target.value }))}
          />
        </div>
        <Input
          label="Keterangan (opsional)"
          placeholder="Mis. izin keluarga, sakit dengan surat dokter..."
          value={manualForm.keterangan}
          onChange={(e) => setManualForm((f) => ({ ...f, keterangan: e.target.value }))}
        />
      </div>
    </Modal>
    </>
  );
}

