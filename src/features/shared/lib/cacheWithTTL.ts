/**
 * Simple cache with TTL (time-to-live) support
 * Useful for caching API responses that don't change frequently
 *
 * Example:
 *   const cache = new CacheWithTTL(60000); // 60 second TTL
 *   cache.set('users_list', [user1, user2]);
 *   const users = cache.get('users_list'); // Returns cached value if not expired
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheWithTTL<K extends string | number | symbol = string, V = unknown> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs: number = 300000) {
    // Default 5 minutes
    this.defaultTTL = defaultTTLMs;
  }

  /**
   * Set value in cache with optional TTL override
   */
  set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get value from cache if not expired, otherwise return undefined
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key
   */
  delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    // Clean up expired entries while counting
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }

  /**
   * Get value or compute with function if not in cache
   */
  async computeIfAbsent<T extends V>(
    key: K,
    computeFn: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get(key) as T | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const computed = await computeFn();
    this.set(key, computed, ttlMs);
    return computed;
  }
}
