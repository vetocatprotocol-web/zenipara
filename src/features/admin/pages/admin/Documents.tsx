import { useState, useEffect, useCallback } from 'react';
import { Layers3, Search, FolderOpen, Download, Upload, FileText, RotateCcw } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Input from '../../components/common/Input';
import PageHeader from '../../components/ui/PageHeader';
import { useUIStore } from '../../store/uiStore';
import { fetchDocuments, insertDocument, deleteDocument } from '../../lib/api/documents';
import { handleError } from '../../lib/handleError';
import type { Document } from '../../types';
import { useAuthStore } from '../../store/authStore';

export default function Documents() {
  const { showNotification } = useUIStore();
  const { user } = useAuthStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<{
    nama: string;
    kategori: string;
    file_url: string;
    satuan: string;
    file_size: string;
  }>({ nama: '', kategori: '', file_url: '', satuan: '', file_size: '' });

  const fetchDocs = useCallback(async () => {
    if (!user) {
      setDocs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchDocuments(user.id, user.role);
      setDocs(data);
    } catch (err) {
      showNotification(handleError(err, 'Gagal memuat dokumen'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification, user]);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  const categories = [...new Set(docs.map((d) => d.kategori).filter(Boolean))] as string[];

  const filtered = docs.filter((d) => {
    const matchSearch = !search || d.nama.toLowerCase().includes(search.toLowerCase());
    const matchKat = !filterKategori || d.kategori === filterKategori;
    return matchSearch && matchKat;
  });

  const summary = {
    total: docs.length,
    visible: filtered.length,
    categorized: docs.filter((d) => Boolean(d.kategori)).length,
    scopedToSatuan: docs.filter((d) => Boolean(d.satuan)).length,
  };
  const hasFilters = search.trim().length > 0 || filterKategori !== '';

  const handleCreate = async () => {
    if (!form.nama || !form.file_url) {
      showNotification('Nama dan URL file wajib diisi', 'error');
      return;
    }
    if (!user) {
      showNotification('User tidak ditemukan', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await insertDocument(user.id, user.role, {
        nama: form.nama,
        kategori: form.kategori || null,
        file_url: form.file_url,
        satuan: form.satuan || null,
        file_size: form.file_size ? Number(form.file_size) : null,
      });
      showNotification('Dokumen berhasil ditambahkan', 'success');
      setShowCreate(false);
      setForm({ nama: '', kategori: '', file_url: '', satuan: '', file_size: '' });
      await fetchDocs();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!user) {
      showNotification('User tidak ditemukan', 'error');
      return;
    }
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || !user) return;
    setIsDeleting(true);
    try {
      await deleteDocument(user.id, user.role, confirmDeleteId);
      showNotification('Dokumen dihapus', 'success');
      await fetchDocs();
    } catch {
      showNotification('Gagal menghapus dokumen', 'error');
    } finally {
      setConfirmDeleteId(null);
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout title="Arsip Dokumen">
      <div className="space-y-5 animate-fade-up">
        <PageHeader
          title="Arsip Dokumen"
          subtitle="Kelola dokumen satuan, kategori, dan metadata unggahan dalam satu panel terpusat."
          breadcrumbs={[
            { label: 'Admin', href: '#/admin' },
            { label: 'Arsip Dokumen' },
          ]}
          meta={
            <>
              <span>Total dokumen: {summary.total}</span>
              <span>{summary.visible} data terlihat</span>
            </>
          }
          actions={<Button onClick={() => setShowCreate(true)} leftIcon={<Upload className="h-4 w-4" />}>Tambah Dokumen</Button>}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Dokumen</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{summary.total}</p>
            <p className="mt-1 text-xs text-text-muted">Seluruh arsip tersimpan</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Berkategori</p>
            <p className="mt-2 text-2xl font-bold text-primary">{summary.categorized}</p>
            <p className="mt-1 text-xs text-text-muted">Sudah tertata per kategori</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Per Satuan</p>
            <p className="mt-2 text-2xl font-bold text-success">{summary.scopedToSatuan}</p>
            <p className="mt-1 text-xs text-text-muted">Dokumen dengan scope unit</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Hasil Filter</p>
            <p className="mt-2 text-2xl font-bold text-accent-gold">{summary.visible}</p>
            <p className="mt-1 text-xs text-text-muted">Data aktif pada tampilan</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="app-card flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <Layers3 className="h-3.5 w-3.5" />
              {summary.visible} terlihat
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <FolderOpen className="h-3.5 w-3.5" />
              Kategori: {filterKategori || 'Semua'}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="text"
              placeholder="Cari nama dokumen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="flex-1"
            />
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="form-control sm:w-64"
            >
              <option value="">Semua Kategori</option>
              {categories.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setFilterKategori('');
                }}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <Table<Document>
          columns={[
            {
              key: 'nama',
              header: 'Nama Dokumen',
              render: (d) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface/70 bg-surface/20 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{d.nama}</p>
                    {d.kategori && <p className="text-xs text-text-muted">{d.kategori}</p>}
                  </div>
                </div>
              ),
            },
            { key: 'satuan', header: 'Satuan', render: (d) => d.satuan ?? '—' },
            { key: 'file_size', header: 'Ukuran', render: (d) => formatFileSize(d.file_size) },
            {
              key: 'uploader',
              header: 'Diunggah oleh',
              render: (d) => d.uploader?.nama ?? '—',
            },
            {
              key: 'created_at',
              header: 'Tanggal',
              render: (d) => new Date(d.created_at).toLocaleDateString('id-ID'),
            },
            {
              key: 'actions',
              header: 'Aksi',
              render: (d) => (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(d.file_url, '_blank', 'noopener,noreferrer')}
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                  >
                    Unduh
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(d.id)}>
                    Hapus
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(d) => d.id}
          isLoading={isLoading}
          caption="Tabel arsip dokumen berdasarkan filter nama dan kategori"
          emptyMessage="Belum ada dokumen"
        />

        {!isLoading && filtered.length === 0 && docs.length > 0 && (
          <div className="app-card p-4 text-sm text-text-muted">
            Tidak ada dokumen yang cocok dengan filter aktif. Coba reset pencarian atau pilih kategori lain.
          </div>
        )}
      </div>

      {/* Add Document Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tambah Dokumen"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Dokumen *"
            type="text"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            required
          />
          <Input
            label="Kategori"
            type="text"
            placeholder="SK, SOP, Laporan, dll."
            value={form.kategori}
            onChange={(e) => setForm({ ...form, kategori: e.target.value })}
          />
          <Input
            label="URL File *"
            type="url"
            placeholder="https://..."
            value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            required
            helpText="Link dari Supabase Storage atau URL eksternal"
          />
          <Input
            label="Satuan"
            type="text"
            value={form.satuan}
            onChange={(e) => setForm({ ...form, satuan: e.target.value })}
          />
          <Input
            label="Ukuran File (bytes)"
            type="number"
            min="0"
            value={form.file_size}
            onChange={(e) => setForm({ ...form, file_size: e.target.value })}
          />
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!isDeleting) setConfirmDeleteId(null); }}
        onConfirm={() => { void handleConfirmDelete(); }}
        title="Hapus Dokumen"
        message="Dokumen ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        isConfirming={isDeleting}
      />
    </DashboardLayout>
  );
}
