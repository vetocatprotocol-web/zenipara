import { useState } from 'react';
import { Info, Package, Plus } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { useLogisticsRequests } from '../../hooks/useLogisticsRequests';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import type { LogisticsRequest } from '../../types';

function StatusBadge({ status }: { status: string }) {
  const map = {
    pending:  { variant: 'warning', label: 'Menunggu' },
    approved: { variant: 'success', label: 'Disetujui' },
    rejected: { variant: 'error',   label: 'Ditolak' },
  } as const;
  const cfg = map[status as keyof typeof map] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function LogisticsRequest() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { requests, isLoading, submitRequest } = useLogisticsRequests({ requestedBy: user?.id });

  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReq, setSelectedReq] = useState<LogisticsRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const [form, setForm] = useState({
    nama_item: '',
    jumlah: 1,
    satuan_item: '',
    alasan: '',
  });

  const handleSubmit = async () => {
    if (!form.nama_item.trim()) {
      showNotification('Nama item wajib diisi', 'error');
      return;
    }
    if (!form.alasan.trim()) {
      showNotification('Alasan wajib diisi', 'error');
      return;
    }
    if (form.jumlah < 1) {
      showNotification('Jumlah minimal 1', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitRequest({
        nama_item: form.nama_item.trim(),
        jumlah: form.jumlah,
        satuan_item: form.satuan_item.trim() || undefined,
        alasan: form.alasan.trim(),
      });
      showNotification('Permintaan logistik berhasil dikirim ke Admin', 'success');
      setShowCreate(false);
      setForm({ nama_item: '', jumlah: 1, satuan_item: '', alasan: '' });
    } catch {
      showNotification('Gagal mengirim permintaan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pending  = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;

  const filtered = requests.filter(
    (r) => filterStatus === 'all' || r.status === filterStatus,
  );

  return (
    <DashboardLayout title="Permintaan Logistik">
      <div className="space-y-5">
        <PageHeader
          title="Permintaan Logistik"
          subtitle="Ajukan kebutuhan perlengkapan operasional kepada Admin untuk ditindaklanjuti."
          meta={
            <>
              <span>Menunggu: {pending}</span>
              <span>Disetujui: {approved}</span>
            </>
          }
          actions={<Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Ajukan Permintaan</Button>}
        />

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Menunggu',  value: pending,  color: 'text-accent-gold' },
            { label: 'Disetujui', value: approved, color: 'text-success' },
            { label: 'Ditolak',   value: rejected, color: 'text-accent-red' },
          ].map((s) => (
            <div key={s.label} className="app-card p-4">
              <p className="text-xs text-text-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="app-card flex flex-wrap gap-2 p-3 sm:p-4">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                filterStatus === status
                  ? 'border-primary bg-primary text-white'
                  : 'border-surface/70 text-text-muted hover:border-primary hover:text-text-primary'
              }`}
            >
              {status === 'all' ? 'Semua' : status === 'pending' ? 'Menunggu' : status === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>

        {/* Request list */}
        {isLoading ? (
          <LoadingSpinner message="Memuat permintaan..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
            title={filterStatus === 'all' ? 'Belum ada permintaan logistik' : 'Tidak ada permintaan dengan status ini'}
            description={filterStatus === 'all' ? 'Ajukan kebutuhan perlengkapan kepada Admin menggunakan tombol di atas.' : 'Coba pilih filter status lain.'}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedReq(req)}
                className="app-card w-full p-4 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                        <Package className="h-4 w-4 text-text-muted" aria-hidden="true" />
                        {req.nama_item}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-text-muted">
                      Jumlah: {req.jumlah} {req.satuan_item ?? 'unit'}
                    </p>
                    <p className="text-sm text-text-muted mt-0.5 truncate">{req.alasan}</p>
                    {req.status === 'rejected' && req.admin_note && (
                      <p className="mt-1.5 text-xs text-accent-red/80 border border-accent-red/20 rounded-lg px-2 py-1 bg-accent-red/10">
                        Catatan Admin: {req.admin_note}
                      </p>
                    )}
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
        title="Detail Permintaan Logistik"
        size="md"
        footer={<Button variant="ghost" onClick={() => setSelectedReq(null)}>Tutup</Button>}
      >
        {selectedReq && (
          <div className="space-y-3 text-sm">
            {[
              { label: 'Nama Item', value: selectedReq.nama_item },
              { label: 'Jumlah', value: `${selectedReq.jumlah} ${selectedReq.satuan_item ?? 'unit'}` },
              { label: 'Alasan', value: selectedReq.alasan },
              { label: 'Satuan', value: selectedReq.satuan },
              { label: 'Tanggal Diajukan', value: new Date(selectedReq.created_at).toLocaleString('id-ID') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-3 border-b border-surface/50 pb-2 last:border-0">
                <span className="text-text-muted shrink-0">{label}</span>
                <span className="text-text-primary text-right">{value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Status</span>
              <StatusBadge status={selectedReq.status} />
            </div>
            {selectedReq.admin_note && (
              <div className="rounded-xl border border-surface/70 bg-surface/20 p-3">
                <p className="text-xs font-semibold text-text-muted mb-1">Catatan Admin</p>
                <p className="text-sm text-text-primary">{selectedReq.admin_note}</p>
              </div>
            )}
            {selectedReq.reviewer && (
              <div className="flex justify-between">
                <span className="text-text-muted">Ditinjau oleh</span>
                <span className="text-text-primary">{selectedReq.reviewer.nama}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Request Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Ajukan Permintaan Logistik"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>Kirim ke Admin</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Item / Perlengkapan *"
            type="text"
            placeholder="Contoh: Rompi Taktis, Amunisi Latihan..."
            value={form.nama_item}
            onChange={(e) => setForm({ ...form, nama_item: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jumlah *"
              type="number"
              min="1"
              value={String(form.jumlah)}
              onChange={(e) => setForm({ ...form, jumlah: Math.max(1, Number(e.target.value)) })}
              required
            />
            <Input
              label="Satuan"
              type="text"
              placeholder="pcs, unit, kg..."
              value={form.satuan_item}
              onChange={(e) => setForm({ ...form, satuan_item: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary">Alasan Kebutuhan *</label>
            <textarea
              className="form-control mt-1 min-h-24"
              rows={4}
              placeholder="Jelaskan kebutuhan dan urgensi permintaan ini..."
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
            />
          </div>
          <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/10 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-accent-gold">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Permintaan akan diteruskan ke Admin untuk ditinjau. Status dapat dipantau di halaman ini.
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
