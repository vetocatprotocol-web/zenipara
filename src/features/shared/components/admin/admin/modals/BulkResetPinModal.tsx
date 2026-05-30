import { useState } from 'react';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import { AlertTriangle } from 'lucide-react';
import { validatePin, getFirstErrorMessage } from '../../../lib/validation/personelValidation';
import type { User } from '../../../types';

export interface BulkResetPinModalProps {
  isOpen: boolean;
  isSaving: boolean;
  selectedUsers: User[];
  onSave: (userIds: string[], newPin: string) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function BulkResetPinModal({
  isOpen,
  isSaving,
  selectedUsers,
  onSave,
  onClose,
  onError,
  onSuccess,
}: BulkResetPinModalProps) {
  const [pin, setPin] = useState('');

  const handleBulkReset = async () => {
    // Validate PIN
    const pinError = validatePin(pin);
    if (pinError) {
      onError(getFirstErrorMessage([pinError]) || 'PIN tidak valid');
      return;
    }

    if (selectedUsers.length === 0) {
      onError('Tidak ada personel yang dipilih');
      return;
    }

    try {
      const userIds = selectedUsers.map((u) => u.id);
      await onSave(userIds, pin);
      onSuccess(`PIN ${selectedUsers.length} personel berhasil diubah`);
      setPin('');
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengubah PIN massal');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah PIN Massal"
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            onClick={handleBulkReset}
            isLoading={isSaving}
          >
            Ubah PIN
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-warning-light rounded-md p-3">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-warning-dark">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Operasi Massal
          </p>
          <p className="text-sm text-warning-dark">
            PIN baru akan diubah untuk {selectedUsers.length} personel:
          </p>
          <ul className="mt-2 text-sm text-warning-dark max-h-40 overflow-y-auto">
            {selectedUsers.slice(0, 10).map((u) => (
              <li key={u.id}>• {u.nama}</li>
            ))}
            {selectedUsers.length > 10 && (
              <li className="font-semibold">• +{selectedUsers.length - 10} lainnya</li>
            )}
          </ul>
        </div>

        <Input
          label="PIN Baru *"
          type="password"
          inputMode="numeric"
          maxLength={6}
          helpText="6 digit angka"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoFocus
        />
      </div>
    </Modal>
  );
}
