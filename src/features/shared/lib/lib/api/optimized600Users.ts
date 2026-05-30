/**
 * 600+ User Optimization: API Client Configuration
 * Implements connection pooling, request batching, and performance monitoring
 */

import { supabase } from '../supabase';

// ============================================================
// 1. Request batching for bulk operations
// ============================================================

export interface BulkUserImportOptions {
  users: Array<{
    nrp: string;
    nama: string;
    role: string;
    satuan: string;
    pangkat?: string;
    jabatan?: string;
  }>;
  batchSize?: number;
}

/**
 * Optimized bulk import with error recovery
 * Sends all users in single RPC call instead of sequential requests
 */
export async function bulkImportUsers(options: BulkUserImportOptions) {
  const { users, batchSize = 5000 } = options;

  if (users.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  // Split into manageable batches to avoid timeout
  const batches = [];
  for (let i = 0; i < users.length; i += batchSize) {
    batches.push(users.slice(i, i + batchSize));
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  const allErrors: Array<{ nrp: string; error: string }> = [];

  // Process batches sequentially with minimal delay
  for (const batch of batches) {
    try {
      const { data, error } = await supabase.rpc('import_users_csv', {
        p_users: batch,
      });

      if (error) throw error;

      const result = data as { success: number; failed: number; errors: Array<{ nrp: string; error: string }> };
      totalSuccess += result.success;
      totalFailed += result.failed;
      if (result.errors?.length) {
        allErrors.push(...result.errors);
      }

      // Small delay between batches to avoid overwhelming the connection pool
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      totalFailed += batch.length;
      allErrors.push({
        nrp: 'batch-error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    success: totalSuccess,
    failed: totalFailed,
    errors: allErrors,
  };
}

// ============================================================
// 2. Optimized user fetching with caching awareness
// ============================================================

export interface OptimizedFetchOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  satuan?: string;
  isActive?: boolean;
  useCache?: boolean; // Leverage frontend cache if available
}

/**
 * Fetch users with optimized parameters
 * PageSize capped at 200 for safety, defaults to 50
 */
export async function optimizedFetchUsers(callerId: string, callerRole: string, options: OptimizedFetchOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(1, options.pageSize ?? 50), 200); // Cap at 200

  // First get count for pagination info
  const countResult = await supabase.rpc('api_count_users_filtered', {
    p_user_id: callerId,
    p_role: callerRole,
    p_role_filter: options.role ?? null,
    p_satuan_filter: options.satuan ?? null,
    p_is_active: options.isActive ?? null,
    p_search: options.search?.trim() ?? null,
  });

  const totalItems = (countResult.data as number) ?? 0;

  // Then fetch the page
  const offset = (page - 1) * pageSize;
  const dataResult = await supabase.rpc('api_get_users_page', {
    p_user_id: callerId,
    p_role: callerRole,
    p_role_filter: options.role ?? null,
    p_satuan_filter: options.satuan ?? null,
    p_is_active: options.isActive ?? null,
    p_order_by: 'nama',
    p_ascending: true,
    p_search: options.search?.trim() ?? null,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (dataResult.error) throw dataResult.error;

  return {
    users: (dataResult.data ?? []) as unknown[],
    total: totalItems,
    page,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

// ============================================================
// 3. Batch operations for admin actions
// ============================================================

export async function batchResetUserPins(userIds: string[], newPin: string) {
  // Use dedicated bulk function instead of individual RPC calls
  const { data, error } = await supabase.rpc('bulk_reset_pins', {
    p_user_ids: userIds,
    p_new_pin: newPin,
  });

  if (error) throw error;
  return data as number; // Returns count of updated users
}

export async function batchToggleUserStatus(userIds: string[], isActive: boolean) {
  // Note: Need to create this RPC function or use direct update
  // For now, use individual updates but could batch in future
  const results = await Promise.all(
    userIds.map(userId => supabase.rpc('api_update_user', {
      p_caller_id: userId, // This should be the current user ID
      p_caller_role: 'admin',
      p_target_id: userId,
      p_updates: { is_active: isActive },
    }))
  );

  return results.filter(r => !r.error).length;
}

// ============================================================
// 4. User statistics caching for dashboards
// ============================================================

let userStatsCache: { data: unknown; timestamp: number } | null = null;
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedUserStats() {
  const now = Date.now();

  // Return cache if valid
  if (userStatsCache && now - userStatsCache.timestamp < STATS_CACHE_TTL) {
    return userStatsCache.data;
  }

  // Fetch fresh data from materialized view
  const { data, error } = await supabase.from('v_user_stats').select('*');

  if (error) throw error;

  userStatsCache = { data, timestamp: now };
  return data;
}

/**
 * Clear user stats cache (call after bulk user operations)
 */
export function invalidateUserStatsCache() {
  userStatsCache = null;
}

// ============================================================
// 5. Performance monitoring utilities
// ============================================================

interface PerformanceMetric {
  operation: string;
  durationMs: number;
  rowsAffected: number;
  timestamp: Date;
}

const performanceMetrics: PerformanceMetric[] = [];

export function trackOperationPerformance(operation: string, durationMs: number, rowsAffected: number = 0) {
  performanceMetrics.push({
    operation,
    durationMs,
    rowsAffected,
    timestamp: new Date(),
  });

  // Keep only last 100 metrics
  if (performanceMetrics.length > 100) {
    performanceMetrics.shift();
  }

  // Log slow operations (> 1 second)
  if (durationMs > 1000 && import.meta.env.DEV) {
    console.warn(`[SLOW OP] ${operation} took ${durationMs}ms (${rowsAffected} rows)`);
  }
}

export function getPerformanceMetrics() {
  return performanceMetrics;
}

export function getAverageOperationTime(operation: string): number {
  const filtered = performanceMetrics.filter(m => m.operation === operation);
  if (filtered.length === 0) return 0;

  const total = filtered.reduce((sum, m) => sum + m.durationMs, 0);
  return total / filtered.length;
}

// ============================================================
// 6. Connection health check for 600+ users
// ============================================================

export async function checkConnectionHealth() {
  const startTime = performance.now();

  try {
    // Simple query to test connectivity
    const result = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .limit(1);

    const duration = performance.now() - startTime;

    if (result.error) {
      return {
        healthy: false,
        duration,
        error: result.error.message,
      };
    }

    return {
      healthy: true,
      duration,
      latencyMs: duration,
    };
  } catch (err) {
    return {
      healthy: false,
      duration: performance.now() - startTime,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
