import { useState } from 'react';

/**
 * Helper hook: slices `data` to the current page.
 */
export function usePagination<T>(data: T[], pageSize = 50) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = data.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { currentPage: safePage, totalPages, totalItems: data.length, paginated, setPage: setCurrentPage };
}
