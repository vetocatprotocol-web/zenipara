import Button from '../../common/Button';
import Modal from '../../common/Modal';
import type { User } from '../../../types';

export interface UnlockUserModalProps {
  isOpen: boolean;
  isSaving: boolean;
  user: User | null;
  onUnlock: (userId: string) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function UnlockUserModal({
  isOpen,
  isSaving,
  user,
  onUnlock,
  onClose,
  onError,
  onSuccess,
}: UnlockUserModalProps) {
  const handleUnlock = async () => {
    if (!user) {
      onError('Data pengguna tidak ditemukan');
      return;
    }

    try {
      await onUnlock(user.id);
      onSuccess(`${user.nama} berhasil dibuka kunci`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal membuka kunci pengguna');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Buka Kunci - ${user?.nama || ''}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleUnlock} variant="secondary" isLoading={isSaving}>
            Buka Kunci
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-warning-light rounded-md p-3">
          <p className="text-sm text-warning-dark">
            Anda akan membuka kunci akun {user?.nama} sehingga akun dapat digunakan kembali.
          </p>
          {user?.locked_until && (
            <p className="text-sm text-warning-dark mt-2">
              <strong>Terkunci sampai:</strong> {user.locked_until}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
