import { useMemo, useState } from 'react';
import DashboardLayout from '@/features/shared/components/layout/DashboardLayout';
import PageHeader from '@/features/shared/components/ui/PageHeader';
import Button from '@/features/shared/components/common/Button';
import Modal from '@/features/shared/components/common/Modal';
import ConfirmModal from '@/features/shared/components/common/ConfirmModal';
import EmptyState from '@/features/shared/components/common/EmptyState';
import { CardListSkeleton } from '@/features/shared/components/common/Skeleton';
import Table from '@/features/shared/components/ui/Table';
import Badge from '@/features/shared/components/common/Badge';
import { useSprint } from '@/features/shared/hooks/useSprint';
import { useAuthStore } from '@/features/auth/authStore';
import { isRoleAdmin, isRoleKomandan } from '@/features/shared/lib/rolePermissions';
import { useUIStore } from '@/store/uiStore';
import UserSearchSelect from '@/features/shared/components/common/UserSearchSelect';
import type { Sprint, SprintPersonel, SprintStatus } from '@/types';

const STATUS_LABEL: Record<SprintStatus, string> = {
  draft: 'Draft',
  approved: 'Disetujui',
  active: 'Aktif',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

const STATUS_BADGE: Record<SprintStatus, 'neutral' | 'warning' | 'success' | 'info' | 'error'> = {
  draft: 'neutral',
  approved: 'warning',
  active: 'info',
  selesai: 'success',
  dibatalkan: 'error',
};

const defaultForm = {
  judul: '',
  dasar: '',
  tujuan: '',
  tempat_tujuan: '',
  tanggal_berangkat: '',
  tanggal_kembali: '',
};

export default function SprintPage() {
  const user = useAuthStore((s) => s.user);
  const { showNotification } = useUIStore();
  const { sprint, isLoading, error, createNewSprint, setStatus, removeSprint, refetch, getPersonel } = useSprint();

  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);
  const [detailPersonel, setDetailPersonel] = useState<SprintPersonel[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [personelRows, setPersonelRows] = useState<Array<{ userId: string; jabatan: string }>>([
    { userId: '', jabatan: 'anggota' },
  ]);

  const stats = useMemo(() => ({
    draft: sprint.filter((s) => s.status === 'draft').length,
    approved: sprint.filter((s) => s.status === 'approved').length,
    active: sprint.filter((s) => s.status === 'active').length,
  }), [sprint]);

  const canApprove = isRoleKomandan(user?.role) || isRoleAdmin(user?.role);

  const selectedPersonelRows = personelRows.filter((row) => row.userId);

  const resetCreateState = () => {
    setForm(defaultForm);
    setPersonelRows([{ userId: '', jabatan: 'anggota' }]);
  };

  const handleCreate = async () => {
    if (!form.judul.trim() || !form.tujuan.trim() || !form.tempat_tujuan.trim() || !form.tanggal_berangkat || !form.tanggal_kembali) {
      showNotification('Lengkapi seluruh field wajib sprint', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await createNewSprint({
        judul: form.judul,
        tujuan: form.tujuan,
        tempatTujuan: form.tempat_tujuan,
        tanggalBerangkat: form.tanggal_berangkat,
        tanggalKembali: form.tanggal_kembali,
        dasar: form.dasar || undefined,
        personelIds: selectedPersonelRows.map((row) => row.userId),
        jabatanIds: selectedPersonelRows.map((row) => row.jabatan || 'anggota'),
      });
      showNotification('Surat Perintah berhasil dibuat', 'success');
      setShowCreate(false);
      resetCreateState();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membuat sprint', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (item: Sprint, status: SprintStatus) => {
    try {
      await setStatus(item.id, status);
      showNotification(`Status sprint diubah menjadi ${STATUS_LABEL[status]}`, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengubah status sprint', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await removeSprint(confirmDeleteId);
      showNotification('Sprint dihapus', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menghapus sprint', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const openDetail = async (item: Sprint) => {
    setShowDetailId(item.id);
    setDetailLoading(true);
    try {
      const rows = await getPersonel(item.id);
      setDetailPersonel(rows);
    } catch (err) {
      setDetailPersonel([]);
      showNotification(err instanceof Error ? err.message : 'Gagal memuat detail personel sprint', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetailId(null);
    setDetailPersonel([]);
    setDetailLoading(false);
  };

  const addPersonelRow = () => {
    setPersonelRows((prev) => [...prev, { userId: '', jabatan: 'anggota' }]);
  };

  const updatePersonelRow = (index: number, patch: Partial<{ userId: string; jabatan: string }>) => {
    setPersonelRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removePersonelRow = (index: number) => {
    setPersonelRows((prev) => {
      if (prev.length <= 1) return [{ userId: '', jabatan: 'anggota' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <DashboardLayout title="Surat Perintah">
      <PageHeader
        title="Surat Perintah (Sprint)"
        subtitle="Digitalisasi penerbitan, persetujuan, dan tracking sprint satuan."
        meta={
          <>
            <span>Draft: {stats.draft}</span>
            <span>Disetujui: {stats.approved}</span>
            <span>Aktif: {stats.active}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => { void refetch(); }}>Muat Ulang</Button>
            <Button onClick={() => setShowCreate(true)}>+ Buat Sprint</Button>
          </>
        }
      />

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : error ? (
        <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</div>
      ) : sprint.length === 0 ? (
        <EmptyState title="Belum ada Surat Perintah" description="Buat sprint pertama untuk memulai alur penugasan dinas." />
      ) : (
        <Table<Sprint>
          columns={[
            { key: 'nomor_surat', header: 'Nomor Surat', render: (s) => <span className="text-xs font-mono text-text-muted">{s.nomor_surat}</span> },
            { key: 'judul', header: 'Judul', render: (s) => <span className="font-medium text-text-primary">{s.judul}</span> },
            { key: 'tujuan', header: 'Tujuan', render: (s) => s.tujuan },
            {
              key: 'tanggal',
              header: 'Periode',
              render: (s) => `${new Date(s.tanggal_berangkat).toLocaleDateString('id-ID')} - ${new Date(s.tanggal_kembali).toLocaleDateString('id-ID')}`,
            },
            { key: 'jumlah_personel', header: 'Personel', render: (s) => s.jumlah_personel },
            {
              key: 'status',
              header: 'Status',
              render: (s) => <Badge variant={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</Badge>,
            },
            {
              key: 'aksi',
              header: 'Aksi',
              render: (s) => (
                <div className="flex flex-wrap gap-1">
                  {canApprove && s.status === 'draft' && (
                    <Button size="sm" variant="ghost" onClick={() => { void handleUpdateStatus(s, 'approved'); }}>
                      Setujui
                    </Button>
                  )}
                  {s.status === 'approved' && (
                    <Button size="sm" variant="ghost" onClick={() => { void handleUpdateStatus(s, 'active'); }}>
                      Aktifkan
                    </Button>
                  )}
                  {s.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => { void handleUpdateStatus(s, 'selesai'); }}>
                      Selesaikan
                    </Button>
                  )}
                  {(s.status === 'draft' || s.status === 'approved' || s.status === 'active') && (
                    <Button size="sm" variant="ghost" onClick={() => { void handleUpdateStatus(s, 'dibatalkan'); }}>
                      Batalkan
                    </Button>
                  )}
                  {s.status === 'draft' && (
                    <Button size="sm" variant="danger" onClick={() => setConfirmDeleteId(s.id)}>
                      Hapus
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { void openDetail(s); }}>
                    Detail
                  </Button>
                </div>
              ),
            },
          ]}
          data={sprint}
          keyExtractor={(s) => s.id}
        />
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetCreateState();
        }}
        title="Buat Surat Perintah"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setShowCreate(false);
              resetCreateState();
            }}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-text">Judul *</label>
            <input className="input-field" value={form.judul} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))} />
          </div>
          <div>
            <label className="label-text">Dasar Perintah</label>
            <textarea className="input-field min-h-[72px] resize-none" value={form.dasar} onChange={(e) => setForm((f) => ({ ...f, dasar: e.target.value }))} />
          </div>
          <div>
            <label className="label-text">Tujuan *</label>
            <input className="input-field" value={form.tujuan} onChange={(e) => setForm((f) => ({ ...f, tujuan: e.target.value }))} />
          </div>
          <div>
            <label className="label-text">Tempat Tujuan *</label>
            <input className="input-field" value={form.tempat_tujuan} onChange={(e) => setForm((f) => ({ ...f, tempat_tujuan: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Tanggal Berangkat *</label>
              <input type="date" className="input-field" value={form.tanggal_berangkat} onChange={(e) => setForm((f) => ({ ...f, tanggal_berangkat: e.target.value }))} />
            </div>
            <div>
              <label className="label-text">Tanggal Kembali *</label>
              <input type="date" className="input-field" value={form.tanggal_kembali} onChange={(e) => setForm((f) => ({ ...f, tanggal_kembali: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3 border-t border-surface/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="label-text">Personel Terlibat (Opsional)</p>
                <p className="text-xs text-text-muted">Tambahkan personel dan peran dalam surat perintah.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addPersonelRow}>+ Personel</Button>
            </div>

            {personelRows.map((row, index) => (
              <div key={`personel-row-${index}`} className="rounded-xl border border-surface/60 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr,180px,96px]">
                  <UserSearchSelect
                    className="space-y-2"
                    value={row.userId}
                    onChange={(value) => updatePersonelRow(index, { userId: value })}
                    satuan={user?.satuan}
                    isActive
                    emptyLabel="Pilih personel..."
                    placeholder="Cari nama/NRP personel..."
                    pageSize={20}
                  />

                  <div>
                    <label className="label-text">Jabatan</label>
                    <input
                      className="input-field"
                      placeholder="Ketua / Anggota"
                      value={row.jabatan}
                      onChange={(e) => updatePersonelRow(index, { jabatan: e.target.value })}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button size="sm" variant="ghost" onClick={() => removePersonelRow(index)} className="w-full">
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailId !== null}
        onClose={closeDetail}
        title="Detail Personel Sprint"
        size="lg"
        footer={<Button variant="ghost" onClick={closeDetail}>Tutup</Button>}
      >
        {detailLoading ? (
          <CardListSkeleton count={2} />
        ) : detailPersonel.length === 0 ? (
          <EmptyState
            title="Belum ada personel"
            description="Sprint ini belum memiliki personel terdaftar atau data belum tersedia."
          />
        ) : (
          <div className="space-y-2">
            {detailPersonel.map((row) => (
              <div key={`${row.sprint_id}-${row.user_id}`} className="rounded-xl border border-surface/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{row.user_info?.nama ?? 'Personel'}</p>
                    <p className="text-xs text-text-muted">{row.user_info?.nrp ?? '-'}{row.user_info?.pangkat ? ` · ${row.user_info.pangkat}` : ''}</p>
                  </div>
                  <Badge variant="info">{row.jabatan_dalam_sprint ?? 'anggota'}</Badge>
                </div>
                {row.laporan_kembali && (
                  <p className="mt-2 text-xs text-text-muted">Laporan kembali: {row.laporan_kembali}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Sprint"
        message="Surat Perintah draft ini akan dihapus permanen. Lanjutkan?"
        confirmLabel="Hapus"
        variant="danger"
        isConfirming={isDeleting}
      />
    </DashboardLayout>
  );
}
