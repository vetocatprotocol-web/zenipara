import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import TaskCard from '../../components/ui/TaskCard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { useTasks } from '../../hooks/useTasks';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useUIStore } from '../../store/uiStore';
import { CardListSkeleton } from '../../components/common/Skeleton';
import type { Task, TaskStatus } from '../../types';
import { isPathEnabled } from '../../lib/featureFlags';

export default function MyTasks() {
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { showNotification } = useUIStore();
  const { tasks, isLoading, updateTaskStatus, submitTaskReport } = useTasks({ assignedTo: user?.id });
  const navigate = useNavigate();
  const canOpenMessages = isPathEnabled('/prajurit/messages', flags);
  const canOpenLeave = isPathEnabled('/prajurit/leave', flags);

  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(
    () => tasks.filter((t) => !filterStatus || t.status === filterStatus),
    [tasks, filterStatus],
  );

  const statusCounts = useMemo(() => {
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
      pending,
      inProgress,
      done,
      approved,
      rejected,
      active: pending + inProgress,
      completed: done + approved,
    };
  }, [tasks]);

  const activeCount = statusCounts.active;
  const doneCount = statusCounts.completed;
  const rejectedCount = statusCounts.rejected;

  const handleStartTask = async (task: Task) => {
    try {
      await updateTaskStatus(task.id, 'in_progress');
      showNotification('Status tugas diperbarui', 'success');
    } catch {
      showNotification('Gagal memperbarui tugas', 'error');
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedTask || !reportText.trim()) {
      showNotification('Isi laporan tidak boleh kosong', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await submitTaskReport(selectedTask.id, reportText);
      showNotification('Laporan berhasil dikirim!', 'success');
      setShowReport(false);
      setSelectedTask(null);
      setReportText('');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengirim laporan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const statusFilters: { value: TaskStatus | ''; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: 'Menunggu' },
    { value: 'in_progress', label: 'Dikerjakan' },
    { value: 'done', label: 'Selesai' },
    { value: 'approved', label: 'Disetujui' },
  ];

  return (
    <DashboardLayout title="Tugas Saya">
      <div className="space-y-5">
        <PageHeader
          title="Tugas Saya"
          subtitle="Daftar tugas aktif, progres pengerjaan, dan pelaporan hasil tugas Anda."
          meta={
            <>
              <span>Total tugas: {tasks.length}</span>
              <span>Aktif: {activeCount}</span>
            </>
          }
          actions={
            <>
              {canOpenMessages && (
                <Link to="/prajurit/messages" className="inline-flex items-center rounded-xl border border-surface/70 bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-primary hover:border-primary">
                  Pesan
                </Link>
              )}
              {canOpenLeave && <Button onClick={() => navigate('/prajurit/leave')} variant="outline">Ajukan Izin</Button>}
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Aktif', value: activeCount, color: 'text-accent-gold' },
            { label: 'Selesai', value: doneCount, color: 'text-success' },
            { label: 'Ditolak', value: rejectedCount, color: 'text-accent-red' },
            { label: 'Semua', value: tasks.length, color: 'text-text-primary' },
          ].map((item) => (
            <div key={item.label} className="app-card p-4">
              <p className="text-xs text-text-muted">{item.label}</p>
              <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="app-card flex flex-wrap gap-2 p-3 sm:p-4">
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
                    ({f.value === 'in_progress' ? statusCounts.inProgress : statusCounts[f.value as keyof typeof statusCounts]})
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <CardListSkeleton count={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-6 w-6" aria-hidden="true" />}
            title="Tidak ada tugas"
            description={filterStatus
              ? 'Tidak ada tugas dengan status yang dipilih. Coba filter lain.'
              : 'Tugas baru akan muncul saat komandan menugaskan Anda.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((task) => (
              <div key={task.id} className="relative">
                <TaskCard task={task} />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  {task.status === 'pending' && (
                    <Button size="sm" variant="secondary" onClick={() => handleStartTask(task)}>
                      Mulai Kerjakan
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowReport(true);
                      }}
                    >
                      Kirim Laporan
                    </Button>
                  )}
                  {task.status === 'done' && (
                    <span className="rounded-lg bg-surface px-3 py-1.5 text-xs text-text-muted">Menunggu persetujuan</span>
                  )}
                  {task.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Disetujui</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Report Modal */}
      <Modal
        isOpen={showReport}
        onClose={() => { setShowReport(false); setReportText(''); }}
        title={`Laporan: ${selectedTask?.judul ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowReport(false)}>Batal</Button>
            <Button onClick={handleSubmitReport} isLoading={isSaving}>Kirim Laporan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Jelaskan apa yang sudah Anda lakukan untuk tugas ini.
          </p>
          <textarea
            className="form-control min-h-28"
            rows={5}
            placeholder="Tuliskan laporan penyelesaian tugas..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
