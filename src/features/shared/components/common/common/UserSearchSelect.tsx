import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useUsers } from '../../hooks/useUsers';
import type { Role } from '../../types';

interface UserSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  roleFilter?: Role;
  satuan?: string;
  isActive?: boolean;
  excludeUserId?: string;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
  pageSize?: number;
  showRole?: boolean;
}

/**
 * UserSearchSelect
 *
 * Searchable + server-paginated picker untuk mencegah render ribuan <option>
 * saat data user sangat besar.
 */
export default function UserSearchSelect({
  value,
  onChange,
  roleFilter,
  satuan,
  isActive = true,
  excludeUserId,
  emptyLabel = 'Pilih personel...',
  placeholder = 'Cari nama atau NRP...',
  className,
  pageSize = 50,
  showRole = false,
}: UserSearchSelectProps) {
  const [queryRaw, setQueryRaw] = useState('');
  const query = useDebounce(queryRaw, 250);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, satuan, isActive, excludeUserId]);

  const {
    users,
    isLoading,
    totalItems,
    totalPages,
  } = useUsers({
    serverPaginated: true,
    page,
    pageSize,
    searchQuery: query,
    role: roleFilter,
    satuan,
    isActive,
    orderBy: 'nama',
    ascending: true,
  });

  const visibleUsers = useMemo(() => {
    if (!excludeUserId) return users;
    return users.filter((u) => u.id !== excludeUserId);
  }, [users, excludeUserId]);

  const hasSelectedInPage = visibleUsers.some((u) => u.id === value);

  return (
    <div className={className ?? 'space-y-2'}>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={queryRaw}
        onChange={(e) => setQueryRaw(e.target.value)}
      />

      <select
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {value && !hasSelectedInPage && (
          <option value={value}>Pilihan tersimpan (ID)</option>
        )}
        {visibleUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.pangkat ? `${u.pangkat} ` : ''}
            {u.nama}
            {u.nrp ? ` - ${u.nrp}` : ''}
            {showRole ? ` (${u.role})` : ''}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          {isLoading ? 'Memuat...' : `${totalItems} personel`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-surface/70 px-2 py-1 disabled:opacity-40"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>{page}/{totalPages}</span>
          <button
            type="button"
            className="rounded border border-surface/70 px-2 py-1 disabled:opacity-40"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
