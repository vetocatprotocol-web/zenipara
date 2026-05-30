import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Info } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { LeaveStatusBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { canWrite, getOperationalRoleLabel } from '../../lib/rolePermissions';
import type { LeaveRequest } from '../../types';

const JENIS_LABEL: Record<string, string> = {
  cuti: 'Cuti',
  sakit: 'Sakit',
  dinas_luar: 'Dinas Luar',
};

function durasi(mulai: string, selesai: string): string {
  const m = new Date(mulai);
  const s = new Date(selesai);
  const days = Math.round((s.getTime() - m.getTime()) / 86_400_000) + 1;
  return `${days} hari`;
}

export default function StafLeaveReview() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { requests, isLoading, reviewLeaveRequest } = useLeaveRequests({ satuan: user?.satuan });

  const canWriteLeave = canWrite(user, 'leave');

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const filtered = requests.filter((r) =>
    filterStatus === 'all' || r.status === filterStatus,
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleApprove = async (req: LeaveRequest) => {
    setIsReviewing(true);
    try {
      await reviewLeaveRequest(req.id, 'approved');
      showNotification(`Izin ${req.user?.nama ?? ''} disetujui`, 'success');
      setSelectedReq(null);
    } catch {
      showNotification('Gagal menyetujui izin', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    setIsReviewing(true);
    try {
      await reviewLeaveRequest(selectedReq.id, 'rejected');
      showNotification(`Izin ${selectedReq.user?.nama ?? ''} ditolak`, 'info');
      setSelectedReq(null);
      setRejectionNote('');
    } catch {
      showNotification('Gagal menolak izin', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <DashboardLayout title="Permohonan Izin Personel">
      <div className="space-y-5">
        <PageHeader
          title="Permohonan Izin Personel"
          subtitle="Tinjau dan proses permohonan izin / cuti dari personel satuan."
          meta={
            pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-accent-gold">
                <Clock className="h-3.5 w-3.5" />
                {pendingCount} menunggu persetujuan
              </span>
            ) : undefined
          }
        />

        {/* Access info */}
        {!canWriteLeave && (
          <div className="flex items-start gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/8 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 text-accent-gold" aria-hidden="true" />
            <p className="text-sm text-text-muted">
              <span className="font-medium text-accent-gold">{getOperationalRoleLabel(user)}</span> — hanya dapat membaca data. Persetujuan izin dilakukan oleh Staf S-1 atau Komandan.
            </p>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex gap-1 bg-surface/40 rounded-lg p-1 w-fit">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterStatus(opt)}
              aria-pressed={filterStatus === opt}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                filterStatus === opt ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {opt === 'all' ? 'Semua' : opt === 'pending' ? `Menunggu${pendingCount > 0 ? ` (${pendingCount})` : ''}` : opt === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="h-6 w-6" />}
            title={filterStatus === 'pending' ? 'Tidak ada izin menunggu persetujuan' : 'Tidak ada data'}
            description={filterStatus === 'pending' ? 'Semua permohonan izin sudah diproses.' : 'Tidak ada permohonan izin dengan filter yang dipilih.'}
          />
        ) : (
          <Table<LeaveRequest>
            columns={[
              {
                key: 'created_at',
                header: 'Tgl Diajukan',
                render: (r) => new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
              },
              {
                key: 'user',
                header: 'Personel',
                render: (r) => (
                  <div>
                    <p className="font-medium text-text-primary">{r.user?.nama ?? '—'}</p>
                    <p className="font-mono text-xs text-text-muted">{r.user?.nrp}</p>
                  </div>
                ),
              },
              {
                key: 'jenis_izin',
                header: 'Jenis',
                render: (r) => JENIS_LABEL[r.jenis_izin] ?? r.jenis_izin,
              },
              {
                key: 'tanggal_mulai',
                header: 'Periode',
                render: (r) => (
                  <div>
                    <p className="text-sm">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} — {new Date(r.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-xs text-text-muted">{durasi(r.tanggal_mulai, r.tanggal_selesai)}</p>
                  </div>
                ),
              },
              {
                key: 'alasan',
                header: 'Alasan',
                render: (r) => <p className="text-sm text-text-muted line-clamp-2">{r.alasan}</p>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <LeaveStatusBadge status={r.status} />,
              },
              {
                key: 'actions',
                header: 'Aksi',
                render: (r) =>
                  r.status === 'pending' && canWriteLeave ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                        onClick={() => handleApprove(r)}
                        isLoading={isReviewing}
                      >
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        leftIcon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => { setSelectedReq(r); setRejectionNote(''); }}
                      >
                        Tolak
                      </Button>
                    </div>
                  ) : r.status !== 'pending' ? (
                    <span className="text-xs text-text-muted">
                      {r.reviewer?.nama ? `oleh ${r.reviewer.nama}` : '—'}
                    </span>
                  ) : null,
              },
            ]}
            data={filtered}
            keyExtractor={(r) => r.id}
            isLoading={false}
            emptyMessage="Tidak ada permohonan izin"
          />
        )}
      </div>

      {/* Rejection confirmation modal */}
      <Modal
        isOpen={!!selectedReq}
        onClose={() => { setSelectedReq(null); setRejectionNote(''); }}
        title="Konfirmasi Penolakan Izin"
        size="sm"
        footer={
          selectedReq ? (
            <>
              <Button variant="ghost" onClick={() => { setSelectedReq(null); setRejectionNote(''); }}>Batal</Button>
              <Button variant="danger" isLoading={isReviewing} onClick={handleReject}>
                Ya, Tolak Izin
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedReq && (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Anda akan menolak permohonan izin <span className="font-semibold text-text-primary">{selectedReq.user?.nama ?? '—'}</span> ({JENIS_LABEL[selectedReq.jenis_izin]}, {durasi(selectedReq.tanggal_mulai, selectedReq.tanggal_selesai)}).
            </p>
            <Input
              label="Catatan (opsional)"
              placeholder="Alasan penolakan..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
