import { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { ROLE_OPTIONS, isRoleKomandan } from '../../lib/rolePermissions';
import type { User, Role, CommandLevel } from '../../types';

export interface BatchOperationModalsProps {
  isOpen: boolean;
  operationType: 'delete' | 'toggle-active' | 'role-change' | null;
  selectedUsers: User[];
  isSaving: boolean;
  onDelete: () => Promise<void>;
  onToggleActive: (action: 'activate' | 'deactivate' | 'toggle') => Promise<void>;
  onRoleChange: (role: Role, levelKomando?: CommandLevel) => Promise<void>;
  onClose: () => void;
}

export default function BatchOperationModals({
  isOpen,
  operationType,
  selectedUsers,
  isSaving,
  onDelete,
  onToggleActive,
  onRoleChange,
  onClose,
}: BatchOperationModalsProps) {
  const [toggleAction, setToggleAction] = useState<'activate' | 'deactivate' | 'toggle'>('toggle');
  const [roleForm, setRoleForm] = useState<{ role: Role; levelKomando: CommandLevel | '' }>({
    role: 'prajurit',
    levelKomando: '',
  });

  const handleDelete = async () => {
    await onDelete();
    onClose();
  };

  const handleToggleActive = async () => {
    await onToggleActive(toggleAction);
    onClose();
  };

  const handleRoleChange = async () => {
    if (isRoleKomandan(roleForm.role) && !roleForm.levelKomando) {
      return; // Should be handled by validation
    }
    await onRoleChange(roleForm.role, roleForm.levelKomando || undefined);
    onClose();
  };

  if (!isOpen || !operationType) return null;

  // Delete Modal
  if (operationType === 'delete') {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Hapus ${selectedUsers.length} Personel`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isSaving}>
              Ya, Hapus Semua
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-accent-red/20 bg-accent-red/5 p-4">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-accent-red/15 text-accent-red">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">
                Anda akan menghapus <span className="text-accent-red">{selectedUsers.length}</span> personel secara permanen
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Tindakan ini <span className="font-semibold">tidak dapat dibatalkan</span>. Data akan dihapus dari sistem.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-surface/60 bg-surface/15 p-3 space-y-1 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold text-text-muted mb-2">Personel yang akan dihapus:</p>
            {selectedUsers.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-xs text-text-primary">
                <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-accent-red/10 text-[10px] font-bold text-accent-red">
                  {u.nama.charAt(0).toUpperCase()}
                </span>
                <span className="font-mono text-[11px]">{u.nrp}</span>
                <span className="flex-1 truncate">{u.nama}</span>
              </div>
            ))}
            {selectedUsers.length > 5 && (
              <p className="text-xs text-text-muted italic">
                ... dan {selectedUsers.length - 5} personel lainnya
              </p>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // Toggle Active Modal
  if (operationType === 'toggle-active') {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Toggle Status — ${selectedUsers.length} Personel`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleToggleActive} isLoading={isSaving}>
              Terapkan Status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-surface/60 bg-surface/15 p-4">
            <p className="text-sm font-semibold text-text-primary mb-3">Pilih Aksi:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface/30 transition-colors">
                <input
                  type="radio"
                  name="toggle-action"
                  value="activate"
                  checked={toggleAction === 'activate'}
                  onChange={(e) => setToggleAction(e.target.value as 'activate' | 'deactivate' | 'toggle')}
                  className="h-4 w-4 rounded-full border-surface accent-primary cursor-pointer"
                />
                <span className="text-sm text-text-primary">
                  <span className="font-semibold">Aktifkan Semua</span>
                  <p className="text-xs text-text-muted">Membuka akses untuk semua personel yang dipilih</p>
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface/30 transition-colors">
                <input
                  type="radio"
                  name="toggle-action"
                  value="deactivate"
                  checked={toggleAction === 'deactivate'}
                  onChange={(e) => setToggleAction(e.target.value as 'activate' | 'deactivate' | 'toggle')}
                  className="h-4 w-4 rounded-full border-surface accent-primary cursor-pointer"
                />
                <span className="text-sm text-text-primary">
                  <span className="font-semibold">Nonaktifkan Semua</span>
                  <p className="text-xs text-text-muted">Menghapus akses untuk semua personel yang dipilih</p>
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface/30 transition-colors">
                <input
                  type="radio"
                  name="toggle-action"
                  value="toggle"
                  checked={toggleAction === 'toggle'}
                  onChange={(e) => setToggleAction(e.target.value as 'activate' | 'deactivate' | 'toggle')}
                  className="h-4 w-4 rounded-full border-surface accent-primary cursor-pointer"
                />
                <span className="text-sm text-text-primary">
                  <span className="font-semibold">Balik Status</span>
                  <p className="text-xs text-text-muted">Mengubah aktif menjadi nonaktif dan sebaliknya</p>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-surface/60 bg-surface/15 p-3">
            <p className="text-xs font-semibold text-text-muted mb-2">
              {selectedUsers.length} personel akan diubah
            </p>
            <p className="text-xs text-text-muted">
              {toggleAction === 'activate' && 'Semua akun akan diaktifkan'}
              {toggleAction === 'deactivate' && 'Semua akun akan dinonaktifkan'}
              {toggleAction === 'toggle' && 'Status setiap akun akan dibalik'}
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  // Role Change Modal
  if (operationType === 'role-change') {
    const isKomandan = isRoleKomandan(roleForm.role);
    
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Ubah Role — ${selectedUsers.length} Personel`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleRoleChange} isLoading={isSaving}>
              Ubah Role Semua
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm text-text-muted">
              Mengubah role untuk <span className="font-semibold text-primary">{selectedUsers.length}</span> personel. 
              Role baru akan berlaku untuk semua yang dipilih.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-text-primary">Role Baru *</label>
            <select
              className="form-control mt-1"
              value={roleForm.role}
              onChange={(e) => setRoleForm({ role: e.target.value as Role, levelKomando: '' })}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {isKomandan && (
            <div>
              <label className="text-sm font-semibold text-text-primary">Tingkat Komando *</label>
              <select
                className="form-control mt-1"
                value={roleForm.levelKomando}
                onChange={(e) => setRoleForm({ ...roleForm, levelKomando: e.target.value as CommandLevel | '' })}
              >
                <option value="">— Pilih Tingkat —</option>
                <option value="BATALION">Batalion (Danyon)</option>
                <option value="KOMPI">Kompi (Danki)</option>
                <option value="PELETON">Peleton (Danton)</option>
              </select>
              {!roleForm.levelKomando && (
                <p className="mt-1 text-xs text-accent-red">Tingkat komando wajib diisi</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-surface/60 bg-surface/15 p-3 space-y-1 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold text-text-muted mb-2">Personel yang akan diubah:</p>
            {selectedUsers.slice(0, 5).map((u) => (
              <div key={u.id} className="text-xs text-text-muted">
                <span className="font-mono">{u.nrp}</span> • {u.nama}
              </div>
            ))}
            {selectedUsers.length > 5 && (
              <p className="text-xs text-text-muted italic">
                ... dan {selectedUsers.length - 5} personel lainnya
              </p>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
}
