import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Camera, CheckCircle, Info, RotateCcw, ScanLine, ShieldCheck, XCircle } from 'lucide-react';
import { usePosJagaStore } from '../../store/posJagaStore';
import { useGatePassStore } from '../../store/gatePassStore';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import type { ScanPosJagaResult } from '../../types';

type ScanState = 'idle' | 'auth' | 'processing' | 'success' | 'error';

const scanSteps = [
  {
    title: 'Scan QR',
    description: 'Arahkan kamera ke QR statis yang ditempel di pos jaga.',
  },
  {
    title: 'Validasi identitas',
    description: 'Masukkan NRP dan PIN untuk memastikan aksi dilakukan oleh personel yang sah.',
  },
  {
    title: 'Konfirmasi hasil',
    description: 'Simpan hasil scan dan lanjutkan ke status gate pass berikutnya.',
  },
] as const;

function PosJagaScanner({ onScan }: { onScan: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let scanner: { clear: () => Promise<void> } | null = null;

    const startScanner = async () => {
      if (!containerRef.current) return;
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (disposed || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth || window.innerWidth;
      const qrBoxSize = Math.min(Math.floor(containerWidth * 0.7), 250);
      const nextScanner = new Html5QrcodeScanner(
        containerRef.current.id,
        { fps: 10, qrbox: qrBoxSize },
        false,
      );
      scanner = nextScanner;

      nextScanner.render(
        (decodedText: string) => {
          onScan(decodedText);
          void nextScanner.clear();
        },
        () => {},
      );
    };

    void startScanner();

    return () => {
      disposed = true;
      void scanner?.clear().catch(() => {});
    };
  }, [onScan]);

  return <div id="pos-jaga-scanner" ref={containerRef} className="w-full" />;
}

export default function ScanPosJagaPage() {
  const scanPosJaga = usePosJagaStore(s => s.scanPosJaga);
  const fetchGatePasses = useGatePassStore(s => s.fetchGatePasses);

  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanPosJagaResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [nrp, setNrp] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const isProcessingScanRef = useRef<boolean>(false);

  const handleScan = useCallback(
    (token: string) => {
      if (state === 'success' || state === 'error' || isProcessingScanRef.current) return;
      setScannedToken(token);
      setAuthError(null);
      setScanning(false);
      setState('auth');
    },
    [
      state,
    ],
  );

  const handleAuthorizeAndScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!scannedToken) {
      setAuthError('QR belum dipindai. Silakan scan QR pos jaga terlebih dahulu.');
      return;
    }
    if (isProcessingScanRef.current) return;

    isProcessingScanRef.current = true;
    setAuthError(null);
    setErrorMsg(null);
    setState('processing');

    try {
      const res = await scanPosJaga(scannedToken, nrp, pin);
      setResult(res);
      setState('success');
      // Refresh gate passes in background to reflect new status
      void fetchGatePasses();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error('Validasi NRP/PIN atau QR gagal');
      setErrorMsg(err.message);
      setState('error');
    } finally {
      isProcessingScanRef.current = false;
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setErrorMsg(null);
    setAuthError(null);
    setScannedToken(null);
    setNrp('');
    setPin('');
    setScanning(false);
  };

  const handleRescanQr = () => {
    setAuthError(null);
    setState('idle');
    setScanning(true);
  };

  const statusLabel: Record<string, string> = {
    checked_in: 'Sudah Keluar',
    completed: 'Sudah Kembali',
    out: 'Sudah Keluar',
    returned: 'Sudah Kembali',
  };

  const currentStep = state === 'auth' ? 2 : state === 'processing' ? 3 : state === 'success' || state === 'error' ? 3 : 1;
  const stepTone =
    state === 'success'
      ? 'border-success/20 bg-success/10 text-success'
      : state === 'error'
        ? 'border-accent-red/20 bg-accent-red/10 text-accent-red'
        : state === 'processing'
          ? 'border-primary/20 bg-primary/10 text-primary'
          : 'border-emerald-500/20 bg-emerald-500/10 text-success';
  const stepLabel =
    state === 'success'
      ? 'Selesai'
      : state === 'error'
        ? 'Perlu aksi'
        : state === 'processing'
          ? 'Memproses'
          : state === 'auth'
            ? 'QR terbaca'
            : scanning
              ? 'Kamera aktif'
              : 'Siap scan';

  return (
    <DashboardLayout title="Scan Pos Jaga">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageHeader
          title="Scan Pos Jaga"
          subtitle="Pindai QR statis di pos jaga, lalu masukkan NRP dan PIN untuk mencatat izin keluar/kembali."
        />

        <div className="rounded-2xl border border-surface bg-bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl ${stepTone}`}>
                <ScanLine className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-text-muted">Alur Scan</p>
                <h3 className="mt-0.5 text-base font-bold text-text-primary sm:text-lg">Scan Pos Jaga</h3>
                <p className="mt-1 text-sm text-text-muted">
                  {state === 'idle' && !scanning
                    ? 'Tekan mulai scan untuk membuka kamera dan arahkan ke QR pos jaga.'
                    : state === 'idle' && scanning
                      ? 'Posisikan QR di dalam bingkai kamera sampai terbaca otomatis.'
                      : state === 'auth'
                        ? 'QR sudah terbaca. Lanjutkan dengan NRP dan PIN untuk otorisasi.'
                        : state === 'processing'
                          ? 'Sistem sedang memvalidasi data dan mencatat hasil scan.'
                          : state === 'success'
                            ? 'Scan berhasil tersimpan dan gate pass telah diperbarui.'
                            : 'Periksa pesan kesalahan lalu coba scan ulang.'}
                </p>
              </div>
            </div>

            <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-surface/70 bg-surface/30 px-3 py-1.5 text-xs font-semibold text-text-muted">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {stepLabel}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {scanSteps.map((step, index) => {
              const isActive = index + 1 === currentStep;
              const isDone = index + 1 < currentStep && state !== 'error';

              return (
                <div
                  key={step.title}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? 'border-primary/30 bg-primary/5 shadow-sm'
                      : isDone
                        ? 'border-success/20 bg-success/5'
                        : 'border-surface/70 bg-surface/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl text-xs font-bold ${
                        isActive
                          ? 'bg-primary text-white'
                          : isDone
                            ? 'bg-success/15 text-success'
                            : 'bg-surface/50 text-text-muted'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Idle — tombol mulai scan */}
        {state === 'idle' && !scanning && (
          <div className="rounded-2xl border border-surface bg-bg-card p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-gradient-to-br from-emerald-500/15 to-primary/10 text-success shadow-sm">
                <Camera className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="max-w-md space-y-2">
                <p className="text-lg font-semibold text-text-primary">Siapkan kamera untuk scan pos jaga</p>
                <p className="text-sm leading-relaxed text-text-muted">
                  Saat tombol mulai scan ditekan, kamera akan aktif dan otomatis membaca QR tanpa perlu foto manual.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1 rounded-full border border-surface/70 bg-surface/30 px-3 py-1.5">
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  Pastikan pencahayaan cukup
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-surface/70 bg-surface/30 px-3 py-1.5">
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  Dekatkan QR ke tengah layar
                </span>
              </div>
              <Button variant="primary" size="lg" onClick={() => setScanning(true)} leftIcon={<ScanLine className="h-4 w-4" />}>
                Mulai Scan
              </Button>
            </div>
          </div>
        )}

        {/* Scanner aktif */}
        {state === 'idle' && scanning && (
          <div className="rounded-2xl border border-surface bg-bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface/70 bg-surface/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Scanner aktif</p>
                <p className="text-xs text-text-muted">Arahkan QR ke kotak panduan dan tahan kamera tetap stabil.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                Menunggu QR
              </span>
            </div>
            <PosJagaScanner onScan={handleScan} />
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" onClick={handleReset} className="flex-1" leftIcon={<RotateCcw className="h-4 w-4" />}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {/* QR sudah dipindai, tunggu otorisasi NRP + PIN */}
        {state === 'auth' && (
          <div className="rounded-2xl border border-surface bg-bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">QR pos jaga terdeteksi</p>
                <p className="mt-1 text-sm text-text-muted">
                  Masukkan NRP dan PIN untuk memvalidasi akses sebelum status gate pass diperbarui.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-surface/70 bg-surface/20 px-4 py-3 text-xs text-text-muted">
              Token terbaca: <span className="font-mono text-text-primary break-all">{scannedToken}</span>
            </div>

            {authError && (
              <div className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-3 text-sm text-accent-red">
                {authError}
              </div>
            )}

            <form className="space-y-3" onSubmit={handleAuthorizeAndScan}>
              <Input
                label="NRP"
                placeholder="Masukkan NRP"
                value={nrp}
                onChange={(event) => setNrp(event.target.value)}
                autoComplete="username"
                required
              />
              <Input
                label="PIN"
                type="password"
                placeholder="Masukkan PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoComplete="current-password"
                required
              />
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleRescanQr} leftIcon={<RotateCcw className="h-4 w-4" />}>
                  Scan Ulang QR
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Validasi & Proses
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Loading setelah scan */}
        {state === 'processing' && (
          <div className="rounded-2xl border border-surface bg-bg-card p-6 shadow-sm">
            <LoadingSpinner message="Memproses izin keluar/kembali..." />
          </div>
        )}

        {/* Berhasil */}
        {state === 'success' && result && (
          <div className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/10 to-emerald-500/5 p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 flex-shrink-0 text-success" aria-hidden="true" />
              <div>
                <div className="font-bold text-success text-lg">{result.message}</div>
                <div className="text-sm text-text-muted">Pos: {result.pos_nama}</div>
              </div>
            </div>
            <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success font-medium">
              Status gate pass: <strong>{statusLabel[result.status] ?? result.status}</strong>
            </div>
            <Button variant="primary" size="lg" onClick={handleReset} className="w-full">
              Scan Lagi
            </Button>
          </div>
        )}

        {/* Gagal */}
        {state === 'error' && (
          <div className="rounded-2xl border border-accent-red/30 bg-gradient-to-br from-accent-red/10 to-rose-500/5 p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 flex-shrink-0 text-accent-red" aria-hidden="true" />
              <div>
                <div className="font-bold text-accent-red">Scan Gagal</div>
                <div className="text-sm text-text-muted">{errorMsg}</div>
              </div>
            </div>
            <Button variant="danger" size="lg" onClick={handleReset} className="w-full">
              Coba Lagi
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
