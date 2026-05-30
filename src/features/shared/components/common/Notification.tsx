import { useUIStore } from '../../store/uiStore';
import { ICONS, IconType } from '../../icons';
import type { JSX } from 'react';
import type { NotificationItem } from '../../store/uiStore';

const colors: Record<string, string> = {
  success: 'bg-green-50 border-green-200 text-green-700 dark:bg-success/20 dark:border-success dark:text-success',
  error: 'bg-red-50 border-red-200 text-red-700 dark:bg-accent-red/20 dark:border-accent-red dark:text-accent-red',
  info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500 dark:text-blue-400',
  warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-accent-gold/20 dark:border-accent-gold dark:text-accent-gold',
};

const iconMap: Record<string, IconType | (() => JSX.Element)> = {
  success: ICONS.Check || (() => <span>✓</span>),
  error: ICONS.X || (() => <span>✕</span>),
  info: ICONS.Info || (() => <span>I</span>),
  warning: ICONS.AlertTriangle || (() => <span>!</span>),
};

function Toast({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  const ariaLive = item.type === 'error' ? 'assertive' : 'polite';
  const Icon = iconMap[item.type];

  return (
    <div
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
      className="animate-slide-in"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur-sm ${colors[item.type]}`}
      >
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg bg-white/70 text-sm font-bold dark:bg-white/10" aria-hidden="true">
          {Icon ? <Icon className="w-5 h-5" aria-hidden="true" /> : null}
        </span>
        <p className="text-sm font-medium flex-1">{item.message}</p>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Tutup notifikasi"
        >
          {ICONS.X ? <ICONS.X className="w-4 h-4" aria-hidden="true" /> : <span aria-hidden="true">✕</span>}
        </button>
      </div>
    </div>
  );
}

export default function Notification() {
  const { notifications, dismissNotification } = useUIStore();

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] max-w-sm space-y-2"
      aria-label="Notifikasi"
    >
      {notifications.map((item) => (
        <Toast
          key={item.id}
          item={item}
          onDismiss={() => dismissNotification(item.id)}
        />
      ))}
    </div>
  );
}
