import type { Task } from '../../types';
import { CalendarDays, User, Clock } from 'lucide-react';
import { TaskStatusBadge } from '../common/Badge';
import Button from '../common/Button';

interface TaskCardProps {
  task: Task;
  onAction?: () => void;
  actionLabel?: string;
  showAssignee?: boolean;
}

const priorityConfig = {
  1: { label: 'Tinggi', bar: 'border-l-accent-red', bg: 'bg-accent-red/10 text-accent-red border-accent-red/30', dot: 'bg-accent-red' },
  2: { label: 'Sedang', bar: 'border-l-accent-gold', bg: 'bg-amber-500/10 text-accent-gold border-amber-300/40', dot: 'bg-accent-gold' },
  3: { label: 'Rendah', bar: 'border-l-success',     bg: 'bg-emerald-500/10 text-success border-emerald-300/40', dot: 'bg-success' },
};

function isTaskOverdue(task: Task): boolean {
  return Boolean(
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== 'approved' &&
    task.status !== 'done',
  );
}

export default function TaskCard({ task, onAction, actionLabel = 'Lihat', showAssignee }: TaskCardProps) {
  const overdue = isTaskOverdue(task);
  const cfg = priorityConfig[task.prioritas];

  return (
    <div
      className={`app-panel group border-l-4 ${cfg.bar} flex flex-col gap-3 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-bold tracking-tight text-text-primary">{task.judul}</h3>
          {task.deskripsi && (
            <p className="mt-0.5 line-clamp-2 text-sm text-text-muted leading-relaxed">{task.deskripsi}</p>
          )}
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Priority pill */}
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${cfg.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
          {cfg.label}
        </span>
        {/* Deadline */}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${overdue ? 'border-accent-red/30 bg-accent-red/10 text-accent-red font-semibold' : 'border-surface bg-slate-50 text-text-muted dark:bg-surface/40'}`}>
          {overdue
            ? <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            : <CalendarDays className="h-3 w-3 flex-shrink-0 text-text-muted/70" aria-hidden="true" />}
          {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak ada deadline'}
        </span>
        {showAssignee && task.assignee && (
          <span className="inline-flex items-center gap-1 rounded-full border border-surface bg-slate-50 px-2 py-1 text-text-muted dark:bg-surface/40">
            <User className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {task.assignee.nama}
          </span>
        )}
      </div>

      {onAction && (
        <div className="flex justify-end pt-1">
          <Button size="sm" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
