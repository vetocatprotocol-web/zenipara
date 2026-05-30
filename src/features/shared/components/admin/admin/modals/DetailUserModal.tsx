import Button from '../../common/Button';
import Modal from '../../common/Modal';
import type { User } from '../../../types';

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface DetailUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

export default function DetailUserModal({
  isOpen,
  user,
  onClose,
}: DetailUserModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail Personel - ${user?.nama || ''}`}
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {user && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">NRP</p>
              <p className="text-sm font-medium text-text-primary">{user.nrp}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">Nama</p>
              <p className="text-sm font-medium text-text-primary">{user.nama}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">Pangkat</p>
              <p className="text-sm font-medium text-text-primary">{user.pangkat || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">Satuan</p>
              <p className="text-sm font-medium text-text-primary">{user.satuan || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">Role</p>
              <p className="text-sm font-medium text-text-primary capitalize">{user.role}</p>
            </div>
            {user.level_komando && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase">Tingkat Komando</p>
                <p className="text-sm font-medium text-text-primary">{user.level_komando}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase">Status</p>
              <p className={`text-sm font-medium ${user.is_active ? 'text-success' : 'text-danger'}`}>
                {user.is_active ? 'Aktif' : 'Nonaktif'}
              </p>
            </div>
            {user.locked_until && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase">Terkunci Sampai</p>
                <p className="text-sm font-medium text-danger">{formatDateTime(user.locked_until)}</p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase">Dibuat</p>
                <p className="text-sm text-text-primary">
                  {formatDateTime(user.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase">Diubah</p>
                <p className="text-sm text-text-primary">
                  {formatDateTime(user.updated_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
