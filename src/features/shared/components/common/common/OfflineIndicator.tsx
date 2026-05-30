import { memo, useEffect, useRef, useState } from 'react';

import { ICONS } from '../../icons';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncLabel?: string;
}

const ONLINE_SETTLE_MS = 700;

type DisplayStatus = 'online' | 'syncing' | 'offline';

function resolveDisplayStatus(isOnline: boolean, isSyncing: boolean): DisplayStatus {
  if (!isOnline) return 'offline';
  if (isSyncing) return 'syncing';
  return 'online';
}

function OfflineIndicatorComponent({ isOnline, isSyncing, lastSyncLabel }: OfflineIndicatorProps) {
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus>(() => resolveDisplayStatus(isOnline, isSyncing));
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    const next = resolveDisplayStatus(isOnline, isSyncing);
    if (next !== 'online') {
      setDisplayStatus(next);
      return;
    }

    // Tahan sedikit sebelum kembali ke mode online agar label tidak berkedip.
    settleTimerRef.current = window.setTimeout(() => {
      setDisplayStatus('online');
      settleTimerRef.current = null;
    }, ONLINE_SETTLE_MS);

    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [isOnline, isSyncing]);

  if (displayStatus === 'online') {
    return (
      <span
        className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50/90 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:border-success/35 dark:bg-success/16 dark:text-success"
        title={lastSyncLabel ? `Sinkron terakhir: ${lastSyncLabel}` : 'Online'}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        Online
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
        displayStatus === 'syncing'
          ? 'border-blue-200 bg-blue-50/90 text-blue-700 dark:border-primary/35 dark:bg-primary/16 dark:text-primary'
          : 'border-amber-200 bg-amber-50/90 text-amber-700 dark:border-accent-gold/40 dark:bg-accent-gold/16 dark:text-accent-gold'
      }`}
      title={displayStatus === 'syncing' ? 'Sedang sinkronisasi data' : 'Mode offline aktif'}
      aria-live="polite"
    >
      {displayStatus === 'syncing' && ICONS.RefreshCcw ? (
        <ICONS.RefreshCcw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {displayStatus === 'syncing' ? 'Sinkronisasi' : 'Offline'}
    </span>
  );
}

const OfflineIndicator = memo(OfflineIndicatorComponent);

export default OfflineIndicator;
