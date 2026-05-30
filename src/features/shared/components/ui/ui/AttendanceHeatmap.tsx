/**
 * Attendance heatmap — shows the last 30 days as a grid of coloured cells.
 * Each cell represents one day; colour indicates attendance status.
 */

import { CalendarDays } from 'lucide-react';
import type { Attendance } from '../../types';

interface Props {
  attendances: Attendance[];
}

const STATUS_COLOR: Record<string, string> = {
  hadir:      'bg-success',
  izin:       'bg-accent-gold',
  sakit:      'bg-accent-gold/70',
  dinas_luar: 'bg-primary/70',
  alpa:       'bg-accent-red',
};

const STATUS_LABEL: Record<string, string> = {
  hadir:      'Hadir',
  izin:       'Izin',
  sakit:      'Sakit',
  dinas_luar: 'Dinas Luar',
  alpa:       'Alpa',
};

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export default function AttendanceHeatmap({ attendances }: Props) {
  const days = getLast30Days();
  const byDate = Object.fromEntries(attendances.map((a) => [a.tanggal, a]));

  return (
    <div>
      <h3 className="inline-flex items-center gap-2 font-semibold text-text-primary mb-3">
        <CalendarDays className="h-4 w-4" aria-hidden="true" /> Kalender Kehadiran (30 Hari)
      </h3>

      {/* Grid */}
      <div className="grid grid-cols-10 gap-1">
        {days.map((day) => {
          const record = byDate[day];
          const status = record?.status;
          const color = status ? STATUS_COLOR[status] ?? 'bg-surface' : 'bg-surface/40';
          const label = status ? STATUS_LABEL[status] ?? status : 'Tidak ada data';
          const displayDate = new Date(day + 'T12:00:00').toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short',
          });

          return (
            <div
              key={day}
              className={`h-7 w-full rounded-md ${color} cursor-default transition-opacity hover:opacity-80`}
              title={`${displayDate}: ${label}`}
              aria-label={`${displayDate}: ${label}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-sm ${STATUS_COLOR[key]}`} />
            <span className="text-xs text-text-muted">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-surface/40" />
          <span className="text-xs text-text-muted">Tidak ada data</span>
        </div>
      </div>
    </div>
  );
}
