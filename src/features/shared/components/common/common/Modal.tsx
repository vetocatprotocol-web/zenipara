import { useEffect, useRef, type ReactNode } from 'react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasFocusedOnOpenRef = useRef(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: keep Tab / Shift+Tab within the modal
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
        ).filter((el) => !el.closest('[aria-hidden="true"]'));

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKey);
        document.body.style.overflow = previousOverflow;
      };
    }

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      hasFocusedOnOpenRef.current = false;
      return;
    }

    // Focus only once per open cycle to avoid stealing focus while typing.
    if (hasFocusedOnOpenRef.current) return;
    hasFocusedOnOpenRef.current = true;

    requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      if (dialogRef.current.contains(document.activeElement)) return;

      const first = dialogRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
      first?.focus();
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal — bottom sheet on mobile, centered on sm+ */}
      <div
        ref={dialogRef}
        className={`
          app-panel relative w-full overflow-hidden
          rounded-t-3xl sm:rounded-2xl
          animate-slide-up sm:animate-scale-in
          ${sizes[size]}
          max-h-[92dvh] flex flex-col
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Drag handle — mobile only visual cue */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-surface/80" />
        </div>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-surface/60 px-5 py-4 sm:px-6">
          <h2 id="modal-title" className="text-base font-bold tracking-tight text-text-primary sm:text-lg">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup" className="rounded-xl">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto scroll-y px-5 py-4 sm:px-6">{children}</div>
        {/* Footer */}
        {footer && (
          <div
            className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-surface/60 px-5 py-4 sm:px-6"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
