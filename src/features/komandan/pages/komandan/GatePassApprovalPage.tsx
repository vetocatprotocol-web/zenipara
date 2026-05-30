import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import GatePassStatusBadge from '../../components/gatepass/GatePassStatusBadge';
import { useGatePassStore } from '../../store/gatePassStore';
import { useGatePassRealtime } from '../../hooks/useGatePassRealtime';
import { useUIStore } from '../../store/uiStore';

export default function GatePassApprovalPage() {
  const gatePasses = useGatePassStore((s) => s.gatePasses);
  const fetchGatePasses = useGatePassStore((s) => s.fetchGatePasses);
  const approveGatePass = useGatePassStore((s) => s.approveGatePass);
  const { showNotification } = useUIStore();
  const [processingId, setProcessingId] = useState<string | null>(null);

  useGatePassRealtime();

  useEffect(() => {
    void fetchGatePasses();
  }, [fetchGatePasses]);

  const visibleGatePasses = useMemo(
    () => gatePasses.filter((gp) => ['pending', 'approved', 'checked_in', 'completed', 'overdue', 'rejected'].includes(gp.status)),
    [gatePasses],
  );

  const summary = useMemo(() => ({
    pending: gatePasses.filter((gp) => gp.status === 'pending').length,
    approved: gatePasses.filter((gp) => gp.status === 'approved').length,
    checkedIn: gatePasses.filter((gp) => gp.status === 'checked_in').length,
    overdue: gatePasses.filter((gp) => gp.status === 'overdue').length,
  }), [gatePasses]);

  const handleDecision = async (id: string, approved: boolean) => {
    setProcessingId(id);
    try {
      await approveGatePass(id, approved);
      showNotification(
        approved ? 'Gate Pass berhasil disetujui' : 'Gate Pass ditolak',
        approved ? 'success' : 'warning',
      );
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal memproses gate pass', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout title="Persetujuan Gate Pass">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <PageHeader
          title="Persetujuan Gate Pass Komandan"
          subtitle="Gate Pass komandan disetujui otomatis oleh backend. Daftar pending lama tetap bisa diproses manual bila masih ada data historis."
          breadcrumbs={[
            { label: 'Pusat Operasi', href: '/komandan/dashboard' },
            { label: 'Persetujuan Gate Pass' },
          ]}
          meta={
            <>
              <span>{summary.pending} pending</span>
              <span>{summary.approved} approved</span>
              {summary.checkedIn > 0 && <span>{summary.checkedIn} di luar</span>}
              {summary.overdue > 0 && <span className="text-accent-red font-medium">{summary.overdue} overdue</span>}
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Auto Approve</p>
            <p className="mt-2 text-2xl font-black text-success">Aktif</p>
            <p className="mt-1 text-xs text-text-muted">Pengajuan komandan langsung status approved.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Pending Legacy</p>
            <p className="mt-2 text-2xl font-black text-accent-gold">{summary.pending}</p>
            <p className="mt-1 text-xs text-text-muted">Masih bisa diproses manual jika ada.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Sedang di Luar</p>
            <p className="mt-2 text-2xl font-black text-primary">{summary.checkedIn}</p>
            <p className="mt-1 text-xs text-text-muted">Tercatat lewat scan Pos Jaga.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Overdue</p>
            <p className="mt-2 text-2xl font-black text-accent-red">{summary.overdue}</p>
            <p className="mt-1 text-xs text-text-muted">Perlu tindak lanjut segera.</p>
          </div>
        </div>

        <div className="app-card overflow-hidden">
          {visibleGatePasses.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
              title="Belum ada aktivitas Gate Pass"
              description="Semua pengajuan baru dari komandan akan langsung disetujui otomatis dan muncul di dashboard monitoring."
              className="border-0 bg-transparent py-12"
            />
          ) : (
            <div className="divide-y divide-surface/50">
              {visibleGatePasses.map((gp) => {
                const isPending = gp.status === 'pending';
                const isBusy = processingId === gp.id;

                return (
                  <div key={gp.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      {gp.user && (
                        <p className="text-sm font-semibold text-primary truncate">
                          {gp.user.nama}
                          <span className="text-text-muted font-normal ml-1">({gp.user.nrp})</span>
                        </p>
                      )}
                      <p className="font-medium text-text-primary truncate">{gp.tujuan}</p>
                      <p className="text-xs text-text-muted truncate">{gp.keperluan}</p>
                      <p className="text-xs text-text-muted">
                        Diajukan: {new Date(gp.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {isPending && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => { void handleDecision(gp.id, true); }} isLoading={isBusy}>
                            Setujui
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { void handleDecision(gp.id, false); }} isLoading={isBusy}>
                            Tolak
                          </Button>
                        </>
                      )}
                      {!isPending && (
                        <span className="rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1 text-xs text-text-muted">
                          {gp.status === 'approved' ? 'Auto-approved' : 'Diproses'}
                        </span>
                      )}
                      <GatePassStatusBadge gatePass={gp} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
