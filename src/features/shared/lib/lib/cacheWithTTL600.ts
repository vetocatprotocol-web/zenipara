/**
 * Search Cache with TTL - Cache API responses with time-based expiration
 * Useful for 600+ user management to reduce API calls
 */

import type { User } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

type UserSearchCacheValue = { users: User[]; total: number };

export class CacheWithTTL<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;

  constructor(defaultTTL = 5 * 60 * 1000) {
    // Default 5 minutes
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached value if still valid (within TTL)
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache value with optional custom TTL
   */
  set(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  /**
   * Check if value exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get or set value (if not in cache, call fetcher and cache result)
   */
  async getOrSet(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Clear stale entries (older than TTL)
   */
  clearStale(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }
}

/**
 * Global search cache for users (2 minutes TTL)
 */
export const userSearchCache = new CacheWithTTL<UserSearchCacheValue>(2 * 60 * 1000);

/**
 * Global filter options cache (10 minutes TTL, filters change less frequently)
 */
export const filterOptionsCache = new CacheWithTTL<unknown[]>(10 * 60 * 1000);

/**
 * Create cache key for user search
 */
export function createUserSearchCacheKey(
  search?: string,
  role?: string,
  satuan?: string,
  isActive?: boolean,
  page = 1,
  pageSize = 50
): string {
  const key = [
    'users-search',
    search?.trim() || 'all',
    role || 'all-roles',
    satuan || 'all-satuan',
    isActive === undefined ? 'all-status' : isActive ? 'active' : 'inactive',
    `page-${page}`,
    `size-${pageSize}`,
  ].join(':');
  return key;
}

/**
 * Create cache key for filter options
 */
export function createFilterCacheKey(filterType: string, satuan?: string): string {
  return `filter-${filterType}${satuan ? `:${satuan}` : ''}`;
}
