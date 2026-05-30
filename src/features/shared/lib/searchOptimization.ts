/**
 * Search optimization utilities
 * - Request deduplication for identical search queries
 * - Result caching with TTL
 */

import { CacheWithTTL } from './cacheWithTTL';
import { requestCoalescer } from './requestCoalescer';

type SearchFn<T> = (query: string) => Promise<T[]>;

interface SearchCache<T> {
  cache: CacheWithTTL<string, T[]>;
  coalesce: (query: string, fn: SearchFn<T>) => Promise<T[]>;
}

/**
 * Create a search cache with automatic deduplication
 * Useful for avoiding duplicate API calls when multiple components
 * search for the same query simultaneously
 *
 * @param cacheTTLMs - How long to cache results (default 60 seconds)
 * @returns Object with cache management and coalesced search
 */
export function createSearchCache<T>(cacheTTLMs = 60000): SearchCache<T> {
  const cache = new CacheWithTTL<string, T[]>(cacheTTLMs);

  return {
    cache,
    coalesce: async (query: string, fn: SearchFn<T>): Promise<T[]> => {
      // Check cache first
      const cached = cache.get(query);
      if (cached) {
        return cached;
      }

      // Use request coalescing to prevent multiple requests for same query
      const key = `search:${query}`;
      const result = await requestCoalescer.coalesce(key, () => fn(query));

      // Cache the result
      cache.set(query, result);
      return result;
    },
  };
}

/**
 * Hook for searching with local filtering
 * Good for small datasets that fit in memory
 * Provides debounced search results
 */
export function useLocalSearch<T>(
  items: T[],
  searchFn: (items: T[], query: string) => T[],
  debounceDelayMs = 300,
) {
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastQuery = '';

  return {
    search: (query: string): Promise<T[]> => {
      return new Promise((resolve) => {
        lastQuery = query;

        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }

        searchTimeout = setTimeout(() => {
          if (lastQuery === query) {
            // Only return if query is still current
            const results = searchFn(items, query);
            resolve(results);
          }
        }, debounceDelayMs);
      });
    },

    cancel: () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    },
  };
}
