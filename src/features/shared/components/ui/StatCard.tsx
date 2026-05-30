import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  accent?: 'blue' | 'green' | 'gold' | 'red';
}

const accentMap = {
  blue:  { bg: 'from-blue-500/12 to-indigo-500/4',  border: 'hover:border-blue-300/40 dark:hover:border-blue-700/40',   ring: 'ring-blue-500/20' },
  green: { bg: 'from-emerald-500/12 to-teal-500/4', border: 'hover:border-emerald-300/40 dark:hover:border-emerald-700/40', ring: 'ring-emerald-500/20' },
  gold:  { bg: 'from-amber-500/12 to-yellow-400/4', border: 'hover:border-amber-300/40 dark:hover:border-amber-700/40',  ring: 'ring-amber-500/20' },
  red:   { bg: 'from-rose-500/12 to-red-400/4',     border: 'hover:border-rose-300/40 dark:hover:border-rose-700/40',   ring: 'ring-rose-500/20' },
};

/** Format large numbers with locale separators for readability */
function formatValue(v: string | number): string {
  if (typeof v === 'string') return v;
  if (v >= 1000) return v.toLocaleString('id-ID');
  return String(v);
}

export default function StatCard({ icon, label, value, trend, trendUp, className = '', accent = 'blue' }: StatCardProps) {
  const a = accentMap[accent];
  return (
    <div className={`app-card group relative overflow-hidden rounded-2xl border border-surface/70 p-5 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-lg ${a.border} sm:p-6 ${className}`}>
      {/* Gradient header wash */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${a.bg} opacity-80 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-text-primary sm:text-[2rem] tabular-nums">{formatValue(value)}</p>
          {trend && (
            <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-success' : 'text-accent-red'}`}>
              <span aria-hidden="true">{trendUp ? '↑' : '↓'}</span>
              {trend}
            </p>
          )}
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl border border-surface/70 bg-bg-card text-lg shadow-sm ring-2 ${a.ring} transition-all duration-200 group-hover:scale-105 group-hover:shadow-md dark:bg-surface/40`}>{icon}</span>
      </div>
    </div>
  );
}

interface StatsGridProps {
  children: ReactNode;
}

export function StatsGrid({ children }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {children}
    </div>
  );
}
