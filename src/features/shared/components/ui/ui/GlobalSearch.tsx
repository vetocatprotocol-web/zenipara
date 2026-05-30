import { ICONS } from '../../icons';
import { useState, useEffect, useCallback, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import { searchAll, type SearchResult as ApiSearchResult } from '../../lib/api/search';
import { isPathEnabled } from '../../lib/featureFlags';
import { readSessionContext } from '../../lib/sessionContext';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useDebounce } from '../../hooks/useDebounce';
import { handleError } from '../../lib/handleError';
import { APP_ROUTE_PATHS, getGlobalSearchResultPath, getRoleDefaultPath } from '../../lib/rolePermissions';

interface SearchResult extends ApiSearchResult {
  href: string;
  icon: keyof typeof ICONS;
}

function buildHref(result: ApiSearchResult): string {
  return getGlobalSearchResultPath(result.type, result.role);
}

const TYPE_ICON: Record<ApiSearchResult['type'], keyof typeof ICONS> = {
  task: 'ClipboardCheck',
  user: 'Users',
  announcement: 'Megaphone',
};

const LISTBOX_ID = 'global-search-listbox';

export default function GlobalSearch() {
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const sessionContext = readSessionContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFocusedOnOpenRef = useRef(false);
  const query = useDebounce(rawQuery, 300);

  const activeRole = user?.role ?? sessionContext?.role;

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !activeRole) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    setIsLoading(true);
    try {
      const apiResults = await searchAll({ query: q, callerRole: activeRole });
      setResults(
        apiResults.map((r) => ({
          ...r,
          href: buildHref(r),
          icon: TYPE_ICON[r.type],
        })).filter((r) => isPathEnabled(r.href, flags)),
      );
      setActiveIndex(-1);
    } catch (err) {
      if (import.meta.env.DEV) console.error(handleError(err, 'Gagal mencari data'));
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, flags]);

  useEffect(() => {
    void search(query);
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target
        && (target.tagName === 'INPUT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'SELECT'
          || target.isContentEditable),
      );

      if (isTypingTarget) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      hasFocusedOnOpenRef.current = false;
      return;
    }

    if (hasFocusedOnOpenRef.current) return;
    hasFocusedOnOpenRef.current = true;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 639px)').matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const openSearch = () => {
    setIsOpen(true);
  };

  const closeSearch = () => {
    setIsOpen(false);
    setRawQuery('');
    setResults([]);
    setActiveIndex(-1);
  };

  const handleSelect = (result: SearchResult) => {
    closeSearch();
    if (isPathEnabled(result.href, flags)) {
      navigate(result.href);
      return;
    }
    const safeRole = activeRole ?? 'prajurit';
    navigate(getRoleDefaultPath(safeRole) ?? APP_ROUTE_PATHS.login);
  };

  /** Handle keyboard navigation inside the search overlay */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSearch();
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(results.length - 1);
    }
  };

  const activeOptionId = activeIndex >= 0 ? `search-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative" data-print-hide>
      {/* Search trigger button */}
      <button
        onClick={openSearch}
        className="search-trigger text-sm"
        aria-label="Cari (Ctrl+K)"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <span className="hidden sm:block">Cari...</span>
        <kbd className="hidden rounded border border-surface bg-white px-1.5 py-0.5 text-[10px] sm:block dark:bg-bg-card">⌃K</kbd>
      </button>

      {/* Search modal/dropdown */}
      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Tutup pencarian"
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] sm:hidden"
            onClick={closeSearch}
          />
          <div
            className="app-panel fixed inset-x-3 z-50 overflow-hidden rounded-2xl animate-slide-up top-[calc(env(safe-area-inset-top,0px)+0.75rem)] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:absolute sm:right-0 sm:top-full sm:bottom-auto sm:inset-x-auto sm:mt-2 sm:w-[min(92vw,460px)] sm:animate-slide-in"
            role="dialog"
            aria-label="Pencarian global"
            aria-modal="true"
          >
            {/* Input */}
            <div className="flex items-center gap-2 border-b border-surface/80 px-4 py-3">
              <svg className="h-4 w-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={inputRef}
                id="global-search-input"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={results.length > 0}
                aria-controls={LISTBOX_ID}
                aria-activedescendant={activeOptionId}
                placeholder="Cari tugas, personel, pengumuman..."
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                autoComplete="off"
              />
              {isLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-primary flex-shrink-0" aria-hidden="true" />
              )}
              <button
                onClick={closeSearch}
                className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-slate-100 hover:text-text-primary dark:hover:bg-surface/50"
                aria-label="Tutup pencarian"
              >
                Tutup
              </button>
            </div>

            {/* Results */}
            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Hasil pencarian"
              className="max-h-full overflow-y-auto"
            >
              {rawQuery && results.length === 0 && !isLoading && (
                <p className="px-4 py-6 text-center text-sm text-text-muted" role="status">
                  Tidak ada hasil untuk &ldquo;{rawQuery}&rdquo;
                </p>
              )}
              {!rawQuery && (
                <p className="px-4 py-6 text-center text-sm text-text-muted">
                  Ketik untuk mencari tugas, personel, atau pengumuman
                </p>
              )}
              {results.map((r, idx) => {
                const Icon = ICONS[r.icon];
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={r.id}
                    id={`search-option-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-slate-50 dark:hover:bg-surface/55'
                    }`}
                  >
                    <span className="flex-shrink-0 mt-0.5">
                      {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                      <p className="text-xs text-text-muted truncate mt-0.5">{r.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {results.length > 0 && (
              <div className="border-t border-surface/80 px-4 py-2 text-center text-xs text-text-muted">
                {results.length} hasil — gunakan ↑↓ untuk navigasi, Enter untuk pilih
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
