import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { APP_ROUTE_PATHS, getRoleDefaultPath } from '../lib/rolePermissions';
import { useAuthStore } from '../store/authStore';

export default function ForceChangePin() {
  const navigate = useNavigate();
  const { isAuthenticated, requiresPinChange, user, completeForceChangePin, isLoading } = useAuthStore();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate(APP_ROUTE_PATHS.login, { replace: true });
      return;
    }

    if (!requiresPinChange) {
      navigate(getRoleDefaultPath(user.role) ?? APP_ROUTE_PATHS.login, { replace: true });
    }
  }, [isAuthenticated, requiresPinChange, navigate, user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!/^\d{6}$/.test(newPin)) {
      setLocalError('PIN baru harus 6 digit angka.');
      return;
    }

    if (newPin === '123456') {
      setLocalError('PIN baru tidak boleh sama dengan PIN default.');
      return;
    }

    if (newPin !== confirmPin) {
      setLocalError('Konfirmasi PIN tidak cocok.');
      return;
    }

    setIsSaving(true);
    try {
      await completeForceChangePin(newPin);
      navigate(getRoleDefaultPath(user?.role) ?? APP_ROUTE_PATHS.login, { replace: true });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal mengubah PIN');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-military-dark p-4" role="main">
      <div className="app-card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-text-primary">Wajib Ganti PIN</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Untuk keamanan, silakan ganti PIN default Anda.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            label="PIN Baru"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => {
              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setLocalError(null);
            }}
            helpText="PIN harus 6 digit angka dan tidak boleh 123456"
            required
            autoFocus
          />

          <Input
            label="Konfirmasi PIN Baru"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setLocalError(null);
            }}
            required
          />

          {localError && (
            <p role="alert" className="rounded-lg border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
              {localError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSaving || isLoading}
          >
            Simpan PIN Baru
          </Button>
        </form>
      </div>
    </main>
  );
}
