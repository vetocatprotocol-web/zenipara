import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { APP_ROUTE_PATHS, getRoleDisplayLabel, normalizeRole } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';

interface TokenValidationResult {
  form_id: string | null;
  role: string | null;
  is_active: boolean;
  is_valid: boolean;
  invalid_reason: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number | null;
}

export default function RegisterByLink() {
  const { token } = useParams<{ token: string }>();

  const [isChecking, setIsChecking] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    nrp: '',
    nama: '',
    satuan: '',
    pangkat: '',
    jabatan: '',
    pin: '',
    confirmPin: '',
  });

  const roleLabel = useMemo(() => {
    if (!tokenInfo?.role) return '—';
    return getRoleDisplayLabel(normalizeRole(tokenInfo.role) ?? tokenInfo.role);
  }, [tokenInfo?.role]);

  useEffect(() => {
    let cancelled = false;
    const validateToken = async () => {
      setIsChecking(true);
      setErrorMessage(null);
      try {
        if (!token) {
          throw new Error('Link pendaftaran tidak valid');
        }

        const { data, error } = await supabase
          .rpc('validate_registration_form_token', { p_token: token })
          .maybeSingle();

        if (error) throw error;

        const payload = data as TokenValidationResult | null;
        if (!payload) {
          throw new Error('Link pendaftaran tidak valid');
        }

        if (!cancelled) {
          setTokenInfo(payload);
          if (!payload.is_valid) {
            setErrorMessage(payload.invalid_reason ?? 'Link pendaftaran tidak dapat digunakan');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setTokenInfo(null);
          setErrorMessage(err instanceof Error ? err.message : 'Gagal memvalidasi link pendaftaran');
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    void validateToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!tokenInfo?.is_valid || !token) {
      setErrorMessage('Link pendaftaran tidak valid atau sudah tidak aktif');
      return;
    }

    if (!/^\d{6}$/.test(form.pin)) {
      setErrorMessage('PIN harus 6 digit angka');
      return;
    }

    if (form.pin !== form.confirmPin) {
      setErrorMessage('Konfirmasi PIN tidak cocok');
      return;
    }

    if (!form.nrp.trim() || !form.nama.trim() || !form.satuan.trim()) {
      setErrorMessage('NRP, Nama, dan Satuan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('register_user_via_form', {
        p_token: token,
        p_nrp: form.nrp.trim(),
        p_nama: form.nama.trim(),
        p_satuan: form.satuan.trim(),
        p_pangkat: form.pangkat.trim() || null,
        p_jabatan: form.jabatan.trim() || null,
        p_pin: form.pin,
      });

      if (error) throw error;

      setSuccessMessage('Pendaftaran berhasil. Silakan login menggunakan NRP dan PIN Anda.');
      setForm({
        nrp: '',
        nama: '',
        satuan: '',
        pangkat: '',
        jabatan: '',
        pin: '',
        confirmPin: '',
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Pendaftaran gagal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-military-dark p-4" role="main">
      <div className="app-card w-full max-w-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-text-primary">Pendaftaran Personel</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Form pendaftaran ini bersifat tertutup dan hanya berlaku melalui link dari Admin.
        </p>

        {isChecking ? (
          <p className="mt-6 text-sm text-text-muted">Memvalidasi link pendaftaran...</p>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-surface/70 bg-surface/20 p-3 text-sm text-text-secondary">
              <p>
                Role pendaftaran: <span className="font-semibold text-text-primary">{roleLabel}</span>
              </p>
              {tokenInfo?.expires_at && (
                <p className="mt-1">
                  Berlaku sampai: <span className="font-medium text-text-primary">{new Date(tokenInfo.expires_at).toLocaleString('id-ID')}</span>
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
                {successMessage}
              </div>
            )}

            {tokenInfo?.is_valid && (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                <Input
                  label="NRP"
                  value={form.nrp}
                  onChange={(e) => setForm((prev) => ({ ...prev, nrp: e.target.value.replace(/\D/g, '') }))}
                  inputMode="numeric"
                  maxLength={20}
                  required
                />
                <Input
                  label="Nama"
                  value={form.nama}
                  onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
                  required
                />
                <Input
                  label="Satuan"
                  value={form.satuan}
                  onChange={(e) => setForm((prev) => ({ ...prev, satuan: e.target.value }))}
                  required
                />
                <Input
                  label="Pangkat"
                  value={form.pangkat}
                  onChange={(e) => setForm((prev) => ({ ...prev, pangkat: e.target.value }))}
                />
                <Input
                  label="Jabatan"
                  value={form.jabatan}
                  onChange={(e) => setForm((prev) => ({ ...prev, jabatan: e.target.value }))}
                />
                <Input
                  label="PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => setForm((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  helpText="6 digit angka"
                  required
                />
                <Input
                  label="Konfirmasi PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.confirmPin}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  required
                />

                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Daftar
                </Button>
              </form>
            )}
          </>
        )}

        <div className="mt-6 text-center text-sm">
          <Link to={APP_ROUTE_PATHS.login} className="font-medium text-primary hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    </main>
  );
}
