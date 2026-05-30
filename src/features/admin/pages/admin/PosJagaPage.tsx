import { useEffect, useState } from 'react';
import { usePosJagaStore } from '../../store/posJagaStore';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import PosJagaQRCode from '../../components/gatepass/PosJagaQRCode';
import { ICONS } from '../../icons';
import type { PosJaga } from '../../types';

export default function PosJagaPage() {
  const posJagaList = usePosJagaStore(s => s.posJagaList);
  const fetchPosJaga = usePosJagaStore(s => s.fetchPosJaga);
  const createPosJaga = usePosJagaStore(s => s.createPosJaga);
  const setActive = usePosJagaStore(s => s.setActive);
  const deletePosJaga = usePosJagaStore(s => s.deletePosJaga);
  const renamePosJaga = usePosJagaStore(s => s.renamePosJaga);
  const rotateQr = usePosJagaStore(s => s.rotateQr);

  // create form
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR modal
  const [qrTarget, setQrTarget] = useState<PosJaga | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  // rename modal
  const [renameTarget, setRenameTarget] = useState<PosJaga | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // delete modal
  const [deleteTarget, setDeleteTarget] = useState<PosJaga | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void fetchPosJaga();
  }, [fetchPosJaga]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setError('Nama pos jaga wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createPosJaga(nama.trim());
      setNama('');
      setQrTarget(created);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Gagal membuat pos jaga');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRename = (pos: PosJaga) => {
    setRenameTarget(pos);
    setRenameVal(pos.nama);
    setRenameError(null);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    if (!renameVal.trim()) {
      setRenameError('Nama tidak boleh kosong.');
      return;
    }
    setIsRenaming(true);
    setRenameError(null);
    try {
      await renamePosJaga(renameTarget.id, renameVal.trim());
      if (qrTarget?.id === renameTarget.id) {
        setQrTarget((prev) => prev ? { ...prev, nama: renameVal.trim() } : prev);
      }
      setRenameTarget(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Gagal mengubah nama');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePosJaga(deleteTarget.id);
      if (qrTarget?.id === deleteTarget.id) setQrTarget(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pos jaga');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRotateQr = async () => {
    if (!qrTarget) return;
    setIsRotating(true);
    try {
      const updated = await rotateQr(qrTarget.id);
      setQrTarget(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti QR');
    } finally {
      setIsRotating(false);
    }
  };

  const activeCount = posJagaList.filter(p => p.is_active).length;

  return (
    <DashboardLayout title="Kelola Pos Jaga">
      <div className="space-y-6">
        <PageHeader
          title="Kelola Pos Jaga"
          subtitle="Tambah, aktifkan/nonaktifkan, ubah nama, hapus, dan rotasi QR pos jaga untuk absensi personel."
          meta={
            <>
              <span>{posJagaList.length} pos terdaftar</span>
              <span>{activeCount} aktif</span>
            </>
          }
        />

        {/* Global error */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-accent-red/30 bg-gradient-to-r from-accent-red/10 to-rose-500/5 px-4 py-3 text-sm text-accent-red">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg bg-accent-red/15">
              <ICONS.AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-accent-red/60 hover:text-accent-red transition-colors" aria-label="Tutup">
              <ICONS.X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form tambah pos jaga */}
        <div className="app-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <ICONS.Plus className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Tambah Pos Jaga Baru</h2>
              <p className="text-xs text-text-muted">Masukkan nama pos lalu klik Tambah untuk membuat QR statis.</p>
            </div>
          </div>
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Nama Pos"
                placeholder="Mis: Pos Jaga Utara"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="primary" isLoading={loading}>
              Tambah
            </Button>
          </form>
        </div>

        {/* Daftar pos jaga */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-gold/15 text-accent-gold">
              <ICONS.MapPin className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Daftar Pos Jaga</h2>
              <p className="text-xs text-text-muted">{posJagaList.length} pos terdaftar · {activeCount} sedang aktif</p>
            </div>
          </div>

          {posJagaList.length === 0 ? (
            <EmptyState
              title="Belum ada pos jaga"
              description="Tambahkan pos jaga baru di atas. Setiap pos akan mendapat QR statis yang bisa dicetak dan dipasang di lokasi."
              className="py-12"
            />
          ) : (
            <div className="space-y-2.5">
              {posJagaList.map((pos) => (
                <div
                  key={pos.id}
                  className="group app-card flex items-center justify-between gap-4 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${pos.is_active ? 'bg-gradient-to-br from-success/20 to-emerald-600/10 text-success' : 'bg-surface/40 text-text-muted'}`}>
                      <ICONS.MapPin className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary truncate">{pos.nama}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pos.is_active ? 'bg-success/10 text-success' : 'bg-accent-red/10 text-accent-red'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${pos.is_active ? 'bg-success' : 'bg-accent-red'}`} aria-hidden="true" />
                          {pos.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          Dibuat {new Date(pos.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setQrTarget(pos)}
                    >
                      <span className="flex items-center gap-1.5">
                        <ICONS.QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                        Lihat QR
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRename(pos)}
                    >
                      <span className="flex items-center gap-1.5">
                        <ICONS.Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Ubah Nama
                      </span>
                    </Button>
                    <Button
                      variant={pos.is_active ? 'ghost' : 'outline'}
                      size="sm"
                      onClick={() => void setActive(pos.id, !pos.is_active)}
                    >
                      {pos.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget(pos)}
                    >
                      <span className="flex items-center gap-1.5">
                        <ICONS.Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Hapus
                      </span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal QR + Ganti QR */}
      <Modal
        isOpen={!!qrTarget}
        onClose={() => setQrTarget(null)}
        title={qrTarget ? `QR — ${qrTarget.nama}` : ''}
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              isLoading={isRotating}
              onClick={() => void handleRotateQr()}
            >
              <span className="flex items-center gap-1.5">
                <ICONS.RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Ganti QR
              </span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQrTarget(null)}>Tutup</Button>
          </div>
        }
      >
        {qrTarget && (
          <div className="space-y-3">
            <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/10 px-3 py-2 text-xs text-accent-gold">
              <span className="inline-flex items-center gap-1.5">
                <ICONS.AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Klik <strong>Ganti QR</strong> untuk merotasi token. QR lama tidak berlaku setelah diganti, cetak ulang dan pasang di pos.
              </span>
            </div>
            <PosJagaQRCode posJaga={qrTarget} />
          </div>
        )}
      </Modal>

      {/* Modal Ubah Nama */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Ubah Nama Pos Jaga"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Batal</Button>
            <Button onClick={() => void handleRename()} isLoading={isRenaming}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-3">
          {renameError && (
            <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
              {renameError}
            </div>
          )}
          <Input
            label="Nama Pos Baru"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            placeholder="Mis: Pos Jaga Selatan"
            required
          />
        </div>
      </Modal>

      {/* Modal Hapus */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Pos Jaga"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={isDeleting}>
              Ya, Hapus
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-accent-red/20 bg-accent-red/5 p-4">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-red/20 to-rose-500/10 text-accent-red">
              <ICONS.MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-text-primary">{deleteTarget?.nama}</p>
              <p className="text-xs text-text-muted">
                {deleteTarget?.is_active ? 'Sedang aktif' : 'Nonaktif'}
              </p>
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Pos jaga ini akan dihapus permanen beserta QR-nya. QR ini tidak bisa digunakan lagi. Tindakan ini <span className="font-semibold text-accent-red">tidak dapat dibatalkan</span>.
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
