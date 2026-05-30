/**
 * Request coalescing/deduplication utility
 * Prevents multiple simultaneous requests to the same endpoint/function
 * by returning the same promise if a request is already in progress.
 *
 * Use case: If multiple components mount and call fetchData() simultaneously,
 * only 1 actual request happens, and all get the same result.
 */

type RequestKey = string | number | symbol;
type RequestFn<T> = () => Promise<T>;

class RequestCoalescer {
  private pendingRequests = new Map<RequestKey, Promise<unknown>>();

  /**
   * Executes a request, coalescing identical simultaneous requests.
   * @param key Unique identifier for this request type
   * @param fn The async function to execute
   * @returns Promise that resolves with the result
   */
  async coalesce<T>(key: RequestKey, fn: RequestFn<T>): Promise<T> {
    // If a request for this key is already in progress, return it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Start new request
    const promise = fn()
      .then((result) => {
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise as Promise<T>;
  }

  /**
   * Clear a specific request from the cache
   */
  clear(key: RequestKey): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
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

// Global instance
export const requestCoalescer = new RequestCoalescer();

/**
 * Hook for React components to use request coalescing
 */
export function useRequestCoalescing() {
  return {
    coalesce: <T,>(key: RequestKey, fn: RequestFn<T>) => requestCoalescer.coalesce(key, fn),
    clearCache: (key?: RequestKey) => (key ? requestCoalescer.clear(key) : requestCoalescer.clearAll()),
  };
}
