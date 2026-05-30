/**
 * UserDetailModal — Komponen reusable untuk menampilkan detail profil personel.
 *
 * Mode:
 *  - 'view'   : Read-only (untuk komandan dan prajurit melihat diri sendiri)
 *  - 'edit'   : Admin bisa edit semua field
 *
 * Tab yang ditampilkan dikontrol oleh prop `viewerRole`.
 */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pencil, Pin, ClipboardList, CheckCircle, CalendarDays, TrendingUp, AlertTriangle, Award, FileText } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import { RoleBadge } from './Badge';
import { useUIStore } from '../../store/uiStore';
import { fetchUserPersonalStats, fetchUserDisciplineNotes, type UserPersonalStats } from '../../lib/api/users';
import { ROLE_OPTIONS, getOperationalRoleLabel, getRoleCode, getRoleDisplayLabel, isRoleAdmin, isRoleKomandan } from '../../lib/rolePermissions';
import { validateRoleEditForm, getFirstErrorMessage } from '../../lib/validation/personelValidation';
import type { User, Role, DisciplineNote, CommandLevel } from '../../types';

type Tab = 'info' | 'personal' | 'stats' | 'disiplin';
type ModalMode = 'view' | 'edit';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  viewerRole: Role;
  mode?: ModalMode;
  onSave?: (id: string, updates: Partial<User>) => Promise<void>;
}

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];
const STATUS_PERNIKAHAN_OPTIONS: User['status_pernikahan'][] = ['lajang', 'menikah', 'cerai', 'duda', 'janda'];
const GOLONGAN_DARAH_OPTIONS: User['golongan_darah'][] = ['A', 'B', 'AB', 'O'];

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between border-b border-surface/75 py-2 last:border-0 gap-4">
      <span className="text-sm text-text-muted flex-shrink-0 w-40">{label}</span>
      <span className={`text-sm font-medium text-text-primary text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function UserDetailModal({
  isOpen,
  onClose,
  user,
  viewerRole,
  mode = 'view',
  onSave,
}: UserDetailModalProps) {
  const { showNotification } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<UserPersonalStats | null>(null);
  const [disciplineNotes, setDisciplineNotes] = useState<DisciplineNote[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingDisiplin, setIsLoadingDisiplin] = useState(false);

  // Edit form state (admin full edit)
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    if (isOpen && user) {
      setActiveTab('info');
      setIsEditing(false);
      setEditForm({
        nama: user.nama,
        nrp: user.nrp,
        pangkat: user.pangkat ?? '',
        jabatan: user.jabatan ?? '',
        satuan: user.satuan,
        role: user.role,
        level_komando: user.level_komando,
        tempat_lahir: user.tempat_lahir ?? '',
        tanggal_lahir: user.tanggal_lahir ?? '',
        no_telepon: user.no_telepon ?? '',
        alamat: user.alamat ?? '',
        tanggal_masuk_dinas: user.tanggal_masuk_dinas ?? '',
        pendidikan_terakhir: user.pendidikan_terakhir ?? '',
        agama: user.agama ?? '',
        status_pernikahan: user.status_pernikahan,
        golongan_darah: user.golongan_darah,
        nomor_ktp: user.nomor_ktp ?? '',
        kontak_darurat_nama: user.kontak_darurat_nama ?? '',
        kontak_darurat_telp: user.kontak_darurat_telp ?? '',
        catatan_khusus: user.catatan_khusus ?? '',
      });
    }
  }, [isOpen, user]);

  // Load stats when switching to stats tab
  useEffect(() => {
    if (activeTab === 'stats' && user && !stats) {
      setIsLoadingStats(true);
      void fetchUserPersonalStats(user.id)
        .then((result) => setStats(result))
        .catch(() => {})
        .finally(() => setIsLoadingStats(false));
    }
  }, [activeTab, user, stats]);

  // Load discipline notes when switching to disiplin tab
  useEffect(() => {
    if (activeTab === 'disiplin' && user && disciplineNotes.length === 0) {
      setIsLoadingDisiplin(true);
      void fetchUserDisciplineNotes(user.id)
        .then((notes) => setDisciplineNotes(notes))
        .catch(() => {})
        .finally(() => setIsLoadingDisiplin(false));
    }
  }, [activeTab, user, disciplineNotes.length]);

  // Reset state when user changes
  useEffect(() => {
    setStats(null);
    setDisciplineNotes([]);
  }, [user?.id]);

  const handleSave = async () => {
    if (!user || !onSave) return;

    const roleErrors = validateRoleEditForm({
      role: editForm.role as Role,
      level_komando: editForm.level_komando as CommandLevel | undefined,
    });

    if (roleErrors.length > 0) {
      showNotification(getFirstErrorMessage(roleErrors) || 'Validasi role gagal', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(user.id, {
        ...editForm,
        role: editForm.role as Role,
        level_komando: isRoleKomandan(editForm.role)
          ? (editForm.level_komando as CommandLevel | undefined)
          : undefined,
      });
      showNotification('Data personel berhasil disimpan', 'success');
      setIsEditing(false);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan data', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const canEdit = mode === 'edit' && isRoleAdmin(viewerRole);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Info Dasar' },
    { id: 'personal', label: 'Data Pribadi' },
    { id: 'stats', label: 'Statistik' },
    ...(isRoleAdmin(viewerRole) || isRoleKomandan(viewerRole) ? [{ id: 'disiplin' as Tab, label: 'Disiplin' }] : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setIsEditing(false); }}
      title="Detail Personel"
      size="xl"
      footer={
        canEdit ? (
          isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Batal</Button>
              <Button onClick={handleSave} isLoading={isSaving}>Simpan Perubahan</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>Tutup</Button>
              <Button variant="secondary" onClick={() => setIsEditing(true)} leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}>Edit Data</Button>
            </>
          )
        ) : (
          <Button variant="ghost" onClick={onClose}>Tutup</Button>
        )
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Header: Avatar + Nama + NRP */}
        <div className="flex items-center gap-4 pb-4 border-b border-surface/70">
          {user.foto_url ? (
            <img
              src={user.foto_url}
              alt={user.nama}
              className="h-14 w-14 rounded-full object-cover border-2 border-primary/40 flex-shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
              {user.nama.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-text-primary truncate">{user.nama}</h3>
            <p className="text-sm text-text-muted font-mono">{user.nrp}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={user.role} />
              <span className="text-xs text-text-muted">{getOperationalRoleLabel(user)}</span>
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${user.is_online ? 'bg-success animate-pulse' : 'bg-text-muted/40'}`} />
                <span className={`text-xs ${user.is_online ? 'text-success' : 'text-text-muted'}`}>
                  {user.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface/30 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Info Dasar */}
        {activeTab === 'info' && (
          <div className="space-y-1">
            {isEditing ? (
              <div className="space-y-3">
                <Input label="Nama Lengkap *" value={editForm.nama ?? ''} onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })} required />
                <Input label="NRP *" value={editForm.nrp ?? ''} onChange={(e) => setEditForm({ ...editForm, nrp: e.target.value.replace(/\D/g, '') })} inputMode="numeric" required />
                <Input label="Pangkat" value={editForm.pangkat ?? ''} onChange={(e) => setEditForm({ ...editForm, pangkat: e.target.value })} />
                <Input label="Jabatan" value={editForm.jabatan ?? ''} onChange={(e) => setEditForm({ ...editForm, jabatan: e.target.value })} />
                <Input label="Satuan *" value={editForm.satuan ?? ''} onChange={(e) => setEditForm({ ...editForm, satuan: e.target.value })} required />
                <div>
                  <label className="text-sm font-semibold text-text-primary">Role *</label>
                  <select className="form-control mt-1" value={editForm.role ?? 'prajurit'} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role, level_komando: undefined })}>
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                {isRoleKomandan(editForm.role) && (
                  <div>
                    <label className="text-sm font-semibold text-text-primary">Tingkat Komando *</label>
                    <select
                      className="form-control mt-1"
                      value={editForm.level_komando ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, level_komando: e.target.value as CommandLevel || undefined })}
                    >
                      <option value="">— Pilih Tingkat —</option>
                      <option value="BATALION">Batalion (Danyon)</option>
                      <option value="KOMPI">Kompi (Danki)</option>
                      <option value="PELETON">Peleton (Danton)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold text-text-primary">Tanggal Masuk Dinas</label>
                  <input
                    type="date"
                    className="form-control mt-1"
                    value={editForm.tanggal_masuk_dinas ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, tanggal_masuk_dinas: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div>
                <InfoRow label="NRP" value={user.nrp} mono />
                <InfoRow label="Nama Lengkap" value={user.nama} />
                <InfoRow label="Pangkat" value={user.pangkat} />
                <InfoRow label="Jabatan" value={user.jabatan} />
                <InfoRow label="Satuan" value={user.satuan} />
                <InfoRow label="Role" value={`${getRoleDisplayLabel(user.role)} (${getRoleCode(user.role)})`} />
                {isRoleKomandan(user.role) && (
                  <InfoRow
                    label="Tingkat Komando"
                    value={
                      user.level_komando === 'BATALION' ? 'Batalion (Danyon)'
                      : user.level_komando === 'KOMPI' ? 'Kompi (Danki)'
                      : user.level_komando === 'PELETON' ? 'Peleton (Danton)'
                      : undefined
                    }
                  />
                )}
                <InfoRow
                  label="Tanggal Masuk Dinas"
                  value={user.tanggal_masuk_dinas
                    ? new Date(user.tanggal_masuk_dinas + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : undefined}
                />
                <InfoRow label="Status Akun" value={user.is_active ? 'Aktif' : 'Non-Aktif'} />
                <InfoRow
                  label="Login Terakhir"
                  value={user.last_login ? new Date(user.last_login).toLocaleString('id-ID') : 'Belum pernah'}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab: Data Pribadi */}
        {activeTab === 'personal' && (
          <div className="space-y-1">
            {isEditing ? (
              <div className="space-y-3">
                <Input label="Tempat Lahir" value={editForm.tempat_lahir ?? ''} onChange={(e) => setEditForm({ ...editForm, tempat_lahir: e.target.value })} />
                <div>
                  <label className="text-sm font-semibold text-text-primary">Tanggal Lahir</label>
                  <input type="date" className="form-control mt-1" value={editForm.tanggal_lahir ?? ''} onChange={(e) => setEditForm({ ...editForm, tanggal_lahir: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-primary">Agama</label>
                  <select className="form-control mt-1" value={editForm.agama ?? ''} onChange={(e) => setEditForm({ ...editForm, agama: e.target.value })}>
                    <option value="">— Pilih —</option>
                    {AGAMA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-primary">Pendidikan Terakhir</label>
                  <select className="form-control mt-1" value={editForm.pendidikan_terakhir ?? ''} onChange={(e) => setEditForm({ ...editForm, pendidikan_terakhir: e.target.value })}>
                    <option value="">— Pilih —</option>
                    {PENDIDIKAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-primary">Status Pernikahan</label>
                  <select className="form-control mt-1" value={editForm.status_pernikahan ?? ''} onChange={(e) => setEditForm({ ...editForm, status_pernikahan: e.target.value as User['status_pernikahan'] })}>
                    <option value="">— Pilih —</option>
                    {STATUS_PERNIKAHAN_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-primary">Golongan Darah</label>
                  <select className="form-control mt-1" value={editForm.golongan_darah ?? ''} onChange={(e) => setEditForm({ ...editForm, golongan_darah: e.target.value as User['golongan_darah'] })}>
                    <option value="">— Pilih —</option>
                    {GOLONGAN_DARAH_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <Input label="No. Telepon" value={editForm.no_telepon ?? ''} onChange={(e) => setEditForm({ ...editForm, no_telepon: e.target.value })} inputMode="tel" />
                <div>
                  <label className="text-sm font-semibold text-text-primary">Alamat</label>
                  <textarea
                    className="form-control mt-1 min-h-[80px] resize-y"
                    value={editForm.alamat ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
                    placeholder="Alamat lengkap..."
                  />
                </div>
                {isRoleAdmin(viewerRole) && (
                  <Input label="Nomor KTP" value={editForm.nomor_ktp ?? ''} onChange={(e) => setEditForm({ ...editForm, nomor_ktp: e.target.value.replace(/\D/g, '').slice(0, 16) })} inputMode="numeric" maxLength={16} />
                )}
                <Input label="Kontak Darurat — Nama" value={editForm.kontak_darurat_nama ?? ''} onChange={(e) => setEditForm({ ...editForm, kontak_darurat_nama: e.target.value })} />
                <Input label="Kontak Darurat — Telepon" value={editForm.kontak_darurat_telp ?? ''} onChange={(e) => setEditForm({ ...editForm, kontak_darurat_telp: e.target.value })} inputMode="tel" />
                {isRoleAdmin(viewerRole) && (
                  <div>
                    <label className="text-sm font-semibold text-text-primary">Catatan Khusus (Internal)</label>
                    <textarea
                      className="form-control mt-1 min-h-[80px] resize-y"
                      value={editForm.catatan_khusus ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, catatan_khusus: e.target.value })}
                      placeholder="Catatan internal admin..."
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <InfoRow label="Tempat Lahir" value={user.tempat_lahir} />
                <InfoRow
                  label="Tanggal Lahir"
                  value={user.tanggal_lahir
                    ? new Date(user.tanggal_lahir + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : undefined}
                />
                <InfoRow label="Agama" value={user.agama} />
                <InfoRow label="Pendidikan Terakhir" value={user.pendidikan_terakhir} />
                <InfoRow label="Status Pernikahan" value={user.status_pernikahan ? user.status_pernikahan.charAt(0).toUpperCase() + user.status_pernikahan.slice(1) : undefined} />
                <InfoRow label="Golongan Darah" value={user.golongan_darah} />
                <InfoRow label="No. Telepon" value={user.no_telepon} />
                <InfoRow label="Alamat" value={user.alamat} />
                <InfoRow label="Kontak Darurat" value={user.kontak_darurat_nama} />
                <InfoRow label="Telepon Darurat" value={user.kontak_darurat_telp} />
                {isRoleAdmin(viewerRole) && (
                  <>
                    <InfoRow label="Nomor KTP" value={user.nomor_ktp} mono />
                    {user.catatan_khusus && (
                      <div className="mt-3 rounded-xl border border-accent-gold/30 bg-accent-gold/10 p-3">
                        <p className="inline-flex items-center gap-1 text-xs font-semibold text-accent-gold mb-1">
                          <Pin className="h-3 w-3" aria-hidden="true" /> Catatan Internal (Admin)
                        </p>
                        <p className="text-sm text-text-primary">{user.catatan_khusus}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Statistik */}
        {activeTab === 'stats' && (
          <div>
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Tugas', value: stats.totalTasks, icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />, color: 'text-text-primary' },
                  { label: 'Tugas Disetujui', value: stats.approvedTasks, icon: <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />, color: 'text-success' },
                  { label: 'Kehadiran (30 hr)', value: `${stats.hadirCount}/${stats.totalAttendance}`, icon: <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />, color: 'text-primary' },
                  {
                    label: 'Tingkat Hadir',
                    value: stats.totalAttendance > 0
                      ? `${Math.round((stats.hadirCount / stats.totalAttendance) * 100)}%`
                      : '—',
                    icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
                    color: stats.totalAttendance > 0 && (stats.hadirCount / stats.totalAttendance) >= 0.8
                      ? 'text-success'
                      : 'text-accent-gold',
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface/30 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-muted">{s.icon}</span>
                      <p className="text-xs text-text-muted">{s.label}</p>
                    </div>
                    <p className={`text-xl font-bold ${s.color}`}>{String(s.value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted text-center py-8">Tidak ada data statistik</p>
            )}
          </div>
        )}

        {/* Tab: Disiplin */}
        {activeTab === 'disiplin' && (isRoleAdmin(viewerRole) || isRoleKomandan(viewerRole)) && (
          <div>
            {isLoadingDisiplin ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
              </div>
            ) : disciplineNotes.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">Belum ada catatan disiplin</p>
            ) : (
              <div className="space-y-3">
                {disciplineNotes.map((note) => {
                  const variantMap: Record<string, string> = {
                    peringatan: 'border-accent-red/30 bg-accent-red/10 text-accent-red',
                    penghargaan: 'border-success/30 bg-success/10 text-success',
                    catatan: 'border-primary/30 bg-primary/10 text-primary',
                  };
                  const jenisIconMap: Record<string, ReactNode> = {
                    peringatan: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
                    penghargaan: <Award className="h-3 w-3" aria-hidden="true" />,
                    catatan: <FileText className="h-3 w-3" aria-hidden="true" />,
                  };
                  const labelMap: Record<string, string> = {
                    peringatan: 'Peringatan',
                    penghargaan: 'Penghargaan',
                    catatan: 'Catatan',
                  };
                  const jenis = note.jenis ?? 'catatan';
                  return (
                    <div key={note.id} className={`rounded-xl border p-3 ${variantMap[jenis] ?? variantMap['catatan']}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-bold">
                          {jenisIconMap[jenis]} {labelMap[jenis] ?? jenis}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(note.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary">{note.isi}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
