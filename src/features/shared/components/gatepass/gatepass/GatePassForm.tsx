import React, { useState } from 'react';
import { useGatePassStore } from '../../store/gatePassStore';
import { useUIStore } from '../../store/uiStore';
import Input from '../common/Input';
import Button from '../common/Button';
import {
  validateKeperluan,
  validateTujuan,
} from '../../lib/validation/gatePassValidation';
import { CheckCircle } from 'lucide-react';
import { getCurrentGeoCoordinates } from '../../lib/geolocation';

export default function GatePassForm() {
  const [keperluan, setKeperluan] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoApproved, setAutoApproved] = useState(false);
  const createGatePass = useGatePassStore(s => s.createGatePass);
  const { showNotification } = useUIStore();

  // Real-time validation as user types
  const handleKeperluan = (value: string) => {
    setKeperluan(value);
    const err = validateKeperluan(value);
    setErrors(prev => {
      const next = { ...prev };
      if (err) next.keperluan = err.message;
      else delete next.keperluan;
      return next;
    });
  };

  const handleTujuan = (value: string) => {
    setTujuan(value);
    const err = validateTujuan(value);
    setErrors(prev => {
      const next = { ...prev };
      if (err) next.tujuan = err.message;
      else delete next.tujuan;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAutoApproved(false);

    // Validate Keperluan
    const keperluanErr = validateKeperluan(keperluan);
    if (keperluanErr) {
      setErrors(prev => ({ ...prev, keperluan: keperluanErr.message }));
    }

    // Validate Tujuan
    const tujuanErr = validateTujuan(tujuan);
    if (tujuanErr) {
      setErrors(prev => ({ ...prev, tujuan: tujuanErr.message }));
    }

    if (keperluanErr || tujuanErr) return;

    setLoading(true);
    try {
      const gps = await getCurrentGeoCoordinates();

      const result = await createGatePass({
        keperluan,
        tujuan,
        submit_latitude: gps?.latitude,
        submit_longitude: gps?.longitude,
        submit_accuracy: gps?.accuracy ?? undefined,
      });

      // Reset form
      setKeperluan('');
      setTujuan('');

      // Check if auto-approved
      if (result?.auto_approved) {
        setAutoApproved(true);
        showNotification(
          result.approval_reason || 'Gate Pass berhasil diajukan dan otomatis disetujui.',
          'success'
        );
      } else {
        showNotification(
          'Gate Pass berhasil diajukan. Menunggu persetujuan komandan.',
          'success'
        );
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error('Gagal mengajukan izin');
      setErrors({ form: err.message });
    }
    setLoading(false);
  };

  const isFormValid = keperluan.trim().length > 0 && tujuan.trim().length > 0 && !Object.values(errors).some(e => e);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-primary">
        Isi keperluan dan tujuan izin keluar. Waktu keluar akan dicatat saat scan keluar, dan waktu kembali saat scan kembali.
      </div>
      <p className="text-xs text-text-muted">Lokasi GPS pengajuan akan dicatat otomatis saat izin dikirim.</p>

      {errors.form && (
        <div role="alert" className="rounded-2xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {errors.form}
        </div>
      )}

      {autoApproved && (
        <div className="rounded-2xl border border-success/20 bg-success/10 flex items-gap px-4 py-3 text-sm text-success">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Gate Pass Disetujui Otomatis!</p>
            <p className="text-xs mt-1">Anda sudah bisa scan QR di Pos Jaga untuk keluar batalion.</p>
          </div>
        </div>
      )}

      <Input
        label="Keperluan"
        placeholder="Contoh: Menghadiri rapat penting (min. 5 karakter)"
        value={keperluan}
        onChange={(e) => handleKeperluan(e.target.value)}
        error={errors.keperluan}
        required
      />

      <Input
        label="Tujuan"
        placeholder="Contoh: Kantor pusat di Bandung (min. 3 karakter)"
        value={tujuan}
        onChange={(e) => handleTujuan(e.target.value)}
        error={errors.tujuan}
        required
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={loading}
        disabled={!isFormValid || loading}
        className="w-full"
      >
        {loading ? 'Mengajukan...' : 'Ajukan Izin Keluar'}
      </Button>
    </form>
  );
}
