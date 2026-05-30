import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Link2, Lock, Pin, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Notification from '../components/common/Notification';
import { isSupabaseConfigured } from '../lib/supabase';
import { usePlatformStore } from '../store/platformStore';
import { APP_ROUTE_PATHS, getRoleDefaultPath } from '../lib/rolePermissions';

export default function Login() {
  const { login, isAuthenticated, requiresPinChange, user, isLoading, error, clearError } = useAuthStore();
  const { settings } = usePlatformStore();
  const navigate = useNavigate();

  const [nrp, setNrp] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (requiresPinChange) {
        navigate(APP_ROUTE_PATHS.forceChangePin, { replace: true });
        return;
      }
      const redirectPath = getRoleDefaultPath(user.role) ?? APP_ROUTE_PATHS.login;
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, requiresPinChange, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!nrp.trim()) {
      setLocalError('NRP tidak boleh kosong');
      return;
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setLocalError('PIN harus 6 digit angka');
      return;
    }

    try {
      await login(nrp.trim(), pin);
    } catch {
      // error is handled by store
    }
  };

  const displayError = localError ?? error;

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-military-dark p-6" role="main">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-accent-red/30 bg-bg-card p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-red/15">
            <AlertTriangle className="h-8 w-8 text-accent-red" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Konfigurasi Tidak Lengkap</h1>
            <p className="mt-2 text-sm text-text-muted">
              Environment variables Supabase belum dikonfigurasi. Hubungi Administrator untuk mengatur{' '}
              <code className="rounded bg-surface px-1 py-0.5 text-xs text-accent-red">VITE_SUPABASE_URL</code>
              {' '}dan{' '}
              <code className="rounded bg-surface px-1 py-0.5 text-xs text-accent-red">VITE_SUPABASE_ANON_KEY</code>
              {' '}di environment deployment.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="desktop-shell relative min-h-screen overflow-hidden bg-military-dark p-4 sm:p-6" role="main">
      {settings.platformLoginBackgroundUrl && (
        <>
          <img
            src={settings.platformLoginBackgroundUrl}
            alt="Background login"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-military-dark/75 backdrop-blur-[1px]" />
        </>
      )}
      <div className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
      <Notification />
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Hero — desktop only */}
        <section className="hidden lg:block">
          <div className="space-y-6 animate-fade-up">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/25 bg-bg-card/75 px-4 py-2 text-sm text-text-muted backdrop-blur-sm shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-700 text-white text-xs shadow-md shadow-primary/30">◈</span>
              Operational Command Platform
              <span className="chip chip--success ml-1">Online</span>
            </div>

            <div className="max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight text-text-primary xl:text-5xl">
              {settings.platformName}{' '}
              <span className="bg-gradient-to-r from-primary via-cyan-500 to-blue-700 bg-clip-text text-transparent">
                pusat kendali
              </span>{' '}
              operasi yang siap tempur.
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-text-muted xl:text-base">
              Pantau personel, gerbang, tugas, kehadiran, dan logistik dalam satu alur kerja yang terukur, aman, dan realtime.
            </p>

            <div className="grid max-w-xl grid-cols-3 gap-3">
              {[
                { title: 'Realtime', value: '24/7', desc: 'Pemantauan status', Icon: Zap },
                { title: 'Secure', value: 'PIN + Policy', desc: 'Akses tervalidasi', Icon: Lock },
                { title: 'Audit Trail', value: 'Tersimpan', desc: 'Riwayat tindakan', Icon: Pin },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="app-card bg-bg-card/80 px-3 py-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <item.Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-text-muted">{item.title}</p>
                  <p className="mt-1 text-sm font-bold text-text-primary">{item.value}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-surface/70 bg-bg-card/70 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Ringkas Operasional</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: 'Personel Aktif', value: 'Live' },
                  { label: 'Monitoring Gate', value: 'Terpadu' },
                  { label: 'Komando Harian', value: 'Sinkron' },
                ].map((summary) => (
                  <div key={summary.label} className="rounded-xl border border-surface/70 bg-surface/25 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">{summary.label}</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{summary.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Login form */}
        <section className="mx-auto w-full max-w-sm lg:max-w-md">
          {/* Mobile-only feature chips (hidden on desktop) */}
          <div className="mb-4 flex flex-wrap justify-center gap-2 lg:hidden animate-fade-up">
            {[
              { label: 'Realtime', Icon: Zap },
              { label: 'Secure', Icon: Lock },
              { label: 'Terintegrasi', Icon: Link2 },
            ].map((chip) => (
              <span key={chip.label} className="chip chip--primary">
                <chip.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {chip.label}
              </span>
            ))}
          </div>

          <div className="app-card glass overflow-hidden border-primary/15 p-0 animate-fade-up">
            {/* Card gradient top bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-primary to-blue-700" aria-hidden="true" />
            <div className="p-7 sm:p-8">
              <div className="mb-6 text-center lg:text-left">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-700 shadow-lg shadow-primary/30">
                  {settings.platformLogoUrl ? (
                    <img
                      src={settings.platformLogoUrl}
                      alt={settings.platformName}
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-white">◈</span>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">Akses Komando</h1>
                <p className="mt-1 text-sm text-text-muted">{settings.platformName} — {settings.platformTagline}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  label="NRP"
                  id="nrp"
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="Nomor Registrasi Pokok"
                  value={nrp}
                  onChange={(e) => {
                    setNrp(e.target.value.replace(/\D/g, ''));
                    setLocalError(null);
                    clearError();
                  }}
                  autoComplete="username"
                  required
                  aria-label="Nomor Registrasi Pokok"
                />

                <Input
                  label="PIN"
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setLocalError(null);
                    clearError();
                  }}
                  autoComplete="current-password"
                  required
                  helpText={pin.length > 0 && pin.length < 6 ? `${pin.length}/6 digit` : undefined}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="flex h-11 min-w-[60px] items-center justify-center rounded-lg px-4 text-text-muted transition-all duration-150 hover:text-text-primary hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:hover:bg-surface/60"
                      aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    >
                      {showPin
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  }
                />

                {displayError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-accent-red/30 bg-accent-red/8 p-3.5 animate-scale-in"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-red" aria-hidden="true" />
                    <span className="flex-1 text-sm font-medium text-accent-red">{displayError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="mt-2 w-full"
                >
                  {isLoading ? 'Memverifikasi...' : 'Masuk Sekarang'}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-2 text-xs text-text-muted">
                <p>Lupa PIN? Hubungi Administrator satuan.</p>
                <span className="chip">v1.5</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-text-muted lg:text-left">
            © 2026 {settings.platformName} — Sistem Manajemen Operasional
          </p>
        </section>
      </div>
    </main>
  );
}
