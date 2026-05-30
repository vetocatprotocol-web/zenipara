import Button from '../../common/Button';
import Modal from '../../common/Modal';
import { AlertTriangle } from 'lucide-react';
import type { User } from '../../../types';

export interface DeleteUserModalProps {
  isOpen: boolean;
  isSaving: boolean;
  user: User | null;
  isCurrentUser: boolean;
  onDelete: (userId: string) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function DeleteUserModal({
  isOpen,
  isSaving,
  user,
  isCurrentUser,
  onDelete,
  onClose,
  onError,
  onSuccess,
}: DeleteUserModalProps) {
  const handleDelete = async () => {
    if (!user) {
      onError('Data pengguna tidak ditemukan');
      return;
    }

    if (isCurrentUser) {
      onError('Anda tidak dapat menghapus akun sendiri');
      return;
    }

    try {
      await onDelete(user.id);
      onSuccess(`${user.nama} berhasil dihapus`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menghapus personel');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hapus Personel"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isSaving}
            disabled={isCurrentUser}
          >
            Hapus
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-danger-light rounded-md p-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-danger-dark">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Perhatian
          </p>
          <p className="text-sm text-danger-dark">
            {isCurrentUser
              ? 'Anda tidak dapat menghapus akun sendiri.'
              : `Anda akan menghapus personel: ${user?.nama}`}
          </p>
          <p className="text-sm text-danger-dark mt-2">
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
      </div>
    </Modal>
  );
}
