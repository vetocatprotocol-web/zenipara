import { useState, useMemo } from 'react';
import { Megaphone, Pin, PinOff, Plus, Search, Edit2, Eye } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useUIStore } from '../../store/uiStore';
import { useDebounce } from '../../hooks/useDebounce';
import { getRoleDisplayLabel } from '../../lib/rolePermissions';
import type { Announcement, Role } from '../../types';

const ANNOUNCEMENT_TARGET_ROLES = ['admin', 'komandan', 'prajurit'] as const;
type AnnouncementTargetRole = (typeof ANNOUNCEMENT_TARGET_ROLES)[number];
type SortMode = 'terbaru' | 'terlama' | 'ber-pin-paling-banyak';

export default function Announcements() {
  const { announcements, isLoading, createAnnouncement, updateAnnouncement, deleteAnnouncement, togglePin } = useAnnouncements();
  const { showNotification } = useUIStore();

  // Search & Filter
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [sortMode, setSortMode] = useState<SortMode>('terbaru');
  const [filterOnlyPinned, setFilterOnlyPinned] = useState(false);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedForDetail, setSelectedForDetail] = useState<Announcement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    judul: '',
    isi: '',
    target_satuan: '',
    is_pinned: false,
    target_admin: false,
    target_komandan: false,
    target_prajurit: false,
  });

  // Filtered & sorted announcements
  const filtered = useMemo(() => {
    let result = announcements;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.judul.toLowerCase().includes(q) ||
        a.isi.toLowerCase().includes(q) ||
        (a.creator?.nama?.toLowerCase().includes(q) ?? false)
      );
    }

    // Pin filter
    if (filterOnlyPinned) {
      result = result.filter(a => a.is_pinned);
    }

    // Sort
    if (sortMode === 'terlama') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortMode === 'ber-pin-paling-banyak') {
      result.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    } else {
      // Default: terbaru
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [announcements, search, sortMode, filterOnlyPinned]);

  // Form handlers
  const resetForm = () => {
    setForm({ judul: '', isi: '', target_satuan: '', is_pinned: false, target_admin: false, target_komandan: false, target_prajurit: false });
    setEditingId(null);
  };

  const handleEditClick = (ann: Announcement) => {
    setForm({
      judul: ann.judul,
      isi: ann.isi,
      target_satuan: ann.target_satuan ?? '',
      is_pinned: ann.is_pinned,
      target_admin: ann.target_role?.includes('admin') ?? false,
      target_komandan: ann.target_role?.includes('komandan') ?? false,
      target_prajurit: ann.target_role?.includes('prajurit') ?? false,
    });
    setEditingId(ann.id);
    setShowCreate(true);
  };

  const handleDetailClick = (ann: Announcement) => {
    setSelectedForDetail(ann);
    setShowDetail(true);
  };

  const handleCreate = async () => {
    if (!form.judul.trim() || !form.isi.trim()) {
      showNotification('Judul dan isi pengumuman wajib diisi', 'error');
      return;
    }
    const targetRole: Role[] = [];
    if (form.target_admin) targetRole.push('admin');
    if (form.target_komandan) targetRole.push('komandan');
    if (form.target_prajurit) targetRole.push('prajurit');

    setIsSaving(true);
    try {
      if (editingId) {
        // Update existing announcement
        await updateAnnouncement(editingId, {
          judul: form.judul,
          isi: form.isi,
          target_role: targetRole.length > 0 ? targetRole : undefined,
          target_satuan: form.target_satuan || undefined,
          is_pinned: form.is_pinned,
        });
        showNotification('Pengumuman berhasil diperbarui', 'success');
      } else {
        // Create new announcement
        await createAnnouncement({
          judul: form.judul,
          isi: form.isi,
          target_role: targetRole.length > 0 ? targetRole : undefined,
          target_satuan: form.target_satuan || undefined,
          is_pinned: form.is_pinned,
        });
        showNotification('Pengumuman berhasil diterbitkan', 'success');
      }
      setShowCreate(false);
      resetForm();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteAnnouncement(confirmDeleteId);
      showNotification('Pengumuman dihapus', 'success');
      setConfirmDeleteId(null);
    } catch {
      showNotification('Gagal menghapus', 'error');
      setConfirmDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async (ann: Announcement) => {
    try {
      await togglePin(ann.id, ann.is_pinned);
      showNotification(ann.is_pinned ? 'Pengumuman di-unpin' : 'Pengumuman di-pin', 'info');
    } catch {
      showNotification('Gagal mengubah pin', 'error');
    }
  };

  return (
    <DashboardLayout title="Manajemen Pengumuman">
      <div className="space-y-5">
        <PageHeader
          title="Manajemen Pengumuman"
          subtitle="Publikasikan informasi resmi berdasarkan role dan satuan dengan prioritas pin."
          meta={<span>Total pengumuman: {announcements.length} (ditampilkan: {filtered.length})</span>}
          actions={<Button onClick={() => { resetForm(); setShowCreate(true); }} leftIcon={<Plus className="h-4 w-4" />}>Buat Pengumuman</Button>}
        />

        {/* Search & Filter Bar */}
        <div className="app-card p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="Cari pengumuman..."
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              className="flex-1"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="form-control"
            >
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
              <option value="ber-pin-paling-banyak">Ber-Pin</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterOnlyPinned}
              onChange={(e) => setFilterOnlyPinned(e.target.checked)}
              className="rounded border-surface text-primary"
            />
            <span className="text-sm text-text-muted">Hanya pengumuman ber-pin</span>
          </label>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Memuat pengumuman..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" aria-hidden="true" />}
            title={search || filterOnlyPinned ? 'Tidak ada pengumuman' : 'Belum ada pengumuman'}
            description={search || filterOnlyPinned ? 'Coba ubah filter atau cari dengan kata kunci lain.' : 'Buat pengumuman untuk menginformasikan hal penting kepada personel.'}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((ann) => (
              <div
                key={ann.id}
                className={`app-card p-5 ${ann.is_pinned ? 'border-accent-gold/50 bg-accent-gold/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-xs text-accent-gold font-medium">
                          <Pin className="h-3 w-3" aria-hidden="true" /> Disematkan
                        </span>
                      )}
                      <h3 className="font-semibold text-text-primary">{ann.judul}</h3>
                    </div>
                    <p className="text-sm text-text-muted line-clamp-2">{ann.isi}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-text-muted">
                        {new Date(ann.created_at).toLocaleString('id-ID')}
                      </span>
                      {ann.created_by && (
                        <span className="text-xs text-text-muted">oleh {ann.creator?.nama ?? 'Admin'}</span>
                      )}
                      {ann.target_role && ann.target_role.length > 0 && (
                        <div className="flex gap-1">
                          {ann.target_role.map((r) => (
                            <Badge key={r} variant="info" size="sm">{getRoleDisplayLabel(r)}</Badge>
                          ))}
                        </div>
                      )}
                      {ann.target_satuan && (
                        <Badge variant="neutral" size="sm">{ann.target_satuan}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDetailClick(ann)}
                      title="Lihat Detail"
                      aria-label="Lihat detail pengumuman"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEditClick(ann)}
                      title="Edit"
                      aria-label="Edit pengumuman"
                    >
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePin(ann)}
                      title={ann.is_pinned ? 'Lepas Pin' : 'Sematkan'}
                      aria-label={ann.is_pinned ? 'Lepas pin pengumuman' : 'Sematkan pengumuman'}
                    >
                      {ann.is_pinned
                        ? <PinOff className="h-4 w-4" aria-hidden="true" />
                        : <Pin className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(ann.id)}>
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => {
          setShowDetail(false);
          setTimeout(() => setSelectedForDetail(null), 200);
        }}
        title="Detail Pengumuman"
        size="md"
      >
        {selectedForDetail && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{selectedForDetail.judul}</h3>
              <div className="text-sm text-text-muted mt-1 flex gap-2 flex-wrap">
                <span>{new Date(selectedForDetail.created_at).toLocaleString('id-ID')}</span>
                {selectedForDetail.creator && (
                  <span>oleh {selectedForDetail.creator.nama}</span>
                )}
              </div>
            </div>
            <div className="prose max-w-none">
              <p className="text-text-secondary whitespace-pre-line break-words">{selectedForDetail.isi}</p>
            </div>
            <div className="pt-3 border-t border-border-secondary flex flex-wrap gap-2">
              {selectedForDetail.target_role && selectedForDetail.target_role.length > 0 && (
                <div>
                  <span className="text-xs text-text-muted">Target Role: </span>
                  {selectedForDetail.target_role.map((r) => (
                    <Badge key={r} variant="info" size="sm">{getRoleDisplayLabel(r)}</Badge>
                  ))}
                </div>
              )}
              {selectedForDetail.target_satuan && (
                <div>
                  <Badge variant="neutral" size="sm">{selectedForDetail.target_satuan}</Badge>
                </div>
              )}
              {selectedForDetail.is_pinned && (
                <Badge variant="warning" size="sm">Disematkan</Badge>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setTimeout(() => resetForm(), 200);
        }}
        title={editingId ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Judul *"
            type="text"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            required
            placeholder="Masukkan judul pengumuman"
          />
          <div>
            <label className="text-sm font-semibold text-text-primary">Isi Pengumuman *</label>
            <textarea
              className="form-control mt-1 min-h-28"
              rows={5}
              placeholder="Tulis pengumuman di sini..."
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
            />
          </div>
          <Input
            label="Target Satuan (kosong = semua)"
            type="text"
            placeholder="Batalyon 1, Kompi A, dll."
            value={form.target_satuan}
            onChange={(e) => setForm({ ...form, target_satuan: e.target.value })}
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Target Role (kosong = semua)</p>
            <div className="flex gap-4">
              {ANNOUNCEMENT_TARGET_ROLES.map((r) => {
                const key = `target_${r}` as `target_${AnnouncementTargetRole}`;
                return (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="rounded border-surface text-primary focus:ring-primary/50"
                    />
                    <span className="text-sm text-text-muted">{getRoleDisplayLabel(r)}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
              className="rounded border-surface text-primary"
            />
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" /> Sematkan pengumuman ini
            </span>
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm(); }}>
              Batal
            </Button>
            <Button onClick={handleCreate} isLoading={isSaving}>
              {editingId ? 'Perbarui' : 'Terbitkan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!isDeleting) setConfirmDeleteId(null); }}
        onConfirm={() => { void handleConfirmDelete(); }}
        title="Hapus Pengumuman"
        message="Pengumuman ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        isConfirming={isDeleting}
      />
    </DashboardLayout>
  );
}
