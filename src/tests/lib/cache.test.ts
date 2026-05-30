import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimpleCache } from '@/features/shared/lib/cache';

describe('SimpleCache', () => {
  let cache: SimpleCache<string[]>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SimpleCache<string[]>(1000); // 1 second TTL for tests
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── get / set ─────────────────────────────────────────────
  it('returns null for a key that was never set', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns data immediately after being set', () => {
    cache.set('key1', ['a', 'b']);
    expect(cache.get('key1')).toEqual(['a', 'b']);
  });

  it('returns null after TTL has expired', () => {
    cache.set('key1', ['a']);
    vi.advanceTimersByTime(1001); // past 1 second TTL
    expect(cache.get('key1')).toBeNull();
  });

  it('still returns data just before TTL expires', () => {
    cache.set('key1', ['a']);
    vi.advanceTimersByTime(999);
    expect(cache.get('key1')).toEqual(['a']);
  });

  // ── has ────────────────────────────────────────────────────
  it('has() returns true for a fresh entry', () => {
    cache.set('k', ['x']);
    expect(cache.has('k')).toBe(true);
  });

  it('has() returns false for a missing key', () => {
    expect(cache.has('nope')).toBe(false);
  });

  it('has() returns false after TTL expires', () => {
    cache.set('k', ['x']);
    vi.advanceTimersByTime(1001);
    expect(cache.has('k')).toBe(false);
  });

  // ── invalidate ─────────────────────────────────────────────
  it('invalidate() removes a specific entry', () => {
    cache.set('k1', ['a']);
    cache.set('k2', ['b']);
    cache.invalidate('k1');

    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toEqual(['b']);
  });

  it('invalidate() on non-existent key does not throw', () => {
    expect(() => cache.invalidate('ghost')).not.toThrow();
  });

  // ── clear ──────────────────────────────────────────────────
  it('clear() removes all entries', () => {
    cache.set('k1', ['a']);
    cache.set('k2', ['b']);
    cache.clear();

    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBeNull();
  });

  // ── default TTL ───────────────────────────────────────────
  it('uses the default 5-minute TTL when not specified', () => {
    const defaultCache = new SimpleCache<number[]>();
    defaultCache.set('data', [1, 2, 3]);

    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    expect(defaultCache.get('data')).toEqual([1, 2, 3]);

    vi.advanceTimersByTime(2 * 60 * 1000); // total 6 minutes — past 5-min TTL
    expect(defaultCache.get('data')).toBeNull();
  });

  // ── overwrite ─────────────────────────────────────────────
  it('overwriting a key resets its TTL', () => {
    cache.set('key', ['old']);
    vi.advanceTimersByTime(800); // 800ms in

    cache.set('key', ['new']); // reset TTL
    vi.advanceTimersByTime(800); // 800ms more (1600ms total) — within new TTL

    expect(cache.get('key')).toEqual(['new']);
  });
});
