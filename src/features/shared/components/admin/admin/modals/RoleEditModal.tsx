import { useState, useEffect } from 'react';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import { ROLE_OPTIONS, isRoleKomandan } from '../../../lib/rolePermissions';
import { validateRoleEditForm, getFirstErrorMessage } from '../../../lib/validation/personelValidation';
import type { User, Role, CommandLevel } from '../../../types';

export interface RoleEditModalProps {
  isOpen: boolean;
  isSaving: boolean;
  user: User | null;
  onSave: (userId: string, role: Role, levelKomando?: CommandLevel) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function RoleEditModal({
  isOpen,
  isSaving,
  user,
  onSave,
  onClose,
  onError,
  onSuccess,
}: RoleEditModalProps) {
  const [role, setRole] = useState<Role>('prajurit');
  const [levelKomando, setLevelKomando] = useState<'' | 'BATALION' | 'KOMPI' | 'PELETON'>('');

  useEffect(() => {
    if (isOpen && user) {
      setRole(user.role);
      setLevelKomando((user.level_komando as '' | 'BATALION' | 'KOMPI' | 'PELETON') || '');
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    // Validate form
    const errors = validateRoleEditForm({
      role,
      level_komando: levelKomando || undefined,
    });

    if (errors.length > 0) {
      onError(getFirstErrorMessage(errors) || 'Validasi gagal');
      return;
    }

    if (!user) {
      onError('Data pengguna tidak ditemukan');
      return;
    }

    try {
      await onSave(user.id, role, levelKomando || undefined);
      onSuccess(`Role ${user.nama} berhasil diubah`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengubah role');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ubah Role - ${user?.nama || ''}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-text-primary">Role *</label>
          <select
            className="form-control mt-1"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setLevelKomando('');
            }}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {isRoleKomandan(role) && (
          <div>
            <label className="text-sm font-semibold text-text-primary">Tingkat Komando *</label>
            <select
              className="form-control mt-1"
              value={levelKomando}
              onChange={(e) => setLevelKomando(e.target.value as '' | 'BATALION' | 'KOMPI' | 'PELETON')}
            >
              <option value="">— Pilih Tingkat —</option>
              <option value="BATALION">Batalion (Danyon)</option>
              <option value="KOMPI">Kompi (Danki)</option>
              <option value="PELETON">Peleton (Danton)</option>
            </select>
          </div>
        )}

        <div className="bg-info-light rounded-md p-3">
          <p className="text-xs text-info-dark">
            <strong>Catatan:</strong> Perubahan role akan berlaku terhitung dari sekarang untuk {user?.nama}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
