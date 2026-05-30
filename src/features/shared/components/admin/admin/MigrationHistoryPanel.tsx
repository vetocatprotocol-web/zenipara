import { useMigrationHistory } from '../../hooks/useMigrationHistory';
import { CardListSkeleton } from '../common/Skeleton';
import type { MigrationRecord } from '../../hooks/useMigrationHistory';

export default function MigrationHistoryPanel() {
  const { migrations, isLoading, error } = useMigrationHistory();

  if (isLoading) {
    return <CardListSkeleton count={3} />;
  }

  if (error) {
    return (
      <div className="app-card border border-accent-red/20 bg-accent-red/5 p-4 text-sm text-accent-red">
        Gagal memuat riwayat migrasi: {error}
      </div>
    );
  }

  if (migrations.length === 0) {
    return (
      <div className="app-card border border-dashed border-surface/50 p-6 text-center text-text-muted">
        Belum ada riwayat migrasi
      </div>
    );
  }

  return (
    <div className="app-card divide-y divide-surface/50">
      <div className="p-4 sm:p-5">
        <h3 className="font-semibold text-text-primary text-sm">Riwayat Migrasi Database</h3>
        <p className="text-xs text-text-muted mt-1">Daftar migrasi yang telah diterapkan</p>
      </div>
      <div className="divide-y divide-surface/30 max-h-96 overflow-y-auto">
        {migrations.slice(0, 20).map((m: MigrationRecord) => (
          <div key={m.id} className="p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs bg-surface/40 px-2 py-1 rounded w-fit mb-2">
                {m.version}
              </div>
              <p className="text-sm font-medium text-text-primary truncate">{m.name}</p>
              <p className="text-xs text-text-muted mt-1">
                {new Date(m.appliedAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
              {m.executionTimeMs && (
                <p className="text-xs text-text-muted">Durasi: {m.executionTimeMs}ms</p>
              )}
            </div>
            <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
              m.status === 'applied'
                ? 'bg-success/20 text-success'
                : 'bg-accent-yellow/20 text-accent-yellow'
            }`}>
              {m.status === 'applied' ? 'Diterapkan' : 'Tertunda'}
            </span>
          </div>
        ))}
      </div>
      {migrations.length > 20 && (
        <div className="p-3 text-xs text-text-muted text-center border-t border-surface/30">
          +{migrations.length - 20} migrasi lainnya
        </div>
      )}
    </div>
  );
}
