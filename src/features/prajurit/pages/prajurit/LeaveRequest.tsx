import { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import type { LeaveRequest } from '../../types';

function LeaveStatusBadge({ status }: { status: string }) {
  const map = {
    pending: { variant: 'warning', label: 'Menunggu' },
    approved: { variant: 'success', label: 'Disetujui' },
    rejected: { variant: 'error', label: 'Ditolak' },
  } as const;
  const cfg = map[status as keyof typeof map] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function LeaveRequest() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { requests, isLoading, submitLeaveRequest } = useLeaveRequests({ userId: user?.id });

  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    jenis_izin: 'cuti' as 'cuti' | 'sakit' | 'dinas_luar',
    tanggal_mulai: today,
    tanggal_selesai: today,
    alasan: '',
  });

  const handleSubmit = async () => {
    if (!form.alasan.trim()) {
      showNotification('Alasan wajib diisi', 'error');
      return;
    }
    if (form.tanggal_selesai < form.tanggal_mulai) {
      showNotification('Tanggal selesai harus sama atau setelah tanggal mulai', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitLeaveRequest(form);
      showNotification('Permohonan izin berhasil dikirim', 'success');
      setShowCreate(false);
      setForm({ jenis_izin: 'cuti', tanggal_mulai: today, tanggal_selesai: today, alasan: '' });
    } catch {
      showNotification('Gagal mengirim permohonan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calcDuration = (from: string, to: string) => {
    const diff = Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
    return diff;
  };

  const jenisLabel: Record<string, string> = {
    cuti: 'Cuti',
    sakit: 'Sakit',
    dinas_luar: 'Dinas Luar',
  };

  const pending = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;
  const filteredRequests = requests.filter((request) => filterStatus === 'all' || request.status === filterStatus);

  return (
    <DashboardLayout title="Permohonan Izin">
      <div className="space-y-5">
        <PageHeader
          title="Permohonan Izin"
          subtitle="Ajukan izin dinas dan pantau status persetujuan secara transparan."
          meta={
            <>
              <span>Disetujui: {approved}</span>
              <span>Menunggu: {pending}</span>
              <span>Ditolak: {rejected}</span>
            </>
          }
          actions={<Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Ajukan Izin</Button>}
        />

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: requests.length, color: 'text-text-primary' },
            { label: 'Disetujui', value: approved, color: 'text-success' },
            { label: 'Menunggu', value: pending, color: 'text-accent-gold' },
            { label: 'Ditolak', value: rejected, color: 'text-accent-red' },
          ].map((s) => (
            <div key={s.label} className="app-card p-4">
              <p className="text-xs text-text-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="app-card flex flex-wrap gap-2 p-3 sm:p-4">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'border-primary bg-primary text-white'
                  : 'border-surface/70 text-text-muted hover:border-primary hover:text-text-primary'
              }`}
            >
              {status === 'all' ? 'Semua' : status === 'pending' ? 'Menunggu' : status === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSpinner message="Memuat permohonan..." />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" aria-hidden="true" />}
            title="Belum ada permohonan izin"
            description="Ajukan permohonan izin menggunakan tombol di atas."
          />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" aria-hidden="true" />}
            title="Tidak ada permohonan dengan status ini"
            description="Coba pilih filter status lain."
          />
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedReq(req)}
                className="app-card w-full p-4 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary">
                        {jenisLabel[req.jenis_izin] ?? req.jenis_izin}
                      </span>
                      <LeaveStatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-text-muted">
                      {new Date(req.tanggal_mulai).toLocaleDateString('id-ID')}
                      {' — '}
                      {new Date(req.tanggal_selesai).toLocaleDateString('id-ID')}
                      {' '}
                      ({calcDuration(req.tanggal_mulai, req.tanggal_selesai)} hari)
                    </p>
                    <p className="text-sm text-text-muted mt-1 truncate">{req.alasan}</p>
                  </div>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {new Date(req.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title="Detail Permohonan Izin"
        size="md"
        footer={<Button variant="ghost" onClick={() => setSelectedReq(null)}>Tutup</Button>}
      >
        {selectedReq && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Jenis Izin</span>
              <span className="text-text-primary font-medium">{jenisLabel[selectedReq.jenis_izin] ?? selectedReq.jenis_izin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Tanggal Mulai</span>
              <span className="text-text-primary">{new Date(selectedReq.tanggal_mulai).toLocaleDateString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Tanggal Selesai</span>
              <span className="text-text-primary">{new Date(selectedReq.tanggal_selesai).toLocaleDateString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Durasi</span>
              <span className="text-text-primary">{calcDuration(selectedReq.tanggal_mulai, selectedReq.tanggal_selesai)} hari</span>
            </div>
            <div className="flex justify-between items-start gap-3">
              <span className="text-text-muted">Alasan</span>
              <span className="text-text-primary text-right">{selectedReq.alasan}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Status</span>
              <LeaveStatusBadge status={selectedReq.status} />
            </div>
            {selectedReq.reviewer && (
              <div className="flex justify-between">
                <span className="text-text-muted">Ditinjau oleh</span>
                <span className="text-text-primary">{selectedReq.reviewer.nama}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Ajukan Permohonan Izin"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>Kirim Permohonan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-text-primary">Jenis Izin</label>
            <select
              className="form-control mt-1"
              value={form.jenis_izin}
              onChange={(e) => setForm({ ...form, jenis_izin: e.target.value as typeof form.jenis_izin })}
            >
              <option value="cuti">Cuti</option>
              <option value="sakit">Sakit</option>
              <option value="dinas_luar">Dinas Luar</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tanggal Mulai"
              type="date"
              min={today}
              value={form.tanggal_mulai}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
            />
            <Input
              label="Tanggal Selesai"
              type="date"
              min={form.tanggal_mulai}
              value={form.tanggal_selesai}
              onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary">Alasan *</label>
            <textarea
              className="form-control mt-1 min-h-24"
              rows={4}
              placeholder="Jelaskan alasan permohonan izin Anda..."
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
