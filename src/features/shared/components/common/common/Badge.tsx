import type { TaskStatus, AttendanceStatus, LeaveStatus, Role } from '../../types';
import { getRoleDisplayLabel } from '../../lib/rolePermissions';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'gold';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
  guard?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-700 dark:border-success/35 dark:bg-success/16 dark:text-success',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-accent-red/35 dark:bg-accent-red/16 dark:text-accent-red',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-accent-gold/40 dark:bg-accent-gold/16 dark:text-accent-gold',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-primary/40 dark:bg-primary/16 dark:text-primary',
  neutral: 'border-surface bg-slate-50 text-text-muted dark:bg-surface/55',
  gold: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-accent-gold/40 dark:bg-accent-gold/14 dark:text-accent-gold',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-green-500 dark:bg-success',
  error: 'bg-red-500 dark:bg-accent-red',
  warning: 'bg-amber-500 dark:bg-accent-gold',
  info: 'bg-blue-500 dark:bg-primary',
  neutral: 'bg-slate-400',
  gold: 'bg-amber-500 dark:bg-accent-gold',
};

export default function Badge({ variant = 'neutral', children, size = 'sm', dot }: BadgeProps) {
  const sizes = { sm: 'px-2.5 py-1 text-[11px]', md: 'px-3 py-1 text-sm' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-[0.03em] shadow-sm ${variants[variant]} ${sizes[size]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColors[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

// Convenience badge components
export function TaskStatusBadge({ status }: { status: TaskStatus; guard?: string }) {
  const map: Record<TaskStatus, { label: string; variant: BadgeVariant; dot?: boolean }> = {
    pending:     { label: 'Menunggu',   variant: 'neutral', dot: false },
    in_progress: { label: 'Dikerjakan', variant: 'info',    dot: true },
    done:        { label: 'Selesai',    variant: 'warning', dot: false },
    approved:    { label: 'Disetujui',  variant: 'success', dot: false },
    rejected:    { label: 'Ditolak',    variant: 'error',   dot: false },
  };
  const { label, variant, dot } = map[status];
  return <Badge variant={variant} dot={dot}>{label}</Badge>;
}

export function AttendanceBadge({ status }: { status: AttendanceStatus; guard?: string }) {
  const map: Record<AttendanceStatus, { label: string; variant: BadgeVariant; dot?: boolean }> = {
    hadir:      { label: 'Hadir',      variant: 'success', dot: true },
    izin:       { label: 'Izin',       variant: 'warning', dot: false },
    sakit:      { label: 'Sakit',      variant: 'info',    dot: false },
    alpa:       { label: 'Alpa',       variant: 'error',   dot: false },
    dinas_luar: { label: 'Dinas Luar', variant: 'neutral', dot: false },
  };
  const { label, variant, dot } = map[status];
  return <Badge variant={variant} dot={dot}>{label}</Badge>;
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus; guard?: string }) {
  const map: Record<LeaveStatus, { label: string; variant: BadgeVariant; dot?: boolean }> = {
    pending:  { label: 'Menunggu',  variant: 'warning', dot: true },
    approved: { label: 'Disetujui', variant: 'success', dot: false },
    rejected: { label: 'Ditolak',   variant: 'error',   dot: false },
  };
  const { label, variant, dot } = map[status];
  return <Badge variant={variant} dot={dot}>{label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const map: Partial<Record<Role, { label: string; variant: BadgeVariant }>> = {
    admin:    { label: 'Super Admin',  variant: 'gold' },
    komandan: { label: 'Komandan',     variant: 'info' },
    prajurit: { label: 'Prajurit',     variant: 'neutral' },
    guard:    { label: 'Petugas Jaga / Provost', variant: 'info' },
    staf:     { label: 'Staf Operasional', variant: 'warning' },
  };
  const roleMeta = map[role];
  const label = roleMeta?.label ?? getRoleDisplayLabel(role);
  const variant = roleMeta?.variant ?? 'neutral';
  return <Badge variant={variant}>{label}</Badge>;
}
