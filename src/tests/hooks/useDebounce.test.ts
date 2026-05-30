import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/features/shared/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );
    rerender({ value: 'updated' });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('initial');
  });

  it('updates value after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );
    rerender({ value: 'updated' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('updated');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('b');
  });

  it('debounces rapid successive changes (only last wins)', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'd' });
    // Only 200ms total — still below 300ms from the last change
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');
    // Now let the 300ms timer for 'd' fire
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('d');
  });

  it('works with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useDebounce(value, 200),
      { initialProps: { value: 1 } }
    );
    rerender({ value: 42 });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe(42);
  });

  it('cleans up timer on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );
    rerender({ value: 'changed' });
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('respects custom delay', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 1000),
      { initialProps: { value: 'x' } }
    );
    rerender({ value: 'y' });
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current).toBe('x');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('y');
    unmount();
    vi.useRealTimers();
  });
});
