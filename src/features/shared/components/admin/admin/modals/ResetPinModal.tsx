import { useState } from 'react';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import { validatePin, getFirstErrorMessage } from '../../../lib/validation/personelValidation';
import type { User } from '../../../types';

export interface ResetPinModalProps {
  isOpen: boolean;
  isSaving: boolean;
  user: User | null;
  onSave: (userId: string, newPin: string) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function ResetPinModal({
  isOpen,
  isSaving,
  user,
  onSave,
  onClose,
  onError,
  onSuccess,
}: ResetPinModalProps) {
  const [pin, setPin] = useState('');

  const handleReset = async () => {
    // Validate PIN
    const pinError = validatePin(pin);
    if (pinError) {
      onError(getFirstErrorMessage([pinError]) || 'PIN tidak valid');
      return;
    }

    if (!user) {
      onError('Data pengguna tidak ditemukan');
      return;
    }

    try {
      await onSave(user.id, pin);
      onSuccess(`PIN ${user.nama} berhasil diubah`);
      setPin('');
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengubah PIN');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reset PIN - ${user?.nama || ''}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleReset} isLoading={isSaving}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Masukkan PIN baru yang akan diberikan kepada {user?.nama}.
        </p>
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
