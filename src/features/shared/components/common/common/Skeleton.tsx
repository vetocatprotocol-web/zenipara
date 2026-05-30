interface SkeletonProps {
  className?: string;
}

/** Single animated skeleton line */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** Pre-built skeleton for a stat card grid (4 cards) */
export function StatCardsSkeleton() {
  return (
    <div role="status" aria-label="Memuat statistik..." className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-surface rounded-2xl p-5 space-y-3 shadow-sm shadow-slate-900/[0.03]">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}

/** Pre-built skeleton for a list of cards */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat daftar..." className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-surface rounded-2xl p-4 space-y-3 shadow-sm shadow-slate-900/[0.03]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}

/** Pre-built skeleton for a table */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Memuat tabel..." className="bg-bg-card border border-surface rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-surface">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-4 border-b border-surface/50 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? 'w-1/4' : ''}`} />
          ))}
        </div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
