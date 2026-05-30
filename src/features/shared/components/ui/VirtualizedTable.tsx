import { ReactNode, useRef } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import EmptyState from '../common/EmptyState';
import { useUIStore } from '../../store/uiStore';

interface Column<T> {
  key: keyof T | string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  caption?: string;
  onRowClick?: (row: T) => void;
  rowHeight?: number;
  overscan?: number;
  maxHeight?: string;
}

/**
 * VirtualizedTable — Tabel dengan virtual scrolling untuk performa optimal dengan dataset besar.
 * Hanya me-render row yang visible di viewport + overscan buffer.
 * Cocok untuk 600+ rows, mengurangi DOM nodes dari 600+ menjadi ~20 visible rows.
 */
export default function VirtualizedTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = 'Tidak ada data',
  caption,
  onRowClick,
  rowHeight = 52,
  overscan = 10,
  maxHeight = '70vh',
}: VirtualizedTableProps<T>) {
  const { displayDensity } = useUIStore();
  const isCompact = displayDensity === 'compact';
  
  const headerCellClass = isCompact
    ? 'px-3 py-2 text-[10px] sm:px-4'
    : 'px-3 py-3 text-[11px] sm:px-5';
  const bodyCellClass = isCompact
    ? 'px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm'
    : 'px-3 py-3 text-xs sm:px-5 sm:py-4 sm:text-sm';

  const scrollerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom = virtualItems.length > 0 
    ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) 
    : 0;

  if (isLoading) {
    return (
      <div className="app-panel overflow-hidden rounded-2xl border border-surface/70 shadow-sm">
        <div className="border-b border-surface/70 px-4 py-3 text-xs font-medium text-text-muted sm:px-5">
          Memuat data tabel...
        </div>
        <div className="space-y-2 p-4 sm:p-5">
          {Array.from({ length: 5 }).map((_, idx) => {
            const primaryW = [65, 77, 55, 82, 70][idx] ?? 65;
            const secondW = [50, 62, 45, 70, 55][idx] ?? 50;
            const thirdW = [40, 55, 38, 62, 48][idx] ?? 40;
            const fourthW = [60, 68, 52, 75, 63][idx] ?? 60;
            return (
              <div key={idx} className="grid gap-3 rounded-xl border border-surface/60 bg-bg-card px-4 py-3 sm:grid-cols-[1.2fr_1fr_0.8fr_1fr]">
                <div className="h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-surface/70" style={{ width: `${primaryW}%` }} />
                <div className="hidden sm:block h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-surface/70" style={{ width: `${secondW}%` }} />
                <div className="hidden sm:block h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-surface/70" style={{ width: `${thirdW}%` }} />
                <div className="hidden sm:block h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-surface/70" style={{ width: `${fourthW}%` }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="app-panel overflow-hidden rounded-2xl border border-surface/70 shadow-sm">
        <div className="px-3 py-12 text-center sm:px-5">
          <EmptyState
            title="Data belum tersedia"
            description={emptyMessage}
            className="border-0 bg-transparent px-0 py-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-panel overflow-hidden rounded-2xl border border-surface/70 shadow-sm flex flex-col">
      <div className="border-b border-surface/70 px-4 py-2 text-[11px] text-text-muted sm:hidden">
        Geser tabel ke samping untuk melihat semua kolom
      </div>
      <div ref={scrollerRef} style={{ overflow: 'auto', maxHeight }} className="flex-1">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="sticky top-0 z-[2]">
              <tr className="border-b border-surface bg-slate-50/95 backdrop-blur-sm dark:bg-surface/45">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`${headerCellClass} text-left font-bold uppercase tracking-[0.08em] text-text-muted ${col.className ?? ''}`}
                    scope="col"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {paddingTop > 0 && (
                <tr style={{ height: `${paddingTop}px` }}>
                  <td colSpan={columns.length} />
                </tr>
              )}
              {virtualItems.map((virtualItem: VirtualItem) => {
                const row = data[virtualItem.index];
                if (!row) return null;
                const idx = virtualItem.index;
                return (
                  <tr
                    key={keyExtractor(row)}
                    style={{ height: `${virtualItem.size}px` }}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-surface/25 ${
                      idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-surface/10' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={`${bodyCellClass} text-text-primary ${col.className ?? ''}`}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr style={{ height: `${paddingBottom}px` }}>
                  <td colSpan={columns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
