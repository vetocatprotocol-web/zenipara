import { useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useApel } from '../../hooks/useApel';
import { ICONS } from '../../icons';

function isSessionOpen(waktuBuka: string, waktuTutup: string): boolean {
  const now = Date.now();
  return now >= new Date(waktuBuka).getTime() && now <= new Date(waktuTutup).getTime();
}

export default function ApelPage() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { sessions, isLoading, error, laporHadir } = useApel();
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);

  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter((s) => s.tanggal === today);
  }, [sessions]);

  const activeSession = useMemo(
    () => todaySessions.find((s) => isSessionOpen(s.waktu_buka, s.waktu_tutup)) ?? null,
    [todaySessions],
  );

  const handleLaporHadir = async (sessionId: string) => {
    setIsSubmittingId(sessionId);
    try {
      await laporHadir(sessionId);
      showNotification('Kehadiran apel tercatat', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal melapor hadir', 'error');
    } finally {
      setIsSubmittingId(null);
    }
  };

  return (
    <DashboardLayout title="Apel Digital">
      <div className="space-y-6">
        <PageHeader
          title="Apel Digital"
          subtitle="Laporkan kehadiran apel sesuai sesi yang aktif."
          meta={
            <>
              <span>{user?.satuan ?? '—'}</span>
              <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </>
          }
        />

        {activeSession ? (
          <div className="app-card p-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">Sesi Aktif</p>
              <h3 className="text-lg font-semibold text-text-primary capitalize">
                Apel {activeSession.jenis}
              </h3>
              <p className="text-sm text-text-muted">
                {new Date(activeSession.waktu_buka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(activeSession.waktu_tutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Button
              onClick={() => void handleLaporHadir(activeSession.id)}
              isLoading={isSubmittingId === activeSession.id}
            >
              Lapor Hadir Apel
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={<ICONS.Megaphone className="h-6 w-6" aria-hidden="true" />}
            title="Belum ada sesi apel aktif"
            description="Sesi apel hari ini akan muncul otomatis saat dibuka admin/komandan."
          />
        )}

        <div className="app-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
            Sesi Hari Ini
          </h3>
          {isLoading ? (
            <p className="text-sm text-text-muted">Memuat sesi...</p>
          ) : error ? (
            <p className="text-sm text-accent-red">{error}</p>
          ) : todaySessions.length === 0 ? (
            <p className="text-sm text-text-muted">Belum ada sesi apel untuk hari ini.</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-surface/70 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary capitalize">Apel {session.jenis}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(session.waktu_buka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(session.waktu_tutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">
                    Tercatat: {session.total_tercatat ?? 0}
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
