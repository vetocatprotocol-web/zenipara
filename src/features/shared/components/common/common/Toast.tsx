/**
 * Toast display component
 * Renders all active toasts
 */

import { CheckCircle2, XCircle, Info, AlertCircle, X } from 'lucide-react';
import { useToastStore } from '../../lib/toastNotification';
import Button from './Button';

interface ToastItemProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onClose: (id: string) => void;
}

const TYPE_CONFIG = {
  success: {
    bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    text: 'text-green-900 dark:text-green-100',
    iconBg: 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    text: 'text-red-900 dark:text-red-100',
    iconBg: 'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-200',
    Icon: XCircle,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    text: 'text-blue-900 dark:text-blue-100',
    iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-200',
    Icon: Info,
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    text: 'text-yellow-900 dark:text-yellow-100',
    iconBg: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-800 dark:text-yellow-200',
    Icon: AlertCircle,
  },
} as const;

function ToastItem({ id, type, message, description, action, onClose }: ToastItemProps) {
  const { bg, text, iconBg, Icon } = TYPE_CONFIG[type];

  return (
    <div
      className={`animate-slide-in border rounded-xl p-3.5 shadow-lg ${bg} ${text} flex gap-3 items-start`}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${iconBg}`}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug">{message}</p>
        {description && <p className="text-xs mt-0.5 opacity-80 leading-snug">{description}</p>}
      </div>

      {/* Action or Close */}
      <div className="flex gap-1.5 flex-shrink-0 items-center">
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              action.onClick();
              onClose(id);
            }}
            className="text-xs px-2 min-h-[32px]"
          >
            {action.label}
          </Button>
        )}
        <button
          onClick={() => onClose(id)}
          className="icon-btn icon-btn--sm border-0 bg-transparent opacity-50 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Tutup"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-20 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none sm:bottom-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            id={toast.id}
            type={toast.type}
            message={toast.message}
            description={toast.description}
            action={toast.action}
            onClose={removeToast}
          />
        </div>
      ))}
    </div>
  );
}
