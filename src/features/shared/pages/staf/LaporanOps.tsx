import { useState } from 'react';
import DashboardLayout from '@/features/shared/components/layout/DashboardLayout';
import PageHeader from '@/features/shared/components/ui/PageHeader';
import Button from '@/features/shared/components/common/Button';
import Modal from '@/features/shared/components/common/Modal';
import ConfirmModal from '@/features/shared/components/common/ConfirmModal';
import Badge from '@/features/shared/components/common/Badge';
import Table from '@/features/shared/components/ui/Table';
import EmptyState from '@/features/shared/components/common/EmptyState';
import { CardListSkeleton } from '@/features/shared/components/common/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { isRoleAdmin } from '@/features/shared/lib/rolePermissions';
import { useUIStore } from '@/store/uiStore';
import { useLaporanOps } from '@/features/shared/hooks/useLaporanOps';
import type { LaporanOpsJenis, LaporanOpsStatus } from '@/types';

const JENIS_OPTIONS: { value: LaporanOpsJenis; label: string }[] = [
  { value: 'harian',     label: 'Laporan Harian' },
  { value: 'insidentil', label: 'Insidentil' },
  { value: 'latihan',    label: 'Hasil Latihan' },
  { value: 'inspeksi',   label: 'Inspeksi' },
  { value: 'lainnya',    label: 'Lainnya' },
];

const STATUS_BADGE: Record<LaporanOpsStatus, 'neutral' | 'warning' | 'info' | 'success'> = {
  draft:       'neutral',
  diajukan:    'warning',
  diketahui:   'success',
  diarsipkan:  'info',
};

const STATUS_LABEL: Record<LaporanOpsStatus, string> = {
  draft:       'Draft',
  diajukan:    'Diajukan',
  diketahui:   'Diketahui',
  diarsipkan:  'Diarsipkan',
};

const defaultForm = {
  judul: '',
  jenis: 'harian' as LaporanOpsJenis,
  tanggalKejadian: new Date().toISOString().split('T')[0],
  waktuKejadian: '',
  lokasi: '',
  uraian: '',
  tindakan: '',
  rekomendasi: '',
};

export default function StafLaporanOpsPage() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { laporan, isLoading, createLaporan, updateStatus, removeLaporan } = useLaporanOps();
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState(defaultForm);

  const handleCreate = async () => {
    if (!form.judul.trim() || !form.uraian.trim() || !form.tanggalKejadian) {
      showNotification('Judul, uraian, dan tanggal wajib diisi', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await createLaporan({
        judul: form.judul,
        jenis: form.jenis,
        tanggalKejadian: form.tanggalKejadian,
        uraian: form.uraian,
        waktuKejadian: form.waktuKejadian || undefined,
        lokasi: form.lokasi || undefined,
        tindakan: form.tindakan || undefined,
        rekomendasi: form.rekomendasi || undefined,
      });
      showNotification('Laporan berhasil dibuat', 'success');
      setShowCreate(false);
      setForm(defaultForm);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAjukan = async (id: string) => {
    try {
      await updateStatus(id, 'diajukan');
      showNotification('Laporan diajukan ke komandan', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengajukan', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await removeLaporan(confirmDeleteId);
      showNotification('Laporan dihapus', 'success');
    } catch {
      showNotification('Gagal menghapus laporan', 'error');
    } finally {
      setConfirmDeleteId(null);
      setIsDeleting(false);
    }
  };

  const filtered = filterStatus
    ? laporan.filter((l) => l.status === filterStatus)
    : laporan;

  const canDelete = (dibuatOleh: string | undefined, status: LaporanOpsStatus) =>
    (dibuatOleh === user?.id || isRoleAdmin(user?.role)) && status === 'draft';

  return (
    <DashboardLayout title="Laporan Operasional">
      <PageHeader
        title="Laporan Operasional"
        subtitle="Laporan harian dan insidentil S-3"
        actions={
          <Button onClick={() => setShowCreate(true)} size="sm">
            + Buat Laporan
          </Button>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'draft', 'diajukan', 'diketahui', 'diarsipkan'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              filterStatus === s
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-white/10 text-text-muted hover:border-primary/40'
            }`}
          >
            {s === '' ? 'Semua' : STATUS_LABEL[s as LaporanOpsStatus]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Belum ada laporan" description={filterStatus ? 'Tidak ada laporan dengan status ini.' : 'Buat laporan pertama.'} />
      ) : (
        <Table
          columns={[
            {
              key: 'nomor_laporan',
              header: 'Nomor',
              render: (row) => <span className="text-xs font-mono text-text-muted">{row.nomor_laporan ?? '—'}</span>,
            },
            {
              key: 'tanggal_kejadian',
              header: 'Tanggal',
              render: (row) => new Date(row.tanggal_kejadian).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            },
            {
              key: 'jenis',
              header: 'Jenis',
              render: (row) => JENIS_OPTIONS.find((o) => o.value === row.jenis)?.label ?? row.jenis,
            },
            { key: 'judul', header: 'Judul', render: (row) => row.judul },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
            },
            {
              key: 'id',
              header: 'Aksi',
              render: (row) => (
                <div className="flex gap-1">
                  {row.status === 'draft' && (
                    <Button size="sm" variant="ghost" onClick={() => handleAjukan(row.id)}>
                      Ajukan
                    </Button>
                  )}
                  {canDelete(row.dibuat_oleh, row.status) && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(row.id)} className="text-red-400">
                      Hapus
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(row) => row.id}
        />
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Laporan Operasional">
        <div className="space-y-4">
          <div>
            <label className="label-text">Judul Laporan</label>
            <input className="input-field" placeholder="Contoh: Laporan Harian Operasional 20 April 2026" value={form.judul} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Jenis</label>
              <select className="input-field" value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as LaporanOpsJenis }))}>
                {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Tanggal Kejadian</label>
              <input type="date" className="input-field" value={form.tanggalKejadian} onChange={(e) => setForm((f) => ({ ...f, tanggalKejadian: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Waktu Kejadian (opsional)</label>
              <input type="time" className="input-field" value={form.waktuKejadian} onChange={(e) => setForm((f) => ({ ...f, waktuKejadian: e.target.value }))} />
            </div>
            <div>
              <label className="label-text">Lokasi (opsional)</label>
              <input className="input-field" placeholder="Markas, Lapangan…" value={form.lokasi} onChange={(e) => setForm((f) => ({ ...f, lokasi: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label-text">Uraian Kejadian</label>
            <textarea className="input-field min-h-[100px] resize-none" placeholder="Deskripsikan kejadian secara lengkap…" value={form.uraian} onChange={(e) => setForm((f) => ({ ...f, uraian: e.target.value }))} />
          </div>
          <div>
            <label className="label-text">Tindakan yang Diambil (opsional)</label>
            <textarea className="input-field min-h-[60px] resize-none" value={form.tindakan} onChange={(e) => setForm((f) => ({ ...f, tindakan: e.target.value }))} />
          </div>
          <div>
            <label className="label-text">Rekomendasi (opsional)</label>
            <textarea className="input-field min-h-[60px] resize-none" value={form.rekomendasi} onChange={(e) => setForm((f) => ({ ...f, rekomendasi: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} isLoading={isSaving} className="flex-1">Simpan Draft</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Batal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Laporan"
        message="Laporan akan dihapus permanen. Yakin?"
        confirmLabel="Hapus"
        isConfirming={isDeleting}
        variant="danger"
      />
    </DashboardLayout>
  );
}
