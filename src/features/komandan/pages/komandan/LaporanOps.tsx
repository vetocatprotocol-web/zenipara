import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/common/EmptyState';
import { CardListSkeleton } from '../../components/common/Skeleton';
import { useUIStore } from '../../store/uiStore';
import { useLaporanOps } from '../../hooks/useLaporanOps';
import type { LaporanOpsStatus } from '../../types';
import { useState } from 'react';

const STATUS_BADGE: Record<LaporanOpsStatus, 'neutral' | 'warning' | 'info' | 'success'> = {
  draft:       'neutral',
  diajukan:    'warning',
  diketahui:   'success',
  diarsipkan:  'info',
};

const STATUS_LABEL: Record<LaporanOpsStatus, string> = {
  draft:       'Draft',
  diajukan:    'Diajukan',
  diketahui:   'Diketahui',
  diarsipkan:  'Diarsipkan',
};

export default function KomandanLaporanOpsPage() {
  const { showNotification } = useUIStore();
  const { laporan, isLoading, updateStatus } = useLaporanOps();
  const [filterStatus, setFilterStatus] = useState('diajukan');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleDiketahui = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await updateStatus(id, 'diketahui');
      showNotification('Laporan ditandai diketahui', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal memproses laporan', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleArsipkan = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await updateStatus(id, 'diarsipkan');
      showNotification('Laporan diarsipkan', 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengarsipkan', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filterStatus
    ? laporan.filter((l) => l.status === filterStatus)
    : laporan;

  const diajukanCount = laporan.filter((l) => l.status === 'diajukan').length;

  return (
    <DashboardLayout title="Laporan Operasional">
      <PageHeader
        title="Laporan Operasional"
        subtitle={diajukanCount > 0 ? `${diajukanCount} laporan menunggu persetujuan` : 'Review laporan S-3'}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'diajukan', 'diketahui', 'diarsipkan'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              filterStatus === s
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-white/10 text-text-muted hover:border-primary/40'
            }`}
          >
            {s === '' ? 'Semua' : STATUS_LABEL[s as LaporanOpsStatus]}
            {s === 'diajukan' && diajukanCount > 0 && (
              <span className="ml-1 bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {diajukanCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak ada laporan"
          description={filterStatus === 'diajukan' ? 'Tidak ada laporan yang menunggu persetujuan.' : 'Tidak ada laporan dengan status ini.'}
        />
      ) : (
        <Table
          columns={[
            {
              key: 'nomor_laporan',
              header: 'Nomor',
              render: (row) => <span className="text-xs font-mono text-text-muted">{row.nomor_laporan ?? '—'}</span>,
            },
            {
              key: 'tanggal_kejadian',
              header: 'Tanggal',
              render: (row) => new Date(row.tanggal_kejadian).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            },
            { key: 'judul', header: 'Judul', render: (row) => row.judul },
            {
              key: 'pembuat',
              header: 'Dibuat Oleh',
              render: (row) => {
                const p = row.pembuat;
                return p ? `${p.pangkat ?? ''} ${p.nama}`.trim() : '—';
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
            },
            {
              key: 'id',
              header: 'Aksi',
              render: (row) => (
                <div className="flex gap-1">
                  {row.status === 'diajukan' && (
                    <Button
                      size="sm"
                      onClick={() => { void handleDiketahui(row.id); }}
                      isLoading={processingId === row.id}
                    >
                      Diketahui
                    </Button>
                  )}
                  {row.status === 'diketahui' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { void handleArsipkan(row.id); }}
                      isLoading={processingId === row.id}
                    >
                      Arsipkan
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(row) => row.id}
        />
      )}
    </DashboardLayout>
  );
}
