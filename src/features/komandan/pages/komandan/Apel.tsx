import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useApel } from '../../hooks/useApel';
import type { ApelAttendance } from '../../types';

export default function KomandanApelPage() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { sessions, isLoading, error, getSessionAttendance } = useApel();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<ApelAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter((s) => s.tanggal === today);
  }, [sessions]);

  useEffect(() => {
    if (!selectedSessionId && todaySessions[0]) {
      setSelectedSessionId(todaySessions[0].id);
    }
  }, [todaySessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setAttendance([]);
      return;
    }
    const run = async () => {
      setLoadingAttendance(true);
      try {
        const rows = await getSessionAttendance(selectedSessionId);
        setAttendance(rows);
      } catch {
        setAttendance([]);
        showNotification('Gagal memuat kehadiran apel', 'error');
      } finally {
        setLoadingAttendance(false);
      }
    };
    void run();
  }, [selectedSessionId, getSessionAttendance, showNotification]);

  const hadir = attendance.filter((a) => a.status === 'hadir').length;
  const terlambat = attendance.filter((a) => a.status === 'terlambat').length;

  return (
    <DashboardLayout title="Monitoring Apel">
      <div className="space-y-6">
        <PageHeader
          title="Monitoring Apel"
          subtitle="Pantau kehadiran apel harian personel satuan."
          meta={
            <>
              <span>{user?.satuan ?? '—'}</span>
              <span>Hadir: {hadir} · Terlambat: {terlambat}</span>
            </>
          }
        />

        <div className="app-card p-4 space-y-3">
          <label className="text-sm text-text-muted">Pilih sesi apel</label>
          <select
            className="form-control"
            value={selectedSessionId ?? ''}
            onChange={(e) => setSelectedSessionId(e.target.value || null)}
            disabled={isLoading || todaySessions.length === 0}
          >
            {todaySessions.length === 0 && <option value="">Belum ada sesi hari ini</option>}
            {todaySessions.map((session) => (
              <option key={session.id} value={session.id}>
                {`Apel ${session.jenis} (${new Date(session.waktu_buka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div className="app-card overflow-hidden">
          <div className="border-b border-surface/70 px-4 py-3">
            <h3 className="font-semibold text-text-primary">Daftar Kehadiran</h3>
          </div>
          {loadingAttendance ? (
            <p className="px-4 py-4 text-sm text-text-muted">Memuat data...</p>
          ) : attendance.length === 0 ? (
            <EmptyState
              title="Belum ada kehadiran tercatat"
              description="Data akan muncul otomatis saat personel melapor hadir."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="divide-y divide-surface/60">
              {attendance.map((row) => (
                <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{row.user?.nama ?? '—'}</p>
                    <p className="text-xs font-mono text-text-muted">{row.user?.nrp ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm capitalize text-text-primary">{row.status}</p>
                    <p className="text-xs text-text-muted">
                      {row.check_in_at
                        ? new Date(row.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
