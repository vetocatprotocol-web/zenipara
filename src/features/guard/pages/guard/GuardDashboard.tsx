import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScanner from '../../components/guard/QRScanner';
import ScanResultCard from '../../components/guard/ScanResultCard';
import PageHeader from '../../components/ui/PageHeader';
import StatCard, { StatsGrid } from '../../components/ui/StatCard';
import Button from '../../components/common/Button';
import { ICONS } from '../../icons';
import { useGatePassStore } from '../../store/gatePassStore';
import { useGatePassRealtime } from '../../hooks/useGatePassRealtime';
import { useVisibilityAwareRefresh } from '../../hooks/useVisibilityAwareRefresh';
import type { GatePass } from '../../types';

export default function GuardDashboard() {
  const scanGatePass = useGatePassStore(s => s.scanGatePass);
  const gatePasses = useGatePassStore(s => s.gatePasses);
  const fetchGatePasses = useGatePassStore(s => s.fetchGatePasses);
  const { requestRefresh: requestGatePassRefresh } = useVisibilityAwareRefresh(fetchGatePasses, {
    intervalMs: 60 * 1000,
  });
  const [scannerKey, setScannerKey] = useState(0);
  const [result, setResult] = useState<GatePass | null>(null);
  const [error, setError] = useState<string | null>(null);
  useGatePassRealtime();

  useEffect(() => {
    requestGatePassRefresh();
  }, [requestGatePassRefresh]);

  const scanStats = useMemo(() => {
    return gatePasses.reduce(
      (acc, item) => {
        if (item.status === 'approved') acc.siapKeluar += 1;
        if (item.status === 'checked_in' || item.status === 'out') acc.diLuar += 1;
        if (item.status === 'overdue') acc.overdue += 1;
        if (item.status === 'completed' || item.status === 'returned') acc.selesai += 1;
        return acc;
      },
      { siapKeluar: 0, diLuar: 0, overdue: 0, selesai: 0 },
    );
  }, [gatePasses]);

  const onScan = async (qr_token: string) => {
    setError(null);
    try {
      const gatePass = await scanGatePass(qr_token);
      setResult(gatePass);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error('QR tidak valid');
      setError(err.message);
      setResult(null);
    }
  };

  return (
    <DashboardLayout title="Scan Gate Pass">
      <div className="w-full max-w-5xl space-y-6">
        <PageHeader
          title="Pos Pemeriksaan Gate Pass"
          subtitle="Validasi QR personel untuk proses keluar dan masuk batalion"
          meta={
            <>
              <span>{scanStats.diLuar} personel sedang di luar</span>
              <span>{scanStats.overdue} overdue</span>
            </>
          }
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setError(null);
                setScannerKey((prev) => prev + 1);
              }}
            >
              Scan Ulang
            </Button>
          }
        />

        <StatsGrid>
          <StatCard accent="blue" icon={<ICONS.ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />} label="Siap Keluar" value={scanStats.siapKeluar} />
          <StatCard accent="gold" icon={<ICONS.UserCheck className="h-5 w-5 text-accent-gold" aria-hidden="true" />} label="Sedang di Luar" value={scanStats.diLuar} />
          <StatCard accent="red" icon={<ICONS.AlertTriangle className="h-5 w-5 text-accent-red" aria-hidden="true" />} label="Overdue" value={scanStats.overdue} />
          <StatCard accent="green" icon={<ICONS.BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />} label="Selesai Hari Ini" value={scanStats.selesai} />
        </StatsGrid>

        <div className="dashboard-grid-secondary">
          <div className="app-card overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 via-blue-500/5 to-transparent border-b border-surface/60 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-700 text-white shadow-md shadow-primary/30">
                  <ICONS.ScanLine className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Pemindaian QR</h3>
                  <p className="mt-0.5 text-sm text-text-muted">
                    Arahkan QR Gate Pass ke kamera. Sistem akan otomatis memproses status keluar/masuk sesuai histori personel.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-padding-responsive">
              <QRScanner key={scannerKey} onScan={onScan} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="app-card dashboard-section">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ICONS.ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                <h4 className="text-sm font-bold text-text-primary">Checklist Petugas</h4>
              </div>
              <ul className="space-y-3">
                {[
                  'Pastikan identitas personel sesuai profil yang tampil.',
                  'Verifikasi status: izin keluar atau izin masuk.',
                  'Jika data tidak valid, hentikan proses dan laporkan ke komandan jaga.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <p className="text-sm text-text-muted leading-snug">{step}</p>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="rounded-2xl border border-accent-red/30 bg-gradient-to-r from-accent-red/10 to-rose-500/5 card-padding-responsive text-sm text-accent-red flex items-center gap-2.5">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-accent-red/15">
                  <ICONS.AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
                {error}
              </div>
            )}

            {result ? (
              <ScanResultCard data={result} />
            ) : (
              <div className="rounded-2xl border border-dashed border-surface/80 bg-surface/10 card-padding-responsive text-center">
                <span className="grid h-12 w-12 mx-auto mb-3 place-items-center rounded-2xl bg-surface/40 text-text-muted">
                  <ICONS.ScanLine className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm text-text-muted">Hasil pemindaian akan tampil di sini setelah QR berhasil dibaca.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
