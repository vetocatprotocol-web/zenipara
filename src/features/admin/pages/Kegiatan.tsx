import { useState } from 'react';
import DashboardLayout from '@/features/shared/components/layout/DashboardLayout';
import PageHeader from '@/features/shared/components/ui/PageHeader';
import Button from '@/features/shared/components/common/Button';
import Modal from '@/features/shared/components/common/Modal';
import ConfirmModal from '@/features/shared/components/common/ConfirmModal';
import EmptyState from '@/features/shared/components/common/EmptyState';
import { CardListSkeleton } from '@/features/shared/components/common/Skeleton';
import { useAuthStore } from '@/features/store/authStore';
import { isRoleAdmin } from '@/features/shared/lib/rolePermissions';
import { useUIStore } from '@/store/uiStore';
import { useKegiatan } from '@/features/shared/hooks/useKegiatan';
import { ICONS } from '@/icons';
import type { Kegiatan, KegiatanJenis } from '@/types';

const JENIS_OPTIONS: { value: KegiatanJenis; label: string }[] = [
  { value: 'latihan',    label: 'Latihan' },
  { value: 'upacara',   label: 'Upacara' },
  { value: 'inspeksi',  label: 'Inspeksi' },
  { value: 'perjalanan',label: 'Perjalanan Dinas' },
  { value: 'rapat',     label: 'Rapat' },
  { value: 'lainnya',   label: 'Lainnya' },
];

const JENIS_BADGE: Record<KegiatanJenis, string> = {
  latihan:    'bg-green-500/15 text-green-400 border border-green-500/30',
  upacara:    'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  inspeksi:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  perjalanan: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  rapat:      'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  lainnya:    'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
};

const defaultForm = {
  judul: '',
  jenis: 'latihan' as KegiatanJenis,
  tanggalMulai: '',
  tanggalSelesai: '',
  lokasi: '',
  deskripsi: '',
  isWajib: true,
};

function formatRange(mulai: string, selesai: string) {
  const m = new Date(mulai);
  const s = new Date(selesai);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  if (m.toDateString() === s.toDateString()) {
    return `${m.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${m.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}–${s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${m.toLocaleDateString('id-ID', opts)} – ${s.toLocaleDateString('id-ID', opts)}`;
}

export default function AdminKegiatanPage() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { kegiatan, isLoading, createNewKegiatan, removeKegiatan } = useKegiatan();
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const handleCreate = async () => {
    if (!form.judul.trim() || !form.tanggalMulai || !form.tanggalSelesai) {
      showNotification('Judul, tanggal mulai, dan tanggal selesai wajib diisi', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await createNewKegiatan({
        judul: form.judul,
        jenis: form.jenis,
        tanggalMulai: form.tanggalMulai,
        tanggalSelesai: form.tanggalSelesai,
        lokasi: form.lokasi || undefined,
        deskripsi: form.deskripsi || undefined,
        isWajib: form.isWajib,
      });
      showNotification('Kegiatan berhasil dibuat', 'success');
      setShowCreate(false);
      setForm(defaultForm);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await removeKegiatan(confirmDeleteId);
      showNotification('Kegiatan dihapus', 'success');
    } catch {
      showNotification('Gagal menghapus kegiatan', 'error');
    } finally {
      setConfirmDeleteId(null);
      setIsDeleting(false);
    }
  };

  const upcoming = kegiatan.filter((k) => new Date(k.tanggal_selesai) >= new Date());
  const past = kegiatan.filter((k) => new Date(k.tanggal_selesai) < new Date());

  const KegiatanCard = ({ k }: { k: Kegiatan }) => (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${JENIS_BADGE[k.jenis]}`}>
              {JENIS_OPTIONS.find((o) => o.value === k.jenis)?.label ?? k.jenis}
            </span>
            {k.is_wajib && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-medium">
                Wajib
              </span>
            )}
          </div>
          <p className="font-semibold text-text-primary text-sm truncate">{k.judul}</p>
          <p className="text-xs text-text-muted mt-0.5">{formatRange(k.tanggal_mulai, k.tanggal_selesai)}</p>
          {k.lokasi && (
            <p className="inline-flex items-center gap-1 text-xs text-text-muted">
              <ICONS.MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {k.lokasi}
            </p>
          )}
          {k.deskripsi && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{k.deskripsi}</p>}
        </div>
        {isRoleAdmin(user?.role) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDeleteId(k.id)}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            Hapus
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted border-t border-white/5 pt-2">
        <span className="inline-flex items-center gap-1">
          <ICONS.CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          {k.rsvp_hadir ?? 0} hadir
        </span>
        <span className="inline-flex items-center gap-1">
          <ICONS.XCircle className="h-3.5 w-3.5 text-accent-red" aria-hidden="true" />
          {k.rsvp_tidak_hadir ?? 0} tidak hadir
        </span>
        <span className="inline-flex items-center gap-1">
          <ICONS.Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {(k.rsvp_total ?? 0) - (k.rsvp_hadir ?? 0) - (k.rsvp_tidak_hadir ?? 0)} belum
        </span>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Kalender Kegiatan">
      <PageHeader
        title="Kalender Kegiatan"
        subtitle="Jadwal kegiatan satuan"
        actions={
          <Button onClick={() => setShowCreate(true)} size="sm">
            + Tambah Kegiatan
          </Button>
        }
      />

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : kegiatan.length === 0 ? (
        <EmptyState title="Belum ada kegiatan" description="Tambahkan kegiatan pertama untuk satuan." />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Akan Datang</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((k) => <KegiatanCard key={k.id} k={k} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Sudah Berlalu</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                {past.map((k) => <KegiatanCard key={k.id} k={k} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tambah Kegiatan">
        <div className="space-y-4">
          <div>
            <label className="label-text">Judul Kegiatan</label>
            <input
              className="input-field"
              placeholder="Contoh: Latihan Menembak Triwulan II"
              value={form.judul}
              onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-text">Jenis</label>
            <select
              className="input-field"
              value={form.jenis}
              onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as KegiatanJenis }))}
            >
              {JENIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Tanggal &amp; Waktu Mulai</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.tanggalMulai}
                onChange={(e) => setForm((f) => ({ ...f, tanggalMulai: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-text">Tanggal &amp; Waktu Selesai</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.tanggalSelesai}
                onChange={(e) => setForm((f) => ({ ...f, tanggalSelesai: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label-text">Lokasi (opsional)</label>
            <input
              className="input-field"
              placeholder="Lapangan A, Gedung Komando, dll"
              value={form.lokasi}
              onChange={(e) => setForm((f) => ({ ...f, lokasi: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-text">Deskripsi (opsional)</label>
            <textarea
              className="input-field min-h-[80px] resize-none"
              placeholder="Detail kegiatan…"
              value={form.deskripsi}
              onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is-wajib"
              type="checkbox"
              checked={form.isWajib}
              onChange={(e) => setForm((f) => ({ ...f, isWajib: e.target.checked }))}
              className="accent-primary"
            />
            <label htmlFor="is-wajib" className="text-sm text-text-secondary cursor-pointer">
              Kehadiran wajib
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} isLoading={isSaving} className="flex-1">
              Simpan
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">
              Batal
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Kegiatan"
        message="Kegiatan ini beserta seluruh data RSVP akan dihapus permanen. Yakin?"
        confirmLabel="Hapus"
        isConfirming={isDeleting}
        variant="danger"
      />
    </DashboardLayout>
  );
}
