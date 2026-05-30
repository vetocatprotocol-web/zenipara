import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Shield, MapPin, UsersRound, Layers3, ImageIcon, ExternalLink, CircleDot, RotateCcw } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Table from '../../components/ui/Table';
import Badge from '../../components/common/Badge';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { createSatuan, deleteSatuan, fetchSatuans, updateSatuan } from '../../lib/api/satuans';
import type { Satuan } from '../../types';

const EMPTY_FORM = {
  nama: '',
  kode_satuan: '',
  tingkat: '' as Satuan['tingkat'] | '',
  logo_url: '',
  is_active: true,
};

const TINGKAT_OPTIONS: Array<{ value: Satuan['tingkat']; label: string }> = [
  { value: 'battalion', label: 'Battalion' },
  { value: 'company', label: 'Company' },
  { value: 'squad', label: 'Squad' },
  { value: 'detachment', label: 'Detachment' },
];

const TINGKAT_LABEL: Record<NonNullable<Satuan['tingkat']>, string> = {
  battalion: 'Battalion',
  company: 'Company',
  squad: 'Squad',
  detachment: 'Detachment',
};

type StatusFilter = 'all' | 'active' | 'inactive';

export default function SatuanManagement() {
  const { showNotification } = useUIStore();
  const { user } = useAuthStore();

  const [satuans, setSatuans] = useState<Satuan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Satuan | null>(null);
  const [selected, setSelected] = useState<Satuan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadSatuans = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSatuans(true);
      setSatuans(data);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Gagal memuat data satuan', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadSatuans();
  }, [loadSatuans]);

  const summary = useMemo(() => {
    const active = satuans.filter((item) => item.is_active).length;
    const inactive = satuans.length - active;
    const withLogo = satuans.filter((item) => Boolean(item.logo_url)).length;
    return {
      total: satuans.length,
      active,
      inactive,
      withLogo,
    };
  }, [satuans]);

  const filtered = useMemo(() => {
    const byStatus = satuans.filter((item) => {
      if (statusFilter === 'active') return item.is_active;
      if (statusFilter === 'inactive') return !item.is_active;
      return true;
    });

    const query = search.trim().toLowerCase();
    if (!query) return byStatus;
    return byStatus.filter((item) => {
      return [item.nama, item.kode_satuan, item.tingkat ?? '', item.logo_url ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [search, satuans, statusFilter]);
  const hasFilters = search.trim().length > 0 || statusFilter !== 'all';

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (satuan: Satuan) => {
    setEditing(satuan);
    setForm({
      nama: satuan.nama,
      kode_satuan: satuan.kode_satuan,
      tingkat: satuan.tingkat ?? '',
      logo_url: satuan.logo_url ?? '',
      is_active: satuan.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) {
      showNotification('Nama satuan wajib diisi', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateSatuan(editing.id, {
          nama: form.nama,
          kode_satuan: form.kode_satuan,
          tingkat: form.tingkat || null,
          logo_url: form.logo_url || null,
          is_active: form.is_active,
        });
        showNotification('Satuan berhasil diperbarui', 'success');
      } else {
        await createSatuan({
          nama: form.nama,
          kode_satuan: form.kode_satuan,
          tingkat: form.tingkat || null,
          logo_url: form.logo_url || null,
          is_active: form.is_active,
          created_by: user?.id ?? null,
        });
        showNotification('Satuan berhasil ditambahkan', 'success');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await loadSatuans();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Gagal menyimpan satuan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (satuan: Satuan) => {
    setSelected(satuan);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteSatuan(selected.id);
      showNotification('Satuan berhasil dihapus', 'success');
      setShowDelete(false);
      setSelected(null);
      await loadSatuans();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Gagal menghapus satuan', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (satuan: Satuan) => {
    setUpdatingId(satuan.id);
    try {
      await updateSatuan(satuan.id, {
        is_active: !satuan.is_active,
      });
      showNotification(
        satuan.is_active ? 'Satuan dinonaktifkan' : 'Satuan diaktifkan',
        'success',
      );
      await loadSatuans();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Gagal memperbarui status satuan', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout title="Manajemen Satuan">
      <div className="space-y-5 animate-fade-up">
        <PageHeader
          title="Manajemen Satuan"
          subtitle="Kelola master unit untuk mendukung multi-satuan tanpa memutus data legacy."
          breadcrumbs={[
            { label: 'Admin', href: '#/admin' },
            { label: 'Manajemen Satuan' },
          ]}
          meta={
            <>
              <span>Total {summary.total} satuan</span>
              <span>{summary.active} aktif</span>
              <span>{summary.inactive} nonaktif</span>
            </>
          }
          actions={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Tambah Satuan
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Satuan</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{summary.total}</p>
            <p className="mt-1 text-xs text-text-muted">Semua unit terdaftar</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Aktif</p>
            <p className="mt-2 text-2xl font-bold text-success">{summary.active}</p>
            <p className="mt-1 text-xs text-text-muted">Dapat digunakan operasional</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Nonaktif</p>
            <p className="mt-2 text-2xl font-bold text-accent-red">{summary.inactive}</p>
            <p className="mt-1 text-xs text-text-muted">Perlu review jika tidak terpakai</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Dengan Logo</p>
            <p className="mt-2 text-2xl font-bold text-primary">{summary.withLogo}</p>
            <p className="mt-1 text-xs text-text-muted">Kesiapan branding unit</p>
          </div>
        </div>

        <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Input
            type="text"
            placeholder="Cari nama, kode, atau tingkat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <div className="inline-flex rounded-xl border border-surface/70 bg-surface/20 p-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-2.5 py-1.5 transition ${statusFilter === 'all' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`rounded-lg px-2.5 py-1.5 transition ${statusFilter === 'active' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`rounded-lg px-2.5 py-1.5 transition ${statusFilter === 'inactive' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >
                Nonaktif
              </button>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <UsersRound className="h-3.5 w-3.5" />
              Master tenant
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <Shield className="h-3.5 w-3.5" />
              RLS enabled
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              <Layers3 className="h-3.5 w-3.5" />
              {filtered.length} terlihat
            </span>
            {hasFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <Table<Satuan>
          columns={[
            {
              key: 'nama',
              header: 'Nama Satuan',
              render: (item) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface/70 bg-surface/20 text-xs font-bold text-text-primary">
                    {item.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-text-primary">{item.nama}</div>
                    <div className="text-xs text-text-muted">{item.kode_satuan}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'tingkat',
              header: 'Tingkat',
              render: (item) => item.tingkat ? <Badge variant="info">{TINGKAT_LABEL[item.tingkat]}</Badge> : '—',
            },
            {
              key: 'logo_url',
              header: 'Logo',
              render: (item) => item.logo_url ? (
                <a href={item.logo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Lihat
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : '—',
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => item.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>,
            },
            {
              key: 'created_at',
              header: 'Dibuat',
              render: (item) => new Date(item.created_at).toLocaleDateString('id-ID'),
            },
            {
              key: 'actions',
              header: 'Aksi',
              render: (item) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={item.is_active ? 'outline' : 'secondary'}
                    leftIcon={<CircleDot className="h-3.5 w-3.5" />}
                    onClick={() => handleToggleActive(item)}
                    isLoading={updatingId === item.id}
                  >
                    {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button size="sm" variant="outline" leftIcon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => askDelete(item)}>
                    Hapus
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          caption="Tabel master satuan untuk manajemen unit organisasi"
          emptyMessage="Belum ada data satuan"
        />

        {!isLoading && filtered.length === 0 && satuans.length > 0 && (
          <div className="app-card p-4 text-sm text-text-muted">
            Tidak ada data yang cocok dengan filter saat ini. Coba ganti kata kunci atau ubah status filter.
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Satuan' : 'Tambah Satuan'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSave} isLoading={saving}>{editing ? 'Simpan Perubahan' : 'Tambah'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Satuan *"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            required
            leftIcon={<MapPin className="h-4 w-4" />}
          />
          <Input
            label="Kode Satuan"
            value={form.kode_satuan}
            onChange={(e) => setForm({ ...form, kode_satuan: e.target.value })}
            helpText="Akan digenerate otomatis dari nama jika dikosongkan"
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text-primary">Tingkat</span>
            <div className="relative">
              <select
                value={form.tingkat}
                onChange={(e) => setForm({ ...form, tingkat: e.target.value as Satuan['tingkat'] | '' })}
                className="form-control appearance-none pr-10"
              >
                <option value="">Pilih tingkat satuan</option>
                {TINGKAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <CircleDot className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            </div>
          </label>
          <Input
            label="URL Logo"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="https://..."
          />
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-surface accent-primary"
            />
            Satuan aktif
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Hapus Satuan"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Hapus</Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Yakin ingin menghapus satuan <span className="font-semibold text-text-primary">{selected?.nama}</span>? Pastikan tidak ada data aktif yang masih menggunakan satuan ini.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
