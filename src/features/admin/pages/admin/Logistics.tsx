import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, ClipboardList, Search, Plus, Layers3, RotateCcw } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useLogisticsRequests } from '../../hooks/useLogisticsRequests';
import { supabase } from '../../lib/supabase';
import { canWrite, getOperationalRoleLabel } from '../../lib/rolePermissions';
import type { LogisticsItem, LogisticsRequest } from '../../types';

export default function Logistics() {
  const { showNotification } = useUIStore();
  const { user } = useAuthStore();
  const { requests, reviewRequest } = useLogisticsRequests();
  const canWriteLogistics = canWrite(user, 'logistics');
  const [items, setItems] = useState<LogisticsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<LogisticsRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [form, setForm] = useState<Partial<LogisticsItem>>({ nama_item: '', jumlah: 0, kondisi: 'baik' });
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests'>('inventory');
  const [kondisiFilter, setKondisiFilter] = useState<'all' | LogisticsItem['kondisi']>('all');

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const summary = useMemo(() => {
    const total = items.length;
    const baik = items.filter((item) => item.kondisi === 'baik').length;
    const perluPerhatian = items.filter((item) => item.kondisi !== 'baik').length;
    const approvedRequests = requests.filter((r) => r.status === 'approved').length;
    return {
      total,
      baik,
      perluPerhatian,
      pending: pendingRequests.length,
      approvedRequests,
    };
  }, [items, pendingRequests.length, requests]);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('api_get_logistics_items');
    setItems((data as LogisticsItem[]) ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const filtered = items.filter((i) => {
    const bySearch = !search || i.nama_item.toLowerCase().includes(search.toLowerCase());
    const byKondisi = kondisiFilter === 'all' || i.kondisi === kondisiFilter;
    return bySearch && byKondisi;
  });
  const hasInventoryFilters = search.trim().length > 0 || kondisiFilter !== 'all';

  const handleCreate = async () => {
    if (!form.nama_item) { showNotification('Nama item wajib diisi', 'error'); return; }
    if (!user?.id || !user.role) { showNotification('Sesi tidak valid', 'error'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('api_insert_logistics_item', {
        p_caller_id: user.id,
        p_caller_role: user.role,
        p_nama_item: form.nama_item,
        p_kategori: form.kategori ?? null,
        p_jumlah: form.jumlah ?? 0,
        p_satuan_item: form.satuan_item ?? null,
        p_kondisi: form.kondisi ?? 'baik',
        p_lokasi: form.lokasi ?? null,
        p_catatan: form.catatan ?? null,
      });
      if (error) throw error;
      showNotification('Item berhasil ditambahkan', 'success');
      setShowCreate(false);
      setForm({ nama_item: '', jumlah: 0, kondisi: 'baik' });
      await fetchItems();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async (
    id: string,
    status: 'approved' | 'rejected',
    note?: string,
  ) => {
    setReviewingId(id);
    try {
      await reviewRequest(id, status, note);
      showNotification(
        status === 'approved' ? 'Permintaan disetujui' : 'Permintaan ditolak',
        status === 'approved' ? 'success' : 'info',
      );
      setSelectedReq(null);
      setAdminNote('');
    } catch {
      showNotification('Gagal memproses permintaan', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout title="Manajemen Logistik">
      <div className="space-y-5 animate-fade-up">
        <PageHeader
          title="Manajemen Logistik"
          subtitle="Inventaris perlengkapan dan permintaan dari Komandan dikelola di sini."
          breadcrumbs={[
            { label: 'Admin', href: '#/admin' },
            { label: 'Manajemen Logistik' },
          ]}
          meta={
            <>
              <span>Total item: {summary.total}</span>
              <span>Pending request: {summary.pending}</span>
              <span>{filtered.length} data terlihat</span>
            </>
          }
          actions={
            canWriteLogistics
              ? <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Tambah Item</Button>
              : <span className="text-xs text-text-muted px-3 py-2 rounded-xl border border-surface/70 bg-surface/20">{getOperationalRoleLabel(user)} — hanya baca</span>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Inventaris</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{summary.total}</p>
            <p className="mt-1 text-xs text-text-muted">Semua item logistik</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Kondisi Baik</p>
            <p className="mt-2 text-2xl font-bold text-success">{summary.baik}</p>
            <p className="mt-1 text-xs text-text-muted">Siap operasional</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Perlu Perhatian</p>
            <p className="mt-2 text-2xl font-bold text-accent-gold">{summary.perluPerhatian}</p>
            <p className="mt-1 text-xs text-text-muted">Rusak ringan/berat</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Pending Request</p>
            <p className="mt-2 text-2xl font-bold text-accent-red">{summary.pending}</p>
            <p className="mt-1 text-xs text-text-muted">Menunggu review admin</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Request Approved</p>
            <p className="mt-2 text-2xl font-bold text-primary">{summary.approvedRequests}</p>
            <p className="mt-1 text-xs text-text-muted">Sudah diproses</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="app-card flex items-center gap-1 p-1.5 sm:w-fit">
          {([
            { key: 'inventory', label: 'Inventaris', icon: <Package className="h-4 w-4" aria-hidden="true" /> },
            { key: 'requests',  label: `Permintaan${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`, icon: <ClipboardList className="h-4 w-4" aria-hidden="true" /> },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.key === 'requests' && pendingRequests.length > 0 && activeTab !== 'requests' && (
                <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'inventory' && (
          <>
            <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
              <Input
                type="text"
                placeholder="Cari item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                className="flex-1"
              />
              <div className="inline-flex rounded-xl border border-surface/70 bg-surface/20 p-1">
                <button
                  type="button"
                  onClick={() => setKondisiFilter('all')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition ${kondisiFilter === 'all' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setKondisiFilter('baik')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition ${kondisiFilter === 'baik' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Baik
                </button>
                <button
                  type="button"
                  onClick={() => setKondisiFilter('rusak_ringan')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition ${kondisiFilter === 'rusak_ringan' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Rusak Ringan
                </button>
                <button
                  type="button"
                  onClick={() => setKondisiFilter('rusak_berat')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition ${kondisiFilter === 'rusak_berat' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Rusak Berat
                </button>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1 text-xs text-text-muted">
                <Layers3 className="h-3.5 w-3.5" />
                {filtered.length} terlihat
              </span>
              {hasInventoryFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setKondisiFilter('all');
                  }}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Reset
                </Button>
              )}
            </div>

            <Table<LogisticsItem>
              columns={[
                {
                  key: 'nama_item',
                  header: 'Nama Item',
                  render: (i) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface/70 bg-surface/20 text-xs font-bold text-text-primary">
                        {i.nama_item.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-text-primary">{i.nama_item}</span>
                    </div>
                  ),
                },
                { key: 'kategori', header: 'Kategori', render: (i) => i.kategori ?? '—' },
                { key: 'jumlah', header: 'Jumlah', render: (i) => `${i.jumlah} ${i.satuan_item ?? ''}` },
                {
                  key: 'kondisi',
                  header: 'Kondisi',
                  render: (i) => i.kondisi ? (
                    <Badge variant={i.kondisi === 'baik' ? 'success' : i.kondisi === 'rusak_ringan' ? 'warning' : 'error'}>
                      {i.kondisi.replace('_', ' ')}
                    </Badge>
                  ) : '—',
                },
                { key: 'lokasi', header: 'Lokasi', render: (i) => i.lokasi ?? '—' },
              ]}
              data={filtered}
              keyExtractor={(i) => i.id}
              isLoading={isLoading}
              caption="Tabel inventaris logistik berdasarkan pencarian dan kondisi item"
              emptyMessage="Tidak ada item logistik"
            />

            {!isLoading && filtered.length === 0 && items.length > 0 && (
              <div className="app-card p-4 text-sm text-text-muted">
                Tidak ada item yang cocok dengan filter saat ini. Coba reset filter untuk melihat semua inventaris.
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
                title="Belum ada permintaan logistik"
                description="Permintaan dari Komandan akan muncul di sini untuk ditinjau."
              />
            ) : (
              requests.map((req) => {
                const statusMap = {
                  pending:  { variant: 'warning', label: 'Menunggu' },
                  approved: { variant: 'success', label: 'Disetujui' },
                  rejected: { variant: 'error',   label: 'Ditolak' },
                } as const;
                const s = statusMap[req.status];
                return (
                  <div key={req.id} className="app-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                            <Package className="h-4 w-4 text-text-muted" aria-hidden="true" />
                            {req.nama_item}
                          </span>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                        <p className="text-sm text-text-muted">
                          Jumlah: {req.jumlah} {req.satuan_item ?? 'unit'} ·
                          Satuan: {req.satuan} ·
                          Oleh: {req.requester?.nama ?? '—'}
                        </p>
                        <p className="text-sm text-text-muted mt-0.5 truncate">{req.alasan}</p>
                        {req.admin_note && (
                          <p className="mt-1 text-xs text-text-muted italic">Catatan: {req.admin_note}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs text-text-muted">
                          {new Date(req.created_at).toLocaleDateString('id-ID')}
                        </span>
                        {req.status === 'pending' && canWriteLogistics && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              isLoading={reviewingId === req.id}
                              onClick={() => { setSelectedReq(req); setAdminNote(''); }}
                            >
                              Tinjau
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Review Request Modal */}
      <Modal
        isOpen={!!selectedReq}
        onClose={() => { setSelectedReq(null); setAdminNote(''); }}
        title="Tinjau Permintaan Logistik"
        size="md"
        footer={
          selectedReq ? (
            <>
              <Button variant="ghost" onClick={() => { setSelectedReq(null); setAdminNote(''); }}>Batal</Button>
              <Button
                variant="danger"
                isLoading={reviewingId === selectedReq.id}
                onClick={() => handleReview(selectedReq.id, 'rejected', adminNote)}
              >
                Tolak
              </Button>
              <Button
                isLoading={reviewingId === selectedReq.id}
                onClick={() => handleReview(selectedReq.id, 'approved', adminNote)}
              >
                ✓ Setujui
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedReq && (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface/70 bg-surface/20 p-4 space-y-2 text-sm">
              {[
                { label: 'Item', value: selectedReq.nama_item },
                { label: 'Jumlah', value: `${selectedReq.jumlah} ${selectedReq.satuan_item ?? 'unit'}` },
                { label: 'Satuan', value: selectedReq.satuan },
                { label: 'Diminta oleh', value: selectedReq.requester?.nama ?? '—' },
                { label: 'Alasan', value: selectedReq.alasan },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-text-primary font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-semibold text-text-primary">Catatan Admin (opsional)</label>
              <textarea
                className="form-control mt-1 min-h-20"
                rows={3}
                placeholder="Tuliskan catatan atau alasan keputusan..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tambah Item Logistik"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nama Item *" type="text" value={form.nama_item ?? ''} onChange={(e) => setForm({ ...form, nama_item: e.target.value })} required />
          <Input label="Kategori" type="text" value={form.kategori ?? ''} onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jumlah" type="number" min="0" value={String(form.jumlah ?? 0)} onChange={(e) => setForm({ ...form, jumlah: Number(e.target.value) })} />
            <Input label="Satuan" type="text" placeholder="pcs, unit, kg..." value={form.satuan_item ?? ''} onChange={(e) => setForm({ ...form, satuan_item: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-semibold text-text-primary">Kondisi</label>
            <select className="form-control mt-1" value={form.kondisi ?? 'baik'} onChange={(e) => setForm({ ...form, kondisi: e.target.value as LogisticsItem['kondisi'] })}>
              <option value="baik">Baik</option>
              <option value="rusak_ringan">Rusak Ringan</option>
              <option value="rusak_berat">Rusak Berat</option>
            </select>
          </div>
          <Input label="Lokasi" type="text" value={form.lokasi ?? ''} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} />
          <Input label="Catatan" type="text" value={form.catatan ?? ''} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
