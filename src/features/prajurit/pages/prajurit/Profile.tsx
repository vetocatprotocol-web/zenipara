import { useState, useEffect } from 'react';
import { Pencil, BarChart2, ClipboardList, CheckCircle, CalendarDays, TrendingUp } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import AvatarUpload from '../../components/common/AvatarUpload';
import { RoleBadge } from '../../components/common/Badge';
import AttendanceHeatmap from '../../components/ui/AttendanceHeatmap';
import PageHeader from '../../components/ui/PageHeader';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useAttendance } from '../../hooks/useAttendance';
import { useUsers } from '../../hooks/useUsers';
import { supabase } from '../../lib/supabase';
import { fetchUserPersonalStats } from '../../lib/api/users';
import { notifyDataChanged } from '../../lib/dataSync';
import { handleError } from '../../lib/handleError';
import { getRoleCode, getRoleDisplayLabel } from '../../lib/rolePermissions';
import type { User } from '../../types';

interface PersonalStats {
  totalTasks: number;
  approvedTasks: number;
  totalAttendance: number;
  hadirCount: number;
}

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];
const STATUS_PERNIKAHAN_OPTIONS: NonNullable<User['status_pernikahan']>[] = ['lajang', 'menikah', 'cerai', 'duda', 'janda'];
const GOLONGAN_DARAH_OPTIONS: NonNullable<User['golongan_darah']>[] = ['A', 'B', 'AB', 'O'];

function createProfileForm(user: User) {
  return {
    tempat_lahir: user.tempat_lahir ?? '',
    tanggal_lahir: user.tanggal_lahir ?? '',
    no_telepon: user.no_telepon ?? '',
    alamat: user.alamat ?? '',
    pendidikan_terakhir: user.pendidikan_terakhir ?? '',
    agama: user.agama ?? '',
    status_pernikahan: user.status_pernikahan ?? '',
    golongan_darah: user.golongan_darah ?? '',
    kontak_darurat_nama: user.kontak_darurat_nama ?? '',
    kontak_darurat_telp: user.kontak_darurat_telp ?? '',
  };
}

export default function Profile() {
  const { user, restoreSession } = useAuthStore();
  const { showNotification } = useUIStore();
  const { attendances } = useAttendance(user?.id);
  const { updateOwnProfile } = useUsers();

  const [changingPin, setChangingPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinForm, setPinForm] = useState({ oldPin: '', newPin: '', confirmPin: '' });
  const [stats, setStats] = useState<PersonalStats | null>(null);

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    tempat_lahir: '',
    tanggal_lahir: '',
    no_telepon: '',
    alamat: '',
    pendidikan_terakhir: '',
    agama: '',
    status_pernikahan: '',
    golongan_darah: '',
    kontak_darurat_nama: '',
    kontak_darurat_telp: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm(createProfileForm(user));
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      const payload = await fetchUserPersonalStats(user.id);
      setStats(payload);
    };
    void fetchStats();
  }, [user?.id]);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinForm.newPin.length !== 6 || !/^\d{6}$/.test(pinForm.newPin)) {
      showNotification('PIN baru harus 6 digit angka', 'error');
      return;
    }
    if (pinForm.newPin === '123456') {
      showNotification('PIN baru tidak boleh sama dengan PIN default', 'error');
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      showNotification('Konfirmasi PIN tidak cocok', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('change_user_pin', {
        p_user_id: user?.id,
        p_old_pin: pinForm.oldPin,
        p_new_pin: pinForm.newPin,
      });
      if (error) throw new Error('PIN lama tidak sesuai');
      showNotification('PIN berhasil diubah', 'success');
      notifyDataChanged('users');
      setChangingPin(false);
      setPinForm({ oldPin: '', newPin: '', confirmPin: '' });
    } catch (err) {
      showNotification(handleError(err, 'Gagal mengubah PIN'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSaving(true);
    try {
      await updateOwnProfile(user.id, {
        ...profileForm,
        status_pernikahan: profileForm.status_pernikahan
          ? profileForm.status_pernikahan as User['status_pernikahan']
          : undefined,
        golongan_darah: profileForm.golongan_darah
          ? profileForm.golongan_darah as User['golongan_darah']
          : undefined,
      });
      await restoreSession();
      showNotification('Profil berhasil diperbarui', 'success');
      notifyDataChanged('users');
      setEditingProfile(false);
    } catch (err) {
      showNotification(handleError(err, 'Gagal memperbarui profil'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout title="Profil Saya">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <PageHeader
          title="Profil Saya"
          subtitle="Kelola informasi pribadi, statistik performa, dan keamanan akun Anda."
          meta={<span>Role: {getRoleDisplayLabel(user.role)} ({getRoleCode(user.role)})</span>}
        />

        {/* Avatar + basic info */}
        <div className="app-card flex items-start gap-5 p-6">
          <div className="flex-shrink-0">
            {user.foto_url ? (
              <img
                src={user.foto_url}
                alt={user.nama}
                className="h-16 w-16 rounded-full object-cover border-2 border-primary/40"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-2xl font-bold text-primary">
                {user.nama.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text-primary">{user.nama}</h2>
            <p className="text-sm text-text-muted font-mono">{user.nrp}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </div>

        {/* Detail info */}
        <div className="app-card p-6">
          <h3 className="font-semibold text-text-primary mb-4">Informasi Personel</h3>
          <div className="space-y-3">
            {[
              { label: 'NRP', value: user.nrp, mono: true },
              { label: 'Nama Lengkap', value: user.nama },
              { label: 'Pangkat', value: user.pangkat ?? '—' },
              { label: 'Jabatan', value: user.jabatan ?? '—' },
              { label: 'Satuan', value: user.satuan },
              { label: 'Tempat Lahir', value: user.tempat_lahir ?? '—' },
              {
                label: 'Tanggal Lahir',
                value: user.tanggal_lahir
                  ? new Date(user.tanggal_lahir + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—',
              },
              { label: 'Agama', value: user.agama ?? '—' },
              { label: 'Pendidikan Terakhir', value: user.pendidikan_terakhir ?? '—' },
              {
                label: 'Status Pernikahan',
                value: user.status_pernikahan
                  ? user.status_pernikahan.charAt(0).toUpperCase() + user.status_pernikahan.slice(1)
                  : '—',
              },
              { label: 'Golongan Darah', value: user.golongan_darah ?? '—' },
              {
                label: 'Tanggal Masuk Dinas',
                value: user.tanggal_masuk_dinas
                  ? new Date(user.tanggal_masuk_dinas + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—',
              },
              { label: 'Status Akun', value: user.is_active ? 'Aktif' : 'Non-Aktif' },
              {
                label: 'Login Terakhir',
                value: user.last_login
                  ? new Date(user.last_login).toLocaleString('id-ID')
                  : 'Belum pernah',
              },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between border-b border-surface/75 py-2 last:border-0">
                <span className="text-sm text-text-muted">{label}</span>
                <span className={`text-sm font-medium text-text-primary ${mono ? 'font-mono' : ''}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Profil Kontak — field yang bisa diedit prajurit */}
        <div className="app-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary">Informasi Pribadi</h3>
            {!editingProfile && (
              <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)} leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}>
                Edit
              </Button>
            )}
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tempat Lahir"
                  type="text"
                  value={profileForm.tempat_lahir}
                  onChange={(e) => setProfileForm({ ...profileForm, tempat_lahir: e.target.value })}
                  placeholder="Contoh: Bandung"
                />
                <div>
                  <label htmlFor="profile-tanggal-lahir" className="text-sm font-semibold text-text-primary">Tanggal Lahir</label>
                  <input
                    id="profile-tanggal-lahir"
                    type="date"
                    className="form-control mt-1"
                    value={profileForm.tanggal_lahir}
                    onChange={(e) => setProfileForm({ ...profileForm, tanggal_lahir: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="profile-agama" className="text-sm font-semibold text-text-primary">Agama</label>
                  <select
                    id="profile-agama"
                    className="form-control mt-1"
                    value={profileForm.agama}
                    onChange={(e) => setProfileForm({ ...profileForm, agama: e.target.value })}
                  >
                    <option value="">— Pilih —</option>
                    {AGAMA_OPTIONS.map((agama) => (
                      <option key={agama} value={agama}>{agama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="profile-pendidikan-terakhir" className="text-sm font-semibold text-text-primary">Pendidikan Terakhir</label>
                  <select
                    id="profile-pendidikan-terakhir"
                    className="form-control mt-1"
                    value={profileForm.pendidikan_terakhir}
                    onChange={(e) => setProfileForm({ ...profileForm, pendidikan_terakhir: e.target.value })}
                  >
                    <option value="">— Pilih —</option>
                    {PENDIDIKAN_OPTIONS.map((pendidikan) => (
                      <option key={pendidikan} value={pendidikan}>{pendidikan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="profile-status-pernikahan" className="text-sm font-semibold text-text-primary">Status Pernikahan</label>
                  <select
                    id="profile-status-pernikahan"
                    className="form-control mt-1"
                    value={profileForm.status_pernikahan}
                    onChange={(e) => setProfileForm({ ...profileForm, status_pernikahan: e.target.value })}
                  >
                    <option value="">— Pilih —</option>
                    {STATUS_PERNIKAHAN_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="profile-golongan-darah" className="text-sm font-semibold text-text-primary">Golongan Darah</label>
                  <select
                    id="profile-golongan-darah"
                    className="form-control mt-1"
                    value={profileForm.golongan_darah}
                    onChange={(e) => setProfileForm({ ...profileForm, golongan_darah: e.target.value })}
                  >
                    <option value="">— Pilih —</option>
                    {GOLONGAN_DARAH_OPTIONS.map((golongan) => (
                      <option key={golongan} value={golongan}>{golongan}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="No. Telepon"
                  type="tel"
                  inputMode="tel"
                  value={profileForm.no_telepon}
                  onChange={(e) => setProfileForm({ ...profileForm, no_telepon: e.target.value })}
                  placeholder="Contoh: 08123456789"
                />
                <div className="sm:col-span-2">
                  <label htmlFor="profile-alamat" className="text-sm font-semibold text-text-primary">Alamat</label>
                  <textarea
                    id="profile-alamat"
                    className="form-control mt-1 min-h-[96px] resize-y"
                    value={profileForm.alamat}
                    onChange={(e) => setProfileForm({ ...profileForm, alamat: e.target.value })}
                    placeholder="Alamat lengkap..."
                  />
                </div>
                <Input
                  label="Kontak Darurat — Nama"
                  type="text"
                  value={profileForm.kontak_darurat_nama}
                  onChange={(e) => setProfileForm({ ...profileForm, kontak_darurat_nama: e.target.value })}
                  placeholder="Nama anggota keluarga / kerabat"
                />
                <Input
                  label="Kontak Darurat — Telepon"
                  type="tel"
                  inputMode="tel"
                  value={profileForm.kontak_darurat_telp}
                  onChange={(e) => setProfileForm({ ...profileForm, kontak_darurat_telp: e.target.value })}
                  placeholder="Contoh: 08123456789"
                />
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-primary">
                  Anda hanya bisa mengubah data pribadi dan kontak. Data dinas seperti nama, NRP, pangkat, jabatan, dan satuan tetap dikelola Admin.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileForm(createProfileForm(user));
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Simpan
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-0">
              {[
                { label: 'Tempat Lahir', value: user.tempat_lahir ?? '—' },
                {
                  label: 'Tanggal Lahir',
                  value: user.tanggal_lahir
                    ? new Date(user.tanggal_lahir + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—',
                },
                { label: 'Agama', value: user.agama ?? '—' },
                { label: 'Pendidikan Terakhir', value: user.pendidikan_terakhir ?? '—' },
                {
                  label: 'Status Pernikahan',
                  value: user.status_pernikahan
                    ? user.status_pernikahan.charAt(0).toUpperCase() + user.status_pernikahan.slice(1)
                    : '—',
                },
                { label: 'Golongan Darah', value: user.golongan_darah ?? '—' },
                { label: 'No. Telepon', value: user.no_telepon ?? '—' },
                { label: 'Alamat', value: user.alamat ?? '—' },
                { label: 'Kontak Darurat', value: user.kontak_darurat_nama ?? '—' },
                { label: 'Telepon Darurat', value: user.kontak_darurat_telp ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between border-b border-surface/75 py-2 last:border-0 gap-4">
                  <span className="text-sm text-text-muted flex-shrink-0">{label}</span>
                  <span className="text-sm font-medium text-text-primary text-right break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal Stats */}
        <div className="app-card p-6">
          <h3 className="inline-flex items-center gap-2 font-semibold text-text-primary mb-4">
            <BarChart2 className="h-4 w-4" aria-hidden="true" /> Statistik Pribadi
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Total Tugas',
                value: stats?.totalTasks ?? '—',
                icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
                color: 'text-text-primary',
              },
              {
                label: 'Tugas Disetujui',
                value: stats?.approvedTasks ?? '—',
                icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />,
                color: 'text-success',
              },
              {
                label: 'Kehadiran (30 hr)',
                value: stats ? `${stats.hadirCount}/${stats.totalAttendance}` : '—',
                icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
                color: 'text-primary',
              },
              {
                label: 'Tingkat Hadir',
                value: stats && stats.totalAttendance > 0
                  ? `${Math.round((stats.hadirCount / stats.totalAttendance) * 100)}%`
                  : '—',
                icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
                color: stats && stats.totalAttendance > 0 && (stats.hadirCount / stats.totalAttendance) >= 0.8
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
        </div>

        {/* Attendance Heatmap */}
        <div className="app-card p-6">
          <AttendanceHeatmap attendances={attendances} />
        </div>

        {/* Avatar Upload */}
        <div className="app-card p-6">
          <h3 className="font-semibold text-text-primary mb-4">Foto Profil</h3>
          <AvatarUpload />
        </div>

        {/* Change PIN */}
        <div className="app-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary">Keamanan</h3>
            {!changingPin && (
              <Button size="sm" variant="outline" onClick={() => setChangingPin(true)}>
                Ubah PIN
              </Button>
            )}
          </div>

          {changingPin ? (
            <form onSubmit={handleChangePin} className="space-y-4">
              <Input
                label="PIN Lama *"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinForm.oldPin}
                onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
              />
              <Input
                label="PIN Baru *"
                type="password"
                inputMode="numeric"
                maxLength={6}
                helpText="6 digit angka"
                value={pinForm.newPin}
                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
              />
              <Input
                label="Konfirmasi PIN Baru *"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setChangingPin(false);
                    setPinForm({ oldPin: '', newPin: '', confirmPin: '' });
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Simpan PIN Baru
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-text-muted">
              PIN Anda adalah 6 digit angka rahasia. Jangan bagikan kepada siapapun.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}


