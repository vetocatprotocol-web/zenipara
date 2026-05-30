
import type { GatePass } from '../../types';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatTimeWithDate } from '../../utils/timeFormatter';

function normalizeGatePassStatus(status: GatePass['status']) {
  if (status === 'out') return 'checked_in';
  if (status === 'returned') return 'completed';
  return status;
}

export default function ScanResultCard({ data }: { data: GatePass }) {
  const status = normalizeGatePassStatus(data.status);
  const isCheckedIn = status === 'checked_in';
  const isCompleted = status === 'completed';

  return (
    <div className="rounded-3xl border border-surface bg-bg-card p-6 shadow-sm">
      {/* Header dengan nama dan NRP */}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-text-primary">{data.user?.nama ?? '—'}</div>
        <div className="text-sm text-text-muted">{data.user?.nrp ?? '—'}</div>
      </div>

      {/* Status utama */}
      <div className="text-center mb-5 p-4 rounded-2xl bg-primary/5 border border-primary/20">
        <div className="text-lg font-semibold text-text-primary">
          {isCheckedIn
            ? 'Sudah Keluar'
            : isCompleted
            ? 'Sudah Kembali'
            : 'Menunggu Keluar'}
        </div>
      </div>

      {/* Waktu Keluar */}
      <div className="mb-4 space-y-2 border-l-4 border-primary/40 pl-4">
        <div className="text-sm text-text-muted flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Waktu Keluar</span>
        </div>
        <div className="flex justify-between items-center">
          {data.actual_keluar && (
            <div className="text-right">
              <div className="text-xs text-text-secondary mb-1">Waktu Aktual</div>
              <div className="font-mono text-sm font-semibold text-success flex items-center gap-2">
                {formatTimeWithDate(data.actual_keluar)}
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </div>
          ) || (
            <div className="text-xs text-text-muted">Belum ada scan keluar</div>
          )}
        </div>
      </div>

      {/* Waktu Kembali */}
      {isCheckedIn || isCompleted ? (
        <div className="space-y-2 border-l-4 border-success/40 pl-4">
          <div className="text-sm text-text-muted flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Waktu Kembali</span>
          </div>
          <div className="flex justify-between items-center">
            {data.actual_kembali ? (
              <div className="text-right">
                <div className="text-xs text-text-secondary mb-1">Waktu Aktual</div>
                <div className="font-mono text-sm font-semibold text-success flex items-center gap-2">
                  {formatTimeWithDate(data.actual_kembali)}
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
              </div>
            ) : (
              isCheckedIn && (
                <div className="text-right">
                  <div className="text-xs text-accent-gold mb-1">Dalam Proses</div>
                  <div className="text-sm text-accent-gold">Menunggu scan kembali...</div>
                </div>
              )
            )}
          </div>
        </div>
      ) : null}

      {/* Action badges */}
      {status === 'checked_in' && !data.actual_kembali && (
        <div className="mt-5 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-primary text-sm font-semibold gap-2">
            <AlertCircle className="h-4 w-4" />
            Scan kembali untuk masuk
          </span>
        </div>
      )}
      {data.status === 'approved' && !data.actual_keluar && (
        <div className="mt-5 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-2 text-emerald-700 text-sm font-semibold gap-2">
            <CheckCircle className="h-4 w-4" />
            Siap untuk keluar
          </span>
        </div>
      )}
    </div>
  );
}
