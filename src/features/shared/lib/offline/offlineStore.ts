/**
 * Offline Store Operations
 * Simplified CRUD operations on IndexedDB for offline data management.
 */

import { getOfflineDB } from './indexedDBSchema';
import type { UserRecord, GatePassRecord, TaskRecord, QueuedOperation, SyncMetadata, KaryoOfflineDB } from './indexedDBSchema';
import type { StoreNames } from 'idb';

/**
 * USER OPERATIONS
 */

export async function saveUserOffline(user: UserRecord): Promise<void> {
  const db = await getOfflineDB();
  await db.put('users', user);
}

export async function getCurrentOfflineUser(userId: string): Promise<UserRecord | undefined> {
  const db = await getOfflineDB();
  return (await db.get('users', userId)) as UserRecord | undefined;
}

/**
 * GATE PASS OPERATIONS
 */

export async function saveGatePassOffline(gatePass: GatePassRecord): Promise<void> {
  const db = await getOfflineDB();
  await db.put('gate_passes', gatePass);
}

export async function saveGatePassesOfflineBatch(gatePasses: GatePassRecord[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('gate_passes', 'readwrite');
  for (const gp of gatePasses) {
    await tx.store.put(gp);
  }
  await tx.done;
}

export async function getUserGatePassesOffline(userId: string): Promise<GatePassRecord[]> {
  const db = await getOfflineDB();
  return (await db.getAllFromIndex('gate_passes', 'by-user_id', userId)) as GatePassRecord[];
}

export async function getActiveGatePassesOffline(): Promise<GatePassRecord[]> {
  const db = await getOfflineDB();
  const allPasses = await db.getAll('gate_passes');
  const statuses = ['pending', 'approved', 'checked_in', 'overdue'];
  return allPasses.filter((gp) => statuses.includes(gp.status)) as GatePassRecord[];
}

/**
 * TASK OPERATIONS
 */

export async function saveTaskOffline(task: TaskRecord): Promise<void> {
  const db = await getOfflineDB();
  await db.put('tasks', task);
}

export async function saveTasksOfflineBatch(tasks: TaskRecord[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('tasks', 'readwrite');
  for (const task of tasks) {
    await tx.store.put(task);
  }
  await tx.done;
}

export async function getUserTasksOffline(userId: string): Promise<TaskRecord[]> {
  const db = await getOfflineDB();
  return (await db.getAllFromIndex('tasks', 'by-assigned_to', userId)) as TaskRecord[];
}

/**
 * SYNC METADATA OPERATIONS
 */

export async function getLastSyncTime(): Promise<number | null> {
  const db = await getOfflineDB();
  const metadata = (await db.get('sync_metadata', 'lastSyncTime')) as SyncMetadata | undefined;
  return metadata ? (metadata.value as number) : null;
}

export async function setLastSyncTime(timestamp: number): Promise<void> {
  const db = await getOfflineDB();
  await db.put('sync_metadata', {
    key: 'lastSyncTime',
    value: timestamp,
    updated_at: new Date().toISOString(),
  } as SyncMetadata);
}

export async function isSyncInProgress(): Promise<boolean> {
  const db = await getOfflineDB();
  const metadata = (await db.get('sync_metadata', 'syncInProgress')) as SyncMetadata | undefined;
  return metadata ? (metadata.value as boolean) : false;
}

export async function setSyncInProgress(inProgress: boolean): Promise<void> {
  const db = await getOfflineDB();
  await db.put('sync_metadata', {
    key: 'syncInProgress',
    value: inProgress,
    updated_at: new Date().toISOString(),
  } as SyncMetadata);
}

/**
 * QUEUE MANAGEMENT
 */

export async function queueOfflineOperation(
  operation: Omit<QueuedOperation, 'id' | 'timestamp'>
): Promise<string> {
  const db = await getOfflineDB();
  const queuedOp: QueuedOperation = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...operation,
  };
  return (await db.add('queued_operations', queuedOp)) as string;
}

export async function getPendingOperations(limit?: number): Promise<QueuedOperation[]> {
  const db = await getOfflineDB();
  const allOps = (await db.getAll('queued_operations')) as QueuedOperation[];
  const pending = allOps.filter((op) => op.status === 'pending').sort((a, b) => a.timestamp - b.timestamp);
  return limit ? pending.slice(0, limit) : pending;
}

export async function markOperationSynced(operationId: string): Promise<void> {
  const db = await getOfflineDB();
  const op = (await db.get('queued_operations', operationId)) as QueuedOperation | undefined;
  if (op) {
    op.status = 'synced';
    op.error = undefined;
    await db.put('queued_operations', op);
  }
}

export async function markOperationFailed(operationId: string, error: string, retryCount: number): Promise<void> {
  const db = await getOfflineDB();
  const op = (await db.get('queued_operations', operationId)) as QueuedOperation | undefined;
  if (op) {
    op.status = retryCount >= op.max_retries ? 'failed' : 'pending';
    op.error = error;
    op.retry_count = retryCount;
    await db.put('queued_operations', op);
  }
}

export async function deleteOperationFromQueue(operationId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('queued_operations', operationId);
}

export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  failed: number;
  synced: number;
  oldestPendingAge: number | null;
}> {
  const db = await getOfflineDB();
  const allOps = (await db.getAll('queued_operations')) as QueuedOperation[];
  const stats = {
    total: allOps.length,
    pending: 0,
    failed: 0,
    synced: 0,
    oldestPendingAge: null as number | null,
  };

  let oldestPendingTime: number | null = null;

  for (const op of allOps) {
    stats[op.status]++;
    if (op.status === 'pending') {
      if (!oldestPendingTime || op.timestamp < oldestPendingTime) {
        oldestPendingTime = op.timestamp;
      }
    }
  }

  if (oldestPendingTime) {
    stats.oldestPendingAge = Date.now() - oldestPendingTime;
  }

  return stats;
}

export async function clearSyncedOperations(): Promise<number> {
  const db = await getOfflineDB();
  const allOps = (await db.getAll('queued_operations')) as QueuedOperation[];
  const syncedOps = allOps.filter((op) => op.status === 'synced');

  const tx = db.transaction('queued_operations', 'readwrite');
  for (const op of syncedOps) {
    await tx.store.delete(op.id);
  }
  await tx.done;

  return syncedOps.length;
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await getOfflineDB();
  const stores = [
    'users',
    'gate_passes',
    'tasks',
    'leave_requests',
    'attendances',
    'announcements',
    'messages',
    'queued_operations',
  ];
  for (const storeName of stores) {
    await db.clear(storeName as StoreNames<KaryoOfflineDB>);
  }
}
