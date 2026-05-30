interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optional: show "X–Y of Z" label */
  totalItems?: number;
  pageSize?: number;
  /** Compact page-number buttons on mobile to reduce crowding */
  compactOnMobile?: boolean;
  /** Additional class for pagination wrapper */
  containerClassName?: string;
}

/**
 * Pagination bar — spec §13.2: 50 rows per page.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 50,
  compactOnMobile = false,
  containerClassName = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems ?? currentPage * pageSize);

  return (
    <div className={`mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-surface/70 bg-bg-card/55 px-3 py-2 sm:flex-row ${containerClassName}`.trim()}>
      {totalItems !== undefined && (
        <p className="text-xs text-text-muted">
          Menampilkan {from}–{to} dari {totalItems} data
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="touch-target-sm rounded-lg border border-surface/70 bg-surface/35 px-3 text-sm text-text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          ←
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span
              key={`e${idx}`}
              className={`px-2 text-sm select-none text-text-muted ${compactOnMobile ? 'hidden sm:inline-flex' : ''}`}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`touch-target-sm rounded-lg px-2 text-sm font-medium transition-colors ${
                p === currentPage ? 'bg-primary text-white' : 'border border-surface/70 bg-surface/35 text-text-muted hover:bg-surface'
              } ${compactOnMobile && p !== currentPage && p !== 1 && p !== totalPages ? 'hidden sm:inline-flex' : ''}`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="touch-target-sm rounded-lg border border-surface/70 bg-surface/35 px-3 text-sm text-text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          →
        </button>
      </div>
    </div>
  );
}
