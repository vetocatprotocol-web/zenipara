import { useState } from 'react';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import SatuanSelector from '../../common/SatuanSelector';
import { ROLE_OPTIONS, isRoleKomandan } from '../../../lib/rolePermissions';
import { validateNewUserForm, getFirstErrorMessage } from '../../../lib/validation/personelValidation';
import type { Satuan, Role, CommandLevel } from '../../../types';

export interface CreateUserModalProps {
  isOpen: boolean;
  isSaving: boolean;
  satuans: Satuan[];
  isSatuansLoading: boolean;
  onSave: (data: {
    nrp: string;
    nama: string;
    pangkat: string;
    pin: string;
    role: Role;
    satuan: string;
    level_komando?: CommandLevel;
  }) => Promise<void>;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function CreateUserModal({
  isOpen,
  isSaving,
  satuans,
  isSatuansLoading,
  onSave,
  onClose,
  onError,
  onSuccess,
}: CreateUserModalProps) {
  const [form, setForm] = useState({
    nrp: '',
    nama: '',
    pangkat: '',
    pin: '',
    role: 'prajurit' as Role,
    satuan: '',
    level_komando: '' as '' | 'BATALION' | 'KOMPI' | 'PELETON',
  });

  const handleCreate = async () => {
    // Validate form data
    const errors = validateNewUserForm({
      nrp: form.nrp,
      nama: form.nama,
      pin: form.pin,
      role: form.role,
      satuan: form.satuan,
      level_komando: form.level_komando || undefined,
    });

    if (errors.length > 0) {
      onError(getFirstErrorMessage(errors) || 'Validasi gagal');
      return;
    }

    try {
      await onSave({
        nrp: form.nrp,
        nama: form.nama,
        pangkat: form.pangkat,
        pin: form.pin,
        role: form.role,
        satuan: form.satuan,
        level_komando: form.level_komando || undefined,
      });

      onSuccess('Personel berhasil ditambahkan');
      setForm({
        nrp: '',
        nama: '',
        pangkat: '',
        pin: '',
        role: 'prajurit',
        satuan: '',
        level_komando: '',
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error
        ? err.message.replace(/menabah/gi, 'menambah')
        : 'Gagal menambah personel';
      onError(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Personel Baru"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleCreate} isLoading={isSaving}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="NRP *"
          type="text"
          inputMode="numeric"
          maxLength={20}
          value={form.nrp}
          onChange={(e) => setForm({ ...form, nrp: e.target.value.replace(/\D/g, '') })}
          required
        />
        <Input
          label="Nama Lengkap *"
          type="text"
          value={form.nama}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          required
        />
        <Input
          label="Pangkat"
          type="text"
          value={form.pangkat}
          onChange={(e) => setForm({ ...form, pangkat: e.target.value })}
        />
        {satuans.length > 0 ? (
          <SatuanSelector
            label="Satuan"
            required
            value={form.satuan}
            onChange={(value) => setForm({ ...form, satuan: value })}
            satuans={satuans}
            disabled={isSatuansLoading}
          />
        ) : (
          <Input
            label="Satuan *"
            type="text"
            value={form.satuan}
            onChange={(e) => setForm({ ...form, satuan: e.target.value })}
            required
          />
        )}
        <div>
          <label className="text-sm font-semibold text-text-primary">Role *</label>
          <select
            className="form-control mt-1"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role, level_komando: '' })}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {isRoleKomandan(form.role) && (
          <div>
            <label className="text-sm font-semibold text-text-primary">Tingkat Komando *</label>
            <select
              className="form-control mt-1"
              value={form.level_komando}
              onChange={(e) => setForm({ ...form, level_komando: e.target.value as '' | 'BATALION' | 'KOMPI' | 'PELETON' })}
            >
              <option value="">— Pilih Tingkat —</option>
              <option value="BATALION">Batalion (Danyon)</option>
              <option value="KOMPI">Kompi (Danki)</option>
              <option value="PELETON">Peleton (Danton)</option>
            </select>
          </div>
        )}
        <Input
          label="PIN Awal *"
          type="password"
          inputMode="numeric"
          maxLength={6}
          helpText="6 digit angka"
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          required
        />
      </div>
    </Modal>
  );
}
