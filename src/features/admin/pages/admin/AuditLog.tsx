import { useState } from 'react';
import { Search } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Input from '../../components/common/Input';
import Pagination from '../../components/ui/Pagination';
import PageHeader from '../../components/ui/PageHeader';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { TableSkeleton } from '../../components/common/Skeleton';
import type { AuditLog } from '../../types';

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [searchRaw, setSearchRaw] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const search = useDebounce(searchRaw, 300);
  const { logs, isLoading } = useAuditLogs({ limit: 1000 });

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      l.action.toLowerCase().includes(q) ||
      (l.user?.nama?.toLowerCase().includes(q) ?? false) ||
      (l.user?.nrp?.includes(search) ?? false) ||
      (l.resource?.toLowerCase().includes(q) ?? false);
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const { currentPage, totalPages, totalItems, paginated, setPage } = usePagination(filtered, PAGE_SIZE);

  // Collect unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  return (
    <DashboardLayout title="Audit Log">
      <div className="space-y-5">
        <PageHeader
          title="Audit Log"
          subtitle="Lacak aktivitas sistem untuk keperluan monitoring dan investigasi operasional."
          meta={<span>Total catatan: {filtered.length}</span>}
        />

        {/* Filters */}
        <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
          <Input
            type="text"
            placeholder="Cari aksi, nama, atau NRP..."
            value={searchRaw}
            onChange={(e) => { setSearchRaw(e.target.value); setPage(1); }}
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            className="flex-1"
          />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="form-control sm:w-56"
          >
            <option value="">Semua Aksi</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : (
          <>
            <Table<AuditLog>
              columns={[
                {
                  key: 'created_at',
                  header: 'Waktu',
                  render: (l) => (
                    <span className="font-mono text-xs text-text-muted">
                      {new Date(l.created_at).toLocaleString('id-ID')}
                    </span>
                  ),
                },
                {
                  key: 'user',
                  header: 'Pengguna',
                  render: (l) => l.user ? (
                    <div>
                      <div className="font-medium text-text-primary">{l.user.nama}</div>
                      <div className="font-mono text-xs text-text-muted">{l.user.nrp}</div>
                    </div>
                  ) : <span className="text-text-muted">—</span>,
                },
                {
                  key: 'action',
                  header: 'Aksi',
                  render: (l) => (
                    <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{l.action}</span>
                  ),
                },
                { key: 'resource', header: 'Sumber Daya', render: (l) => l.resource ?? '—' },
                {
                  key: 'detail',
                  header: 'Detail',
                  render: (l) => l.detail ? (
                    <span className="text-xs text-text-muted truncate max-w-xs block">
                      {JSON.stringify(l.detail)}
                    </span>
                  ) : '—',
                },
              ]}
              data={paginated}
              keyExtractor={(l) => l.id}
              isLoading={false}
              emptyMessage="Tidak ada log aktivitas"
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              compactOnMobile
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
