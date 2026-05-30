import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/features/shared/hooks/usePagination';

describe('usePagination', () => {
  it('starts at page 1', () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.currentPage).toBe(1);
  });

  it('calculates totalPages correctly', () => {
    const { result } = renderHook(() => usePagination(Array.from({ length: 55 }), 10));
    expect(result.current.totalPages).toBe(6);
  });

  it('returns totalPages of 1 for empty array', () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.totalPages).toBe(1);
  });

  it('returns all items on page 1 when data fits', () => {
    const data = [1, 2, 3];
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.paginated).toEqual([1, 2, 3]);
  });

  it('slices data correctly for page 2', () => {
    const data = Array.from({ length: 15 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));

    act(() => result.current.setPage(2));
    expect(result.current.paginated).toEqual([10, 11, 12, 13, 14]);
  });

  it('clamps page to totalPages when out of bounds', () => {
    const data = Array.from({ length: 5 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));

    act(() => result.current.setPage(99));
    expect(result.current.currentPage).toBe(1);
  });

  it('uses default pageSize of 50', () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data));
    expect(result.current.totalPages).toBe(2);
    expect(result.current.paginated).toHaveLength(50);
  });

  it('reports correct totalItems', () => {
    const data = Array.from({ length: 37 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.totalItems).toBe(37);
  });

  it('last page may have fewer items than pageSize', () => {
    const data = Array.from({ length: 23 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(3));
    expect(result.current.paginated).toHaveLength(3);
  });

  it('handles pageSize larger than data length', () => {
    const data = [10, 20, 30];
    const { result } = renderHook(() => usePagination(data, 100));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.paginated).toEqual([10, 20, 30]);
  });

  it('setPage updates currentPage', () => {
    const data = Array.from({ length: 50 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(4));
    expect(result.current.currentPage).toBe(4);
  });

  it('returns exactly pageSize items for full pages', () => {
    const data = Array.from({ length: 30 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.paginated).toHaveLength(10);
    act(() => result.current.setPage(2));
    expect(result.current.paginated).toHaveLength(10);
  });
});
