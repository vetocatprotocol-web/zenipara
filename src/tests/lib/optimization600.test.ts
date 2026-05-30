/**
 * Performance tests for 600+ user management optimization
 * Verify virtual scrolling, caching, and request coalescing work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestCoalescer, globalRequestCoalescer, createRequestKey } from '@/features/shared/lib/requestCoalescer600';
import { CacheWithTTL, createUserSearchCacheKey } from '@/features/shared/lib/cacheWithTTL600';

describe('RequestCoalescer - 600+ User Optimization', () => {
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    coalescer = new RequestCoalescer(100);
  });

  it('should coalesce identical requests within time window', async () => {
    const fetcher = vi.fn(async () => ({ data: 'result' }));
    
    // Make 3 identical requests simultaneously
    const promises = [
      coalescer.coalesce('test-key', fetcher),
      coalescer.coalesce('test-key', fetcher),
      coalescer.coalesce('test-key', fetcher),
    ];

    const results = await Promise.all(promises);
    
    // All should return same result
    expect(results).toEqual([{ data: 'result' }, { data: 'result' }, { data: 'result' }]);
    
    // Fetcher should only be called once (coalesced)
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should create different requests for different keys', async () => {
    const fetcher1 = vi.fn(async () => ({ data: 'result1' }));
    const fetcher2 = vi.fn(async () => ({ data: 'result2' }));

    const [r1, r2] = await Promise.all([
      coalescer.coalesce('key1', fetcher1),
      coalescer.coalesce('key2', fetcher2),
    ]);

    expect(r1).toEqual({ data: 'result1' });
    expect(r2).toEqual({ data: 'result2' });
    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });

  it('should handle request errors gracefully', async () => {
    const error = new Error('Test error');
    const fetcher = vi.fn(async () => {
      throw error;
    });

    try {
      await coalescer.coalesce('error-key', fetcher);
    } catch (e) {
      expect(e).toBe(error);
    }

    // Error cache should be cleared
    expect(coalescer.getPendingCount()).toBe(0);
  });

  it('should support custom time windows', async () => {
    const shortCoalescer = new RequestCoalescer(50);
    const fetcher = vi.fn(async () => ({ data: 'result' }));

    // First request
    await shortCoalescer.coalesce('key', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Wait and make another request (within window)
    await new Promise(resolve => setTimeout(resolve, 30));
    await shortCoalescer.coalesce('key', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); // Still 1, coalesced

    // Wait beyond window and make another request
    await new Promise(resolve => setTimeout(resolve, 40));
    await shortCoalescer.coalesce('key', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // Now called again
  });

  it('should create consistent request keys', () => {
    const key1 = createRequestKey('users', { page: 1, search: 'budi' });
    const key2 = createRequestKey('users', { search: 'budi', page: 1 }); // Different order
    
    expect(key1).toBe(key2); // Should be same after sorting
  });
});

describe('CacheWithTTL - Search Result Caching', () => {
  let cache: CacheWithTTL<{ users: string[]; total: number }>;

  beforeEach(() => {
    cache = new CacheWithTTL(1000); // 1 second TTL for testing
  });

  it('should cache and retrieve values', () => {
    const data = { users: ['user1', 'user2'], total: 2 };
    cache.set('key1', data);
    
    expect(cache.get('key1')).toEqual(data);
  });

  it('should expire cached values after TTL', async () => {
    const data = { users: ['user1'], total: 1 };
    cache.set('key1', data, 100); // 100ms TTL
    
    expect(cache.get('key1')).toEqual(data);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('key1')).toBeNull();
  });

  it('should support getOrSet for lazy loading', async () => {
    const fetcher = vi.fn(async () => ({ users: ['user1'], total: 1 }));

    // First call - should fetch
    const result1 = await cache.getOrSet('key1', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({ users: ['user1'], total: 1 });

    // Second call - should use cache
    const result2 = await cache.getOrSet('key1', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); // Still 1, used cache
    expect(result2).toEqual(result1);
  });

  it('should clear stale entries', async () => {
    cache.set('key1', { users: [], total: 0 }, 100);
    cache.set('key2', { users: ['user1'], total: 1 });

    expect(cache.size()).toBe(2);

    // Wait for key1 to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const cleared = cache.clearStale();
    expect(cleared).toBe(1);
    expect(cache.size()).toBe(1);
    expect(cache.get('key2')).not.toBeNull();
  });

  it('should support custom TTL per entry', async () => {
    const data1 = { users: ['a'], total: 1 };
    const data2 = { users: ['b'], total: 1 };

    cache.set('key1', data1, 100); // 100ms
    cache.set('key2', data2, 500); // 500ms

    await new Promise(resolve => setTimeout(resolve, 200));

    // key1 expired, key2 still valid
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toEqual(data2);
  });
});

describe('User Search Cache Keys', () => {
  it('should create consistent cache keys for user searches', () => {
    const key1 = createUserSearchCacheKey('budi', 'admin_satuan', 'satuan1', true, 1, 50);
    const key2 = createUserSearchCacheKey('budi', 'admin_satuan', 'satuan1', true, 1, 50);
    
    expect(key1).toBe(key2);
  });

  it('should differentiate cache keys for different searches', () => {
    const key1 = createUserSearchCacheKey('budi', 'admin_satuan', undefined, true, 1, 50);
    const key2 = createUserSearchCacheKey('ahmad', 'admin_satuan', undefined, true, 1, 50);
    
    expect(key1).not.toBe(key2);
  });

  it('should differentiate cache keys for different pages', () => {
    const key1 = createUserSearchCacheKey('budi', 'admin_satuan', undefined, true, 1, 50);
    const key2 = createUserSearchCacheKey('budi', 'admin_satuan', undefined, true, 2, 50);
    
    expect(key1).not.toBe(key2);
  });
});

describe('Global Request Coalescer Integration', () => {
  it('should prevent duplicate bursts on filter changes', async () => {
    const fetcher = vi.fn(async () => ({ users: [] }));
    
    // Simulate burst of identical requests (e.g., from rapid filter changes)
    const burst = Array.from({ length: 5 }).map(() =>
      globalRequestCoalescer.coalesce('burst-test', fetcher)
    );

    await Promise.all(burst);
    
    // Should only call fetcher once due to coalescing
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
