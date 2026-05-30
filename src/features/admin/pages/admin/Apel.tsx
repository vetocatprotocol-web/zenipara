import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useApel } from '../../hooks/useApel';
import type { ApelJenis } from '../../types';

function toIsoLocalDateTime(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

export default function AdminApelPage() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { sessions, isLoading, error, createSession } = useApel();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    jenis: 'pagi' as ApelJenis,
    tanggal: today,
    jamBuka: '06:00',
    jamTutup: '06:30',
  });

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      await createSession({
        jenis: form.jenis,
        tanggal: form.tanggal,
        waktuBukaISO: toIsoLocalDateTime(form.tanggal, form.jamBuka),
        waktuTutupISO: toIsoLocalDateTime(form.tanggal, form.jamTutup),
        satuan: user?.satuan,
      });
      showNotification('Sesi apel berhasil dibuat', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membuat sesi apel', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Kelola Sesi Apel">
      <div className="space-y-6">
        <PageHeader
          title="Kelola Sesi Apel"
          subtitle="Atur sesi apel agar prajurit dapat melapor hadir tepat waktu."
          meta={<span>{user?.satuan ?? '—'}</span>}
        />

        <div className="app-card p-5 space-y-4">
          <h3 className="font-semibold text-text-primary">Buat Sesi Baru</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-text-muted">Jenis</label>
              <select
                className="form-control mt-1"
                value={form.jenis}
                onChange={(e) => setForm((prev) => ({ ...prev, jenis: e.target.value as ApelJenis }))}
              >
                <option value="pagi">Apel Pagi</option>
                <option value="siang">Apel Siang</option>
                <option value="malam">Apel Malam</option>
                <option value="upacara">Upacara</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-muted">Tanggal</label>
              <input
                type="date"
                className="form-control mt-1"
                value={form.tanggal}
                onChange={(e) => setForm((prev) => ({ ...prev, tanggal: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-text-muted">Jam Buka</label>
              <input
                type="time"
                className="form-control mt-1"
                value={form.jamBuka}
                onChange={(e) => setForm((prev) => ({ ...prev, jamBuka: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-text-muted">Jam Tutup</label>
              <input
                type="time"
                className="form-control mt-1"
                value={form.jamTutup}
                onChange={(e) => setForm((prev) => ({ ...prev, jamTutup: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={() => void handleCreate()} isLoading={isSubmitting}>
            Simpan Sesi Apel
          </Button>
          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div className="app-card p-5">
          <h3 className="mb-3 font-semibold text-text-primary">Sesi Terdaftar Hari Ini</h3>
          {isLoading ? (
            <p className="text-sm text-text-muted">Memuat sesi...</p>
          ) : sessions.length === 0 ? (
            <EmptyState
              title="Belum ada sesi apel"
              description="Buat sesi apel pertama untuk memulai absensi apel digital."
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-surface/70 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary capitalize">Apel {session.jenis}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(session.tanggal).toLocaleDateString('id-ID')}
                      {' · '}
                      {new Date(session.waktu_buka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(session.waktu_tutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">
                    Hadir: {session.hadir_count ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
