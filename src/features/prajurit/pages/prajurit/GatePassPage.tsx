import { useEffect, useState } from 'react';
import GatePassForm from '../../components/gatepass/GatePassForm';
import GatePassList from '../../components/gatepass/GatePassList';
import { useGatePassStore } from '../../store/gatePassStore';
import { useOverdueNotification } from '../../hooks/useOverdueNotification';
import { useGatePassRealtime } from '../../hooks/useGatePassRealtime';
import { useUIStore } from '../../store/uiStore';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import type { GatePass } from '../../types';

export default function GatePassPage() {
  const gatePasses = useGatePassStore(s => s.gatePasses);
  const fetchGatePasses = useGatePassStore(s => s.fetchGatePasses);
  const cancelGatePass = useGatePassStore(s => s.cancelGatePass);
  const overdue = useOverdueNotification();
  const { showNotification } = useUIStore();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  useGatePassRealtime();

  useEffect(() => { void fetchGatePasses(); }, [fetchGatePasses]);

  // Tampilkan notifikasi overdue via sistem notification
  useEffect(() => {
    if (overdue.length > 0) {
      showNotification(`Anda memiliki ${overdue.length} Gate Pass yang overdue! Segera kembali ke batalion.`, 'warning');
    }
  }, [overdue, showNotification]);

  const pending = gatePasses.filter((gp) => gp.status === 'pending' || gp.status === 'approved').length;
  const overdueCnt = overdue.length;

  const handleCancelGatePass = async (gatePass: GatePass) => {
    const confirmed = window.confirm(`Batalkan gate pass ke ${gatePass.tujuan}?`);
    if (!confirmed) return;

    setCancellingId(gatePass.id);
    try {
      await cancelGatePass(gatePass.id);
      showNotification('Gate pass berhasil dibatalkan.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membatalkan gate pass';
      showNotification(message, 'error');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <DashboardLayout title="Gate Pass">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader
          title="Gate Pass"
          subtitle="Ajukan izin keluar batalion dan pantau status persetujuan serta riwayat perjalanan Anda."
          breadcrumbs={[
            { label: 'Beranda', href: '/prajurit/dashboard' },
            { label: 'Gate Pass' },
          ]}
          meta={
            <>
              {pending > 0 && <span>{pending} pengajuan aktif</span>}
              {overdueCnt > 0 && <span className="text-accent-red">{overdueCnt} terlambat kembali</span>}
            </>
          }
        />

        <div className="app-card p-5">
          <h2 className="mb-4 text-base font-semibold text-text-primary">Ajukan Izin Keluar</h2>
          <GatePassForm />
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-text-primary">Riwayat Pengajuan</h2>
          <GatePassList
            gatePasses={gatePasses}
            onCancel={handleCancelGatePass}
            cancellingId={cancellingId}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
