import { useState } from 'react';
import { Award, Search } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Table from '../../components/ui/Table';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import PageHeader from '../../components/ui/PageHeader';
import { RoleBadge } from '../../components/common/Badge';
import { TableSkeleton } from '../../components/common/Skeleton';
import UserDetailModal from '../../components/common/UserDetailModal';
import { useUsers } from '../../hooks/useUsers';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuthStore } from '../../store/authStore';
import { getKomandanScopeLabel, getKomandanScopeDescription, isRoleKomandan } from '../../lib/rolePermissions';
import type { User } from '../../types';

export default function Personnel() {
  const { user } = useAuthStore();
  const { users, isLoading, error, getUserById } = useUsers({ satuan: user?.satuan, isActive: true });

  const [searchRaw, setSearchRaw] = useState('');
  const [filterOnline, setFilterOnline] = useState<'all' | 'online' | 'offline'>('all');
  const search = useDebounce(searchRaw, 300);
  const [showDetail, setShowDetail] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      u.nama.toLowerCase().includes(q) ||
      u.nrp.includes(search) ||
      (u.pangkat?.toLowerCase().includes(q) ?? false) ||
      (u.jabatan?.toLowerCase().includes(q) ?? false);
    const matchOnline =
      filterOnline === 'all' ||
      (filterOnline === 'online' ? u.is_online : !u.is_online);
    return matchSearch && matchOnline;
  });

  const onlineCount = users.filter((u) => u.is_online).length;
  const offlineCount = Math.max(users.length - onlineCount, 0);
  const hasFilters = searchRaw.trim().length > 0 || filterOnline !== 'all';

  const handleOpenDetail = async (u: User) => {
    try {
      const full = await getUserById(u.id);
      setDetailUser(full);
    } catch {
      setDetailUser(u);
    }
    setShowDetail(true);
  };

  const scopeLabel = isRoleKomandan(user?.role) ? getKomandanScopeLabel(user?.level_komando) : null;
  const scopeDescription = isRoleKomandan(user?.role) ? getKomandanScopeDescription(user?.level_komando) : null;

  return (
    <DashboardLayout title="Data Personel">
      <div className="space-y-5">
        <PageHeader
          title="Data Personel"
          subtitle="Pantau status online, cari personel, dan lihat data keaktifan satuan secara cepat."
        />

        {/* Komandan scope info banner */}
        {scopeLabel && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
            <Award className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-primary">{scopeLabel}</p>
              <p className="mt-0.5 text-xs text-text-muted">{scopeDescription}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="app-card border border-surface/70 p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Personel Aktif</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">{users.length}</p>
            <p className="mt-1 text-xs text-text-muted">
              Cakupan satuan {user?.satuan || '—'}
            </p>
          </div>
          <div className="app-card border border-surface/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Online</p>
                <p className="mt-2 text-2xl font-bold text-success">{onlineCount}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-text-muted">Personel terlihat aktif saat ini</p>
          </div>
          <div className="app-card border border-surface/70 p-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Offline</p>
                <p className="mt-2 text-2xl font-bold text-text-muted">{offlineCount}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-text-muted/60" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-text-muted">Butuh monitoring kehadiran</p>
          </div>
        </div>

        {/* Filters */}
        <div className="app-card space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <Input
              type="text"
              placeholder="Cari nama, NRP, pangkat..."
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
              className="w-full"
            />
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface/40 p-1">
              {(['all', 'online', 'offline'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilterOnline(opt)}
                  aria-pressed={filterOnline === opt}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    filterOnline === opt ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {opt !== 'all' && (
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      opt === 'online' ? 'bg-success' : 'bg-text-muted/60'
                    }`} aria-hidden="true" />
                  )}
                  {opt === 'all' ? 'Semua' : opt === 'online' ? 'Online' : 'Offline'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              Filter status: {filterOnline === 'all' ? 'Semua' : filterOnline === 'online' ? 'Online' : 'Offline'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              Query: {searchRaw.trim() || 'Tidak ada'}
            </span>
            {hasFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchRaw('');
                  setFilterOnline('all');
                }}
                className="ml-auto"
              >
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-surface/60 bg-surface/10 px-4 py-2 text-xs text-text-muted">
          Menampilkan <span className="font-semibold text-text-primary">{filtered.length}</span> dari <span className="font-semibold text-text-primary">{users.length}</span> personel.
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <Table<User>
            columns={[
              {
                key: 'nrp',
                header: 'NRP',
                className: 'whitespace-nowrap',
                render: (u) => <span className="font-mono text-sm">{u.nrp}</span>,
              },
              { key: 'nama', header: 'Nama', className: 'min-w-[170px]' },
              {
                key: 'pangkat',
                header: 'Pangkat',
                className: 'hidden md:table-cell',
                render: (u) => u.pangkat ?? '—',
              },
              {
                key: 'jabatan',
                header: 'Jabatan',
                className: 'hidden lg:table-cell',
                render: (u) => u.jabatan ?? '—',
              },
              {
                key: 'role',
                header: 'Role',
                className: 'hidden md:table-cell',
                render: (u) => <RoleBadge role={u.role} />,
              },
              {
                key: 'is_online',
                header: 'Status',
                className: 'whitespace-nowrap',
                render: (u) => (
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${u.is_online ? 'bg-success animate-pulse' : 'bg-text-muted/40'}`} />
                    <span className={`text-xs ${u.is_online ? 'text-success' : 'text-text-muted'}`}>
                      {u.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ),
              },
              {
                key: 'last_login',
                header: 'Login Terakhir',
                className: 'hidden xl:table-cell whitespace-nowrap',
                render: (u) => u.last_login
                  ? new Date(u.last_login).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                  : '—',
              },
              {
                key: 'actions',
                header: 'Aksi',
                className: 'whitespace-nowrap',
                render: (u) => (
                  <Button size="sm" variant="secondary" onClick={() => handleOpenDetail(u)}>
                    Detail
                  </Button>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(u) => u.id}
            isLoading={false}
            minTableWidthClass="min-w-[520px]"
            caption="Tabel personel komandan dengan kolom responsif berdasarkan prioritas informasi"
            emptyMessage="Tidak ada personel ditemukan"
          />
        )}
      </div>

      <UserDetailModal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setDetailUser(null); }}
        user={detailUser}
        viewerRole="komandan"
        mode="view"
      />
    </DashboardLayout>
  );
}
