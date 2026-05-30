/**
 * RequestCoalescer - Prevent duplicate simultaneous requests to the same endpoint
 * Coalesces identical requests within a given time window (default 100ms)
 * Useful for 600+ user management where multiple components might request same data
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  resolvedTime: number;
}

export class RequestCoalescer {
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly timeWindow: number;

  constructor(timeWindow = 100) {
    this.timeWindow = timeWindow;
  }

  /**
   * Coalesce identical requests within time window
   * If same request is made within timeWindow, return cached promise
   */
  async coalesce<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const pending = this.pendingRequests.get(key) as PendingRequest<T> | undefined;

    // Return cached promise if still within time window
    if (pending && now - pending.resolvedTime < this.timeWindow) {
      return pending.promise;
    }

    // Create new request
    const promise = fetcher()
      .then((result) => {
        this.pendingRequests.set(key, {
          promise: Promise.resolve(result),
          resolvedTime: Date.now(),
        });
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, {
      promise: promise as Promise<T>,
      resolvedTime: now,
    });

    return promise;
  }

  /**
   * Clear a specific cached request
   */
  clear(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all cached requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Global singleton instance
export const globalRequestCoalescer = new RequestCoalescer(100);

/**
 * Create a request key from params
 * Used for consistent caching keys
 */
export function createRequestKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}
