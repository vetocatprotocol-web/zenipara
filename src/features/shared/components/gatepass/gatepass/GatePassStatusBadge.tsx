import { GatePass } from '../../types';
import React from 'react';

interface Props {
  gatePass: GatePass;
  guard?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  cancelled: 'Dibatalkan',
  rejected: 'Ditolak',
  checked_in: 'Sudah Keluar',
  completed: 'Sudah Kembali',
  out: 'Sudah Keluar',
  returned: 'Sudah Kembali',
  overdue: 'Terlambat',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-accent-gold/15 text-accent-gold border-accent-gold/30',
  approved: 'bg-primary/15 text-primary border-primary/30',
  cancelled: 'bg-slate-200/70 text-slate-700 border-slate-300 dark:bg-slate-700/30 dark:text-slate-200 dark:border-slate-600',
  rejected: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  checked_in: 'bg-orange-500/15 text-orange-600 border-orange-400/30 dark:text-orange-400',
  completed: 'bg-success/15 text-success border-success/30',
  out: 'bg-orange-500/15 text-orange-600 border-orange-400/30 dark:text-orange-400',
  returned: 'bg-success/15 text-success border-success/30',
  overdue: 'bg-accent-red/20 text-accent-red border-accent-red/50 font-semibold',
};

const GatePassStatusBadge: React.FC<Props> = ({ gatePass }) => {
  const label = STATUS_LABEL[gatePass.status] ?? gatePass.status;
  const cls = STATUS_CLASS[gatePass.status] ?? 'bg-surface text-text-muted border-surface';
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] shadow-sm ${cls}`}>
      {label}
    </span>
  );
};

export default GatePassStatusBadge;
