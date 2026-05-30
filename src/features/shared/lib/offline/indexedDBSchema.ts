/**
 * IndexedDB Schema for Offline Support
 * 
 * Mirrors critical Supabase tables for offline-first capability.
 * Capacity: ~50MB per browser (IndexedDB quota)
 * TTL: Data refreshed when online via realtime sync
 * 
 * Schema Version: 1
 */

import { DBSchema, IDBPDatabase, openDB, StoreNames } from 'idb';

/**
 * ==============================================================
 * TYPE DEFINITIONS
 * ==============================================================
 */

/** Mirrors Supabase 'users' table */
export interface UserRecord {
  id: string;
  nrp: string;
  nama: string;
  email: string;
  role: 'admin' | 'komandan' | 'prajurit' | 'guard' | 'staf_ops';
  satuan: string;
  is_active: boolean;
  foto_url?: string;
  keterangan?: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors Supabase 'gate_passes' table */
export interface GatePassRecord {
  id: string;
  user_id: string;
  created_by: string;
  qr_token: string;
  approved_by?: string;
  checked_in_at?: string;
  checked_out_at?: string;
  status: 'pending' | 'approved' | 'checked_in' | 'overdue' | 'completed';
  alasan: string;
  tujuan: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors Supabase 'tasks' table */
export interface TaskRecord {
  id: string;
  judul: string;
  deskripsi?: string;
  assigned_to: string;
  assigned_by: string;
  status: 'in_progress' | 'submitted' | 'approved' | 'done' | 'rejected';
  prioritas: 1 | 2 | 3;
  deadline?: string;
  satuan?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  approved_by?: string;
}

/** Mirrors Supabase 'leave_requests' table */
export interface LeaveRequestRecord {
  id: string;
  user_id: string;
  jenis_izin: 'cuti' | 'sakit' | 'dinas_luar';
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  approved_by?: string;
}

/** Mirrors Supabase 'attendances' table */
export interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in: string;
  check_in_location?: string;
  check_out?: string;
  check_out_location?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  keterangan?: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors Supabase 'announcements' table */
export interface AnnouncementRecord {
  id: string;
  judul: string;
  isi: string;
  created_by: string;
  target_role?: string[];
  target_satuan?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors Supabase 'messages' table */
export interface MessageRecord {
  id: string;
  from_user: string;
  to_user: string;
  isi: string;
  is_read: boolean;
  created_at: string;
}

/** Metadata for sync coordination */
export interface SyncMetadata {
  key: 'lastSyncTime' | 'syncInProgress' | 'queuedOperations' | 'version';
  value: string | number | boolean | object;
  updated_at: string;
}

/** Queued offline operations */
export interface QueuedOperation {
  id: string; // UUID
  timestamp: number; // ms since epoch
  retry_count: number;
  max_retries: number;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: 'users' | 'gate_passes' | 'tasks' | 'leave_requests' | 'attendances' | 'announcements' | 'messages';
  entity_id?: string;
  payload: Record<string, unknown>;
  error?: string;
  status: 'pending' | 'failed' | 'synced';
}

/**
 * ==============================================================
 * INDEXEDDB SCHEMA DEFINITION
 * ==============================================================
 */

export interface KaryoOfflineDB extends DBSchema {
  // Data Tables (mirrored from Supabase)
  users: {
    key: string; // UUID
    value: UserRecord;
    indexes: {
      'by-nrp': string;
      'by-satuan': string;
      'by-role': string;
      'by-updated_at': string;
    };
  };

  gate_passes: {
    key: string; // UUID
    value: GatePassRecord;
    indexes: {
      'by-user_id': string;
      'by-status': string;
      'by-created_at': string;
      'by-qr_token': string;
    };
  };

  tasks: {
    key: string; // UUID
    value: TaskRecord;
    indexes: {
      'by-assigned_to': string;
      'by-assigned_by': string;
      'by-status': string;
      'by-deadline': string;
      'by-created_at': string;
    };
  };

  leave_requests: {
    key: string; // UUID
    value: LeaveRequestRecord;
    indexes: {
      'by-user_id': string;
      'by-status': string;
      'by-created_at': string;
    };
  };

  attendances: {
    key: string; // UUID
    value: AttendanceRecord;
    indexes: {
      'by-user_id': string;
      'by-status': string;
      'by-created_at': string;
    };
  };

  announcements: {
    key: string; // UUID
    value: AnnouncementRecord;
    indexes: {
      'by-created_by': string;
      'by-created_at': string;
    };
  };

  messages: {
    key: string; // UUID
    value: MessageRecord;
    indexes: {
      'by-from_user': string;
      'by-to_user': string;
      'by-created_at': string;
    };
  };

  // Sync Management
  sync_metadata: {
    key: string; // 'lastSyncTime' | 'syncInProgress' | 'version'
    value: SyncMetadata;
  };

  queued_operations: {
    key: string; // UUID
    value: QueuedOperation;
    indexes: {
      'by-timestamp': number;
      'by-status': string;
      'by-entity_type': string;
    };
  };
}

/**
 * ==============================================================
 * DATABASE INITIALIZATION
 * ==============================================================
 */

const DB_NAME = 'KaryoOS';
const DB_VERSION = 1;

/**
 * Initialize or upgrade IndexedDB database
 * Called on first load and version changes
 */
export async function initOfflineDB(): Promise<IDBPDatabase<KaryoOfflineDB>> {
  return openDB<KaryoOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`[OfflineDB] Upgrading from v${oldVersion} to v${newVersion}`);

      // v1: Create all tables and indexes
      if (oldVersion < 1) {
        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('by-nrp', 'nrp');
          usersStore.createIndex('by-satuan', 'satuan');
          usersStore.createIndex('by-role', 'role');
          usersStore.createIndex('by-updated_at', 'updated_at');
        }

        // Gate passes store
        if (!db.objectStoreNames.contains('gate_passes')) {
          const gatePassesStore = db.createObjectStore('gate_passes', { keyPath: 'id' });
          gatePassesStore.createIndex('by-user_id', 'user_id');
          gatePassesStore.createIndex('by-status', 'status');
          gatePassesStore.createIndex('by-created_at', 'created_at');
          gatePassesStore.createIndex('by-qr_token', 'qr_token', { unique: true });
        }

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('by-assigned_to', 'assigned_to');
          tasksStore.createIndex('by-assigned_by', 'assigned_by');
          tasksStore.createIndex('by-status', 'status');
          tasksStore.createIndex('by-deadline', 'deadline');
          tasksStore.createIndex('by-created_at', 'created_at');
        }

        // Leave requests store
        if (!db.objectStoreNames.contains('leave_requests')) {
          const leaveStore = db.createObjectStore('leave_requests', { keyPath: 'id' });
          leaveStore.createIndex('by-user_id', 'user_id');
          leaveStore.createIndex('by-status', 'status');
          leaveStore.createIndex('by-created_at', 'created_at');
        }

        // Attendances store
        if (!db.objectStoreNames.contains('attendances')) {
          const attendanceStore = db.createObjectStore('attendances', { keyPath: 'id' });
          attendanceStore.createIndex('by-user_id', 'user_id');
          attendanceStore.createIndex('by-status', 'status');
          attendanceStore.createIndex('by-created_at', 'created_at');
        }

        // Announcements store
        if (!db.objectStoreNames.contains('announcements')) {
          const announcementsStore = db.createObjectStore('announcements', { keyPath: 'id' });
          announcementsStore.createIndex('by-created_by', 'created_by');
          announcementsStore.createIndex('by-created_at', 'created_at');
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('by-from_user', 'from_user');
          messagesStore.createIndex('by-to_user', 'to_user');
          messagesStore.createIndex('by-created_at', 'created_at');
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
        }

        // Queued operations store (for offline write queue)
        if (!db.objectStoreNames.contains('queued_operations')) {
          const queueStore = db.createObjectStore('queued_operations', { keyPath: 'id' });
          queueStore.createIndex('by-timestamp', 'timestamp');
          queueStore.createIndex('by-status', 'status');
          queueStore.createIndex('by-entity_type', 'entity_type');
        }
      }

      console.log('[OfflineDB] Upgrade complete');
    },
  });
}

/**
 * Get or create database instance
 * Singleton pattern for app lifecycle
 */
let dbInstance: IDBPDatabase<KaryoOfflineDB> | null = null;

export async function getOfflineDB(): Promise<IDBPDatabase<KaryoOfflineDB>> {
  if (!dbInstance) {
    dbInstance = await initOfflineDB();
  }
  return dbInstance;
}

/**
 * Clear all offline data (for debugging/reset)
 */
export async function clearOfflineDB(): Promise<void> {
  const db = await getOfflineDB();
  const stores = [
    'users',
    'gate_passes',
    'tasks',
    'leave_requests',
    'attendances',
    'announcements',
    'messages',
    'sync_metadata',
    'queued_operations',
  ];

  for (const storeName of stores) {
    await db.clear(storeName as StoreNames<KaryoOfflineDB>);
  }

  console.log('[OfflineDB] Database cleared');
}

/**
 * Delete entire offline database (nuclear option)
 */
export async function deleteOfflineDB(): Promise<void> {
  dbInstance = null;
  await indexedDB.deleteDatabase(DB_NAME);
  console.log('[OfflineDB] Database deleted');
}
