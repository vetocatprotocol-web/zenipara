import { useMemo, useState } from 'react';
import { ClipboardList, Check, FileText, Paperclip, X } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import TaskCard from '../../components/ui/TaskCard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import UserSearchSelect from '../../components/common/UserSearchSelect';
import EmptyState from '../../components/common/EmptyState';
import { TaskStatusBadge } from '../../components/common/Badge';
import { useTasks } from '../../hooks/useTasks';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useUIStore } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import type { Task, TaskReport, TaskStatus } from '../../types';
import { CardListSkeleton } from '../../components/common/Skeleton';
import { Link } from 'react-router-dom';
import { isPathEnabled } from '../../lib/featureFlags';
import { canWrite, getOperationalRoleLabel } from '../../lib/rolePermissions';

export default function TaskManagement() {
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { showNotification } = useUIStore();
  const { tasks, isLoading, createTask, approveTask, rejectTask, getTaskReport } = useTasks({ assignedBy: user?.id });
  const canOpenReports = isPathEnabled('/komandan/reports', flags);
  const canWriteTasks = canWrite(user, 'tasks');

  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskReport, setTaskReport] = useState<TaskReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [searchRaw, setSearchRaw] = useState('');
  const [form, setForm] = useState({
    judul: '',
    deskripsi: '',
    assigned_to: '',
    deadline: '',
    prioritas: 2 as 1 | 2 | 3,
  });

  const filtered = useMemo(() => {
    const query = searchRaw.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchSearch = !query
        || t.judul.toLowerCase().includes(query)
        || (t.deskripsi?.toLowerCase().includes(query) ?? false)
        || (t.assignee?.nama?.toLowerCase().includes(query) ?? false)
        || (t.assignee?.nrp?.includes(query) ?? false);
      return matchStatus && matchSearch;
    });
  }, [filterStatus, searchRaw, tasks]);

  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let done = 0;
    let approved = 0;
    let rejected = 0;

    for (const task of tasks) {
      if (task.status === 'pending') pending += 1;
      else if (task.status === 'in_progress') inProgress += 1;
      else if (task.status === 'done') done += 1;
      else if (task.status === 'approved') approved += 1;
      else if (task.status === 'rejected') rejected += 1;
    }

    return {
      total: tasks.length,
      pending,
      inProgress,
      done,
      approved,
      rejected,
    };
  }, [tasks]);

  const openDetail = async (task: Task) => {
    setSelectedTask(task);
    setShowDetail(true);
    setShowRejectForm(false);
    setRejectReason('');
    setTaskReport(null);
    if (task.status === 'done') {
      setLoadingReport(true);
      try {
        const report = await getTaskReport(task.id);
        setTaskReport(report as TaskReport | null);
      } finally {
        setLoadingReport(false);
      }
    }
  };

  const handleCreate = async () => {
    if (!form.judul || !form.assigned_to) {
      showNotification('Judul dan assignee wajib diisi', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await createTask({ ...form, satuan: user?.satuan });
      showNotification('Tugas berhasil dibuat', 'success');
      setShowCreate(false);
      setForm({ judul: '', deskripsi: '', assigned_to: '', deadline: '', prioritas: 2 });
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membuat tugas', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    setIsSaving(true);
    try {
      await approveTask(selectedTask.id);
      showNotification('Tugas disetujui', 'success');
      setShowDetail(false);
    } catch {
      showNotification('Gagal menyetujui tugas', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    if (!rejectReason.trim()) {
      showNotification('Catatan penolakan wajib diisi', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await rejectTask(selectedTask.id, rejectReason);
      showNotification('Tugas dikembalikan untuk revisi', 'info');
      setShowDetail(false);
      setShowRejectForm(false);
    } catch {
      showNotification('Gagal menolak tugas', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const statusFilters: { value: TaskStatus | ''; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: 'Menunggu' },
    { value: 'in_progress', label: 'Dikerjakan' },
    { value: 'done', label: 'Perlu Ditinjau' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'rejected', label: 'Ditolak' },
  ];

  return (
    <DashboardLayout title="Manajemen Tugas">
      <div className="space-y-5">
        <PageHeader
          title="Manajemen Tugas"
          subtitle="Buat, tinjau, dan kontrol progres tugas personel dari satu panel kerja."
          meta={
            <>
              <span>Total: {stats.total}</span>
              <span>Perlu review: {stats.done}</span>
            </>
          }
          actions={
            <>
              {canWriteTasks ? (
                <Button variant="outline" onClick={() => setShowCreate(true)}>+ Buat Tugas</Button>
              ) : (
                <span className="text-xs text-text-muted px-3 py-2 rounded-xl border border-surface/70 bg-surface/20">
                  {getOperationalRoleLabel(user)} — hanya baca
                </span>
              )}
              {canOpenReports && (
                <Link to="/komandan/reports" className="inline-flex items-center rounded-xl border border-surface/70 bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-primary hover:border-primary">
                  Laporan
                </Link>
              )}
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Menunggu', value: stats.pending },
            { label: 'Dikerjakan', value: stats.inProgress },
            { label: 'Perlu Ditinjau', value: stats.done },
            { label: 'Disetujui', value: stats.approved },
          ].map((item) => (
            <div key={item.label} className="app-card p-4">
              <p className="text-xs text-text-muted">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="Cari judul, deskripsi, atau personel..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === f.value
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-muted hover:text-text-primary'
                }`}
              >
                {f.label}
                {f.value !== '' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({f.value === 'in_progress' ? stats.inProgress : stats[f.value as keyof typeof stats]})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        {isLoading ? (
          <CardListSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
            title="Tidak ada tugas"
            description={filterStatus ? 'Tidak ada tugas dengan status yang dipilih. Coba filter lain.' : 'Buat tugas baru untuk personel menggunakan tombol di atas.'}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showAssignee
                actionLabel={task.status === 'done' ? 'Tinjau Laporan' : 'Detail'}
                onAction={() => openDetail(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Buat Tugas Baru"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} isLoading={isSaving}>Buat Tugas</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Judul Tugas *" type="text" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required />
          <div>
            <label className="text-sm font-medium text-text-primary">Deskripsi</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-surface bg-bg-card px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              rows={3}
              placeholder="Detail tugas yang harus dilakukan..."
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary">Ditugaskan ke *</label>
            <UserSearchSelect
              className="mt-1 space-y-2"
              value={form.assigned_to}
              onChange={(userId) => setForm({ ...form, assigned_to: userId })}
              roleFilter="prajurit"
              isActive
              emptyLabel="Pilih Personel..."
              placeholder="Cari prajurit (nama/NRP)..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary">Prioritas</label>
              <select
                className="mt-1 w-full rounded-lg border border-surface bg-bg-card px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
                value={form.prioritas}
                onChange={(e) => setForm({ ...form, prioritas: Number(e.target.value) as 1 | 2 | 3 })}
              >
                <option value={1}>1 — Tinggi</option>
                <option value={2}>2 — Sedang</option>
                <option value={3}>3 — Rendah</option>
              </select>
            </div>
            <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Task Detail / Approval Modal */}
      {selectedTask && (
        <Modal
          isOpen={showDetail}
          onClose={() => { setShowDetail(false); setShowRejectForm(false); }}
          title={selectedTask.status === 'done' ? 'Tinjau Laporan Tugas' : 'Detail Tugas'}
          size="lg"
          footer={
            selectedTask.status === 'done' && !showRejectForm ? (
              <>
                <Button variant="ghost" onClick={() => setShowDetail(false)}>Tutup</Button>
                <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                  Tolak & Minta Revisi
                </Button>
                <Button onClick={handleApprove} isLoading={isSaving} leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}>Setujui</Button>
              </>
            ) : selectedTask.status === 'done' && showRejectForm ? (
              <>
                <Button variant="ghost" onClick={() => setShowRejectForm(false)}>Kembali</Button>
                <Button variant="danger" onClick={handleReject} isLoading={isSaving}>
                  Kirim Penolakan
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setShowDetail(false)}>Tutup</Button>
            )
          }
        >
          <div className="space-y-4">
            {/* Task info */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-text-primary text-base">{selectedTask.judul}</h3>
              <TaskStatusBadge status={selectedTask.status} />
            </div>
            {selectedTask.deskripsi && (
              <p className="text-sm text-text-muted">{selectedTask.deskripsi}</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-text-muted">Assignee:</span> <span className="text-text-primary">{selectedTask.assignee?.nama ?? '—'}</span></div>
              <div><span className="text-text-muted">NRP:</span> <span className="font-mono text-text-primary">{selectedTask.assignee?.nrp ?? '—'}</span></div>
              <div><span className="text-text-muted">Prioritas:</span> <span className={`font-medium ${selectedTask.prioritas === 1 ? 'text-accent-red' : selectedTask.prioritas === 2 ? 'text-accent-gold' : 'text-success'}`}>{selectedTask.prioritas === 1 ? 'Tinggi' : selectedTask.prioritas === 2 ? 'Sedang' : 'Rendah'}</span></div>
              <div><span className="text-text-muted">Deadline:</span> <span className="text-text-primary">{selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString('id-ID') : '—'}</span></div>
            </div>

            {/* Task Report (only for 'done' tasks) */}
            {selectedTask.status === 'done' && (
              <div className="border-t border-surface pt-4">
                <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary mb-2">
                  <FileText className="h-4 w-4" aria-hidden="true" /> Laporan Prajurit
                </h4>
                {loadingReport ? (
                  <div className="space-y-2">
                    <div className="h-4 animate-pulse bg-surface/70 rounded w-full" />
                    <div className="h-4 animate-pulse bg-surface/70 rounded w-3/4" />
                  </div>
                ) : taskReport ? (
                  <div className="bg-surface/30 rounded-lg p-3 text-sm text-text-primary whitespace-pre-line">
                    {taskReport.isi_laporan}
                    {taskReport.file_url && (
                      <a
                        href={taskReport.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-primary text-xs hover:underline"
                      >
                        <Paperclip className="h-3 w-3" aria-hidden="true" /> Lihat lampiran
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted italic">Tidak ada laporan terlampir.</p>
                )}
              </div>
            )}

            {/* Rejection form */}
            {showRejectForm && (
              <div className="border-t border-surface pt-4">
                <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-red mb-2">
                  <X className="h-4 w-4" aria-hidden="true" /> Catatan Penolakan
                </h4>
                <p className="text-xs text-text-muted mb-2">
                  Jelaskan alasan penolakan. Tugas akan dikembalikan ke status "Dikerjakan" agar prajurit dapat merevisi.
                </p>
                <textarea
                  className="w-full rounded-lg border border-surface bg-bg-card px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red"
                  rows={4}
                  placeholder="Tuliskan catatan penolakan dan hal yang perlu diperbaiki..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
