import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Award, FileText, Plus } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Badge from '../../components/common/Badge';
import UserSearchSelect from '../../components/common/UserSearchSelect';
import PageHeader from '../../components/ui/PageHeader';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { supabase } from '../../lib/supabase';
import type { DisciplineNote } from '../../types';

export default function Evaluation() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const [notes, setNotes] = useState<DisciplineNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    jenis: 'catatan' as 'peringatan' | 'penghargaan' | 'catatan',
    isi: '',
  });

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('api_get_discipline_notes', {
      p_filter_user_id: filterUserId || null,
      p_satuan_filter: user?.satuan ?? null,
    });
    setNotes((data as DisciplineNote[]) ?? []);
    setIsLoading(false);
  }, [filterUserId, user?.satuan]);

  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  const handleCreate = async () => {
    if (!form.user_id || !form.isi.trim()) {
      showNotification('Pilih personel dan isi catatan', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('api_insert_discipline_note', {
        p_caller_id: user?.id,
        p_caller_role: user?.role,
        p_user_id: form.user_id,
        p_jenis: form.jenis,
        p_isi: form.isi,
      });
      if (error) throw error;
      showNotification('Catatan berhasil ditambahkan', 'success');
      setShowCreate(false);
      setForm({ user_id: '', jenis: 'catatan', isi: '' });
      await fetchNotes();
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
    const { error } = await supabase.rpc('api_delete_discipline_note', {
      p_caller_id: user?.id,
      p_caller_role: user?.role,
      p_id: confirmDeleteId,
    });
    if (error) { showNotification('Gagal menghapus', 'error'); }
    else {
      showNotification('Catatan dihapus', 'success');
      await fetchNotes();
    }
    setConfirmDeleteId(null);
    setIsDeleting(false);
  };

  const jenisBadge = {
    peringatan: 'error' as const,
    penghargaan: 'success' as const,
    catatan: 'neutral' as const,
  };

  const jenisIcon = {
    peringatan: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
    penghargaan: <Award className="h-3.5 w-3.5" aria-hidden="true" />,
    catatan: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
  };

  return (
    <DashboardLayout title="Evaluasi & Catatan Disiplin">
      <div className="space-y-5">
        <PageHeader
          title="Evaluasi & Catatan Disiplin"
          subtitle="Catat evaluasi personel, filter berdasarkan prajurit, dan kelola histori disiplin."
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <UserSearchSelect
            className="flex-1"
            value={filterUserId}
            onChange={setFilterUserId}
            satuan={user?.satuan}
            isActive
            emptyLabel="Semua Personel"
            placeholder="Cari personel untuk filter..."
          />
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Tambah Catatan</Button>
        </div>

        <Table<DisciplineNote>
          columns={[
            {
              key: 'created_at',
              header: 'Tanggal',
              render: (n) => new Date(n.created_at).toLocaleDateString('id-ID'),
            },
            {
              key: 'user',
              header: 'Personel',
              render: (n) => (
                <div>
                  <p className="font-medium text-text-primary">{n.user?.nama ?? '—'}</p>
                  <p className="font-mono text-xs text-text-muted">{n.user?.nrp}</p>
                </div>
              ),
            },
            {
              key: 'jenis',
              header: 'Jenis',
              render: (n) => n.jenis ? (
                <Badge variant={jenisBadge[n.jenis]}>
                  <span className="inline-flex items-center gap-1">
                    {jenisIcon[n.jenis]} {n.jenis}
                  </span>
                </Badge>
              ) : '—',
            },
            {
              key: 'isi',
              header: 'Catatan',
              render: (n) => <p className="text-sm text-text-primary line-clamp-2">{n.isi}</p>,
            },
            {
              key: 'creator',
              header: 'Dicatat oleh',
              render: (n) => <span className="text-sm text-text-muted">{n.creator?.nama ?? '—'}</span>,
            },
            {
              key: 'actions',
              header: 'Aksi',
              render: (n) => (
                <Button size="sm" variant="danger" onClick={() => handleDelete(n.id)}>
                  Hapus
                </Button>
              ),
            },
          ]}
          data={notes}
          keyExtractor={(n) => n.id}
          isLoading={isLoading}
          emptyMessage="Belum ada catatan evaluasi"
        />
      </div>

      {/* Create Note Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tambah Catatan Evaluasi"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary">Personel *</label>
            <UserSearchSelect
              className="mt-1 space-y-2"
              value={form.user_id}
              onChange={(userId) => setForm({ ...form, user_id: userId })}
              satuan={user?.satuan}
              roleFilter="prajurit"
              isActive
              emptyLabel="Pilih personel..."
              placeholder="Cari prajurit..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary">Jenis Catatan</label>
            <select
              className="form-control mt-1"
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as typeof form.jenis })}
            >
              <option value="catatan">Catatan</option>
              <option value="peringatan">Peringatan</option>
              <option value="penghargaan">Penghargaan</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary">Isi Catatan *</label>
            <textarea
              className="form-control mt-1 min-h-28"
              rows={4}
              placeholder="Tuliskan catatan evaluasi..."
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!isDeleting) setConfirmDeleteId(null); }}
        onConfirm={() => { void handleConfirmDelete(); }}
        title="Hapus Catatan Evaluasi"
        message="Catatan evaluasi ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        isConfirming={isDeleting}
      />
    </DashboardLayout>
  );
}
