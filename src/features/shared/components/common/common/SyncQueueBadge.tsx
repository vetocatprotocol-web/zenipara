import { useEffect, useMemo, useState } from 'react';

interface SyncQueueBadgeProps {
  pending: number;
  failed: number;
  isSyncing: boolean;
  isOnline: boolean;
  onSync: () => void;
}

export default function SyncQueueBadge({
  pending,
  failed,
  isSyncing,
  isOnline,
  onSync,
}: SyncQueueBadgeProps) {
  const [visibleCounts, setVisibleCounts] = useState({ pending: 0, failed: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const hasFailed = visibleCounts.failed > 0;
  const pendingLabel = hasFailed ? visibleCounts.failed : visibleCounts.pending;
  const title = useMemo(
    () => (hasFailed
      ? `${visibleCounts.failed} operasi gagal. Klik untuk coba sinkron ulang.`
      : `${visibleCounts.pending} operasi menunggu sinkronisasi. Klik untuk sinkron sekarang.`),
    [hasFailed, visibleCounts.failed, visibleCounts.pending],
  );

  useEffect(() => {
    const hasItems = pending > 0 || failed > 0;

    if (hasItems) {
      setVisibleCounts({ pending, failed });
      setIsVisible(true);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setIsVisible(false);
      setVisibleCounts({ pending: 0, failed: 0 });
    }, 1200);

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [pending, failed]);

  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={isSyncing || !isOnline}
      className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
        hasFailed
          ? 'border-red-200 bg-red-50/90 text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-accent-red/35 dark:bg-accent-red/16 dark:text-accent-red'
          : 'border-blue-200 bg-blue-50/90 text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-primary/35 dark:bg-primary/16 dark:text-primary'
      }`}
      title={title}
      aria-label={
        hasFailed
          ? `Sinkronisasi ulang ${visibleCounts.failed} operasi gagal`
          : `Sinkronisasi ${visibleCounts.pending} operasi tertunda`
      }
    >
      <span className="tabular-nums">{hasFailed ? `${pendingLabel} gagal` : `${pendingLabel} antre`}</span>
      <span aria-hidden="true" className="text-[10px]">
        {isSyncing ? '...' : 'Sync'}
      </span>
    </button>
  );
}
