/**
 * 600+ User Optimization - Realtime subscriptions optimization
 * Prevents memory leaks and excessive subscriptions with many users
 */

import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// 1. Optimized realtime subscription manager
// ============================================================

interface SubscriptionConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  debounceMs?: number;
  maxListeners?: number;
}

class OptimizedRealtimeSubscriber {
  private subscriptions = new Map<string, RealtimeChannel>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceMs = 300; // Default 300ms debounce for 600+ users
  private maxSubscriptions = 10; // Prevent too many concurrent subscriptions

  /**
   * Subscribe to table with debouncing to prevent cascade updates
   */
  subscribe(config: SubscriptionConfig, callback: () => Promise<void> | void) {
    const key = `${config.table}:${config.event ?? '*'}:${config.filter ?? 'all'}`;

    // Prevent duplicate subscriptions
    if (this.subscriptions.has(key)) {
      console.warn(`[Realtime] Already subscribed to ${key}`);
      return this.subscriptions.get(key)!;
    }

    // Prevent subscription explosion
    if (this.subscriptions.size >= this.maxSubscriptions) {
      console.warn(`[Realtime] Max subscriptions (${this.maxSubscriptions}) reached, skipping new subscription`);
      return null;
    }

    const channel = supabase.channel(key);

    // Add event listener with debouncing
    channel.on(
      'postgres_changes',
      {
        event: config.event ?? '*',
        schema: 'public',
        table: config.table,
        filter: config.filter,
      },
      () => {
        // Clear previous timer
        const timer = this.debounceTimers.get(key);
        if (timer) clearTimeout(timer);

        // Set new debounced callback
        const newTimer = setTimeout(() => {
          Promise.resolve(callback()).catch(err => {
            console.error(`[Realtime] Callback error for ${key}:`, err);
          });
        }, config.debounceMs ?? this.debounceMs);

        this.debounceTimers.set(key, newTimer);
      }
    );

    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Channel error for ${key}`);
        this.unsubscribe(key);
      } else if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Connected to ${key}`);
      }
    });

    this.subscriptions.set(key, channel);
    return channel;
  }

  /**
   * Unsubscribe and clean up resources
   */
  unsubscribe(key: string) {
    const channel = this.subscriptions.get(key);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(key);
    }

    const timer = this.debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }
  }

  /**
   * Unsubscribe from all subscriptions (cleanup)
   */
  unsubscribeAll() {
    for (const key of this.subscriptions.keys()) {
      this.unsubscribe(key);
    }
  }

  /**
   * Get current subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }

  /**
   * Set debounce timing for optimization
   */
  setDebounceMs(ms: number) {
    this.debounceMs = Math.max(100, Math.min(1000, ms)); // Clamp 100-1000ms
  }

  /**
   * Set max concurrent subscriptions
   */
  setMaxSubscriptions(max: number) {
    this.maxSubscriptions = Math.max(5, Math.min(20, max)); // Clamp 5-20
  }
}

export const optimizedRealtimeSubscriber = new OptimizedRealtimeSubscriber();

// ============================================================
// 2. Batch data refresh with coordination
// ============================================================

interface RefreshQueue {
  operation: string;
  timestamp: number;
}

class CoordinatedRefreshManager {
  private refreshQueue: RefreshQueue[] = [];
  private isProcessing = false;
  private batchWindowMs = 500; // Collect refreshes for 500ms before executing

  /**
   * Queue a data refresh operation
   */
  queueRefresh(operation: string) {
    this.refreshQueue.push({
      operation,
      timestamp: Date.now(),
    });

    // Trigger batch processing if not already running
    if (!this.isProcessing) {
      this.processBatch();
    }
  }

  /**
   * Process all queued refreshes as a batch
   */
  private async processBatch() {
    if (this.isProcessing || this.refreshQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Wait for batch window to collect more operations
    await new Promise(resolve => setTimeout(resolve, this.batchWindowMs));

    // Deduplicate operations
    const uniqueOps = Array.from(new Set(this.refreshQueue.map(r => r.operation)));
    this.refreshQueue = [];

    console.log(`[Refresh] Processing ${uniqueOps.length} unique operations: ${uniqueOps.join(', ')}`);

    // Execute refreshes in parallel where possible
    await Promise.all(
      uniqueOps.map(op => this.executeRefresh(op).catch(err => {
        console.error(`[Refresh] Failed to execute ${op}:`, err);
      }))
    );

    this.isProcessing = false;

    // Process remaining queued operations if any
    if (this.refreshQueue.length > 0) {
      this.processBatch();
    }
  }

  /**
   * Execute individual refresh operation (stub, override in app)
   */
  private async executeRefresh(operation: string) {
    // This should be hooked into your data fetching layer
    console.log(`[Refresh] Executing: ${operation}`);
  }
}

export const coordinatedRefreshManager = new CoordinatedRefreshManager();

// ============================================================
// 3. Memory-efficient user list streaming
// ============================================================

export async function* streamUsers(
  callerId: string,
  callerRole: string,
  pageSize: number = 50
) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data, error } = await supabase.rpc('api_get_users_page', {
        p_user_id: callerId,
        p_role: callerRole,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });

      if (error) throw error;

      const users = (data ?? []) as unknown[];

      if (users.length === 0) {
        hasMore = false;
      } else {
        yield users;
        page++;
      }

      // Small delay between pages to avoid overwhelming connection
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      console.error(`[Stream] Error fetching page ${page}:`, err);
      hasMore = false;
    }
  }
}

// ============================================================
// 4. Connection pool monitoring
// ============================================================

interface PoolMetrics {
  activeConnections: number;
  queuedRequests: number;
  averageWaitTime: number;
  lastUpdated: Date;
}

let poolMetrics: PoolMetrics = {
  activeConnections: 0,
  queuedRequests: 0,
  averageWaitTime: 0,
  lastUpdated: new Date(),
};

export function updatePoolMetrics(active: number, queued: number, avgWait: number) {
  poolMetrics = {
    activeConnections: active,
    queuedRequests: queued,
    averageWaitTime: avgWait,
    lastUpdated: new Date(),
  };
}

export function getPoolMetrics(): PoolMetrics {
  return { ...poolMetrics };
}

/**
 * Check if connection pool is under stress (useful for 600+ users)
 */
export function isPoolUnderStress(): boolean {
  return poolMetrics.queuedRequests > poolMetrics.activeConnections * 2;
}

/**
 * Auto-scale operation and caching based on pool stress
 */
export function getOptimalPageSize(): number {
  if (isPoolUnderStress()) {
    return 25; // Smaller pages during stress
  }
  return 50; // Normal page size
}
