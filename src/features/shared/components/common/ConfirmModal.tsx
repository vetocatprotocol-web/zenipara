import type { ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isConfirming?: boolean;
}

/**
 * Reusable confirmation dialog for destructive or irreversible actions.
 * Replaces browser-native `window.confirm` with a consistent, accessible modal.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  isConfirming = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isConfirming ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isConfirming}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">{message}</p>
    </Modal>
  );
}
