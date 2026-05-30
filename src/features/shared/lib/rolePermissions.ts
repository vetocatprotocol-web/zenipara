/**
 * RBAC utilities for role hierarchy and access control.
 *
 * Implements the access rules from SPESIFIKASI.md §3.3:
 * - Komandan bertingkat (BATALION/KOMPI/PELETON)
 * - Staf berbasis bidang (S-1 Pers / S-3 Ops / S-4 Log)
 * - (deprecated) Guard/Provost — role telah dihapus dari model
 * - Admin — konfigurasi sistem, bukan operasional harian
 */

import type { User, CommandLevel } from '@/types';

export const APP_ROUTE_PATHS = {
  root: '/',
  login: '/login',
  register: '/register/:token',
  forceChangePin: '/force-change-pin',
  error: '/error',
} as const;

export const KNOWN_ROLES = ['super_admin', 'admin_satuan', 'komandan', 'prajurit', 'admin', 'staf'] as const;
export type KnownRole = typeof KNOWN_ROLES[number];

export const ROLE_CODE_MAP: Record<string, string> = {
  super_admin: 'SAD',
  admin_satuan: 'ADS',
  komandan: 'KMD',
  prajurit: 'PRJ',
  // guard removed per new role policy
  // legacy keys kept for compatibility
  admin: 'SAD',
  staf: 'STF',
};

export const ROLE_ROUTE_PATHS = {
  super_admin: {
    dashboard: '/super-admin/dashboard',
    satuans: '/super-admin/satuans',
    settings: '/super-admin/settings',
    audit: '/super-admin/audit',
  },
  admin: {
    dashboard: '/admin/dashboard',
    satuan: '/admin/satuan',
    users: '/admin/users',
    analytics: '/admin/analytics',
    logistics: '/admin/logistics',
    documents: '/admin/documents',
    announcements: '/admin/announcements',
    schedule: '/admin/schedule',
    attendance: '/admin/attendance',
    apel: '/admin/apel',
    kegiatan: '/admin/kegiatan',
    gatePassMonitor: '/admin/gatepass-monitor',
    posJaga: '/admin/pos-jaga',
    audit: '/admin/audit',
    settings: '/admin/settings',
  },
  admin_satuan: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    branding: '/admin/branding',
    gatePassMonitor: '/admin/gatepass-monitor',
    logistics: '/admin/logistics',
    announcements: '/admin/announcements',
    attendance: '/admin/attendance',
    analytics: '/admin/analytics',
    apel: '/admin/apel',
    kegiatan: '/admin/kegiatan',
    schedule: '/admin/schedule',
  },
  komandan: {
    dashboard: '/komandan/dashboard',
    tasks: '/komandan/tasks',
    personnel: '/komandan/personnel',
    sprint: '/komandan/sprint',
    reports: '/komandan/reports',
    evaluation: '/komandan/evaluation',
    attendance: '/komandan/attendance',
    apel: '/komandan/apel',
    kegiatan: '/komandan/kegiatan',
    laporanOps: '/komandan/laporan-ops',
    logisticsRequest: '/komandan/logistics-request',
    gatePassApproval: '/komandan/gatepass-approval',
    gatePassMonitor: '/komandan/gatepass-monitor',
    messages: '/komandan/messages',
  },
  prajurit: {
    dashboard: '/prajurit/dashboard',
    tasks: '/prajurit/tasks',
    attendance: '/prajurit/attendance',
    apel: '/prajurit/apel',
    kegiatan: '/prajurit/kegiatan',
    messages: '/prajurit/messages',
    leave: '/prajurit/leave',
    profile: '/prajurit/profile',
    gatePass: '/prajurit/gatepass',
    scanPos: '/prajurit/scan-pos',
  },
  // guard routes removed
  staf: {
    dashboard: '/staf/dashboard',
    messages: '/staf/messages',
    leaveReview: '/staf/leave-review',
    laporanOps: '/staf/laporan-ops',
    sprint: '/staf/sprint',
  },
} as const;

const ROLE_CODE_TO_ROLE: Record<string, KnownRole> = Object.fromEntries(
  Object.entries(ROLE_CODE_MAP).map(([role, code]) => [code, role]),
) as Record<string, KnownRole>;

const ROLE_ALIASES: Record<string, string> = {
  superadmin: 'admin',
  super_admin: 'admin',
  'super-admin': 'admin',
  admin_super: 'admin',
  'super admin': 'admin',
  staff: 'staf',
  'staf operasional': 'staf',
  staf_operasional: 'staf',
  staff_operasional: 'staf',
  'staff operasional': 'staf',
  'staf ops': 'staf',
  'staff ops': 'staf',
  stafops: 'staf',
  stafop: 'staf',
  // guard aliases removed
};

const ROLE_ACCESS_MAP: Record<KnownRole, string> = {
  super_admin: 'Semua satuan, tambah/nonaktifkan satuan, kelola admin_satuan, settings global',
  admin_satuan: 'Hanya satuan miliknya: kelola user, branding, feature flags, laporan',
  komandan: 'Hanya satuan miliknya: tasks, personnel, gate pass approval, laporan',
  prajurit: 'Hanya data pribadi di satuan miliknya: gate pass, absen, tugas, profil',
  // guard access removed
  admin: 'Super Admin: konfigurasi sistem & audit',
  staf: 'Staf berbasis bidang: tugas operasional per bidang (S-1 Pers, S-3 Ops, S-4 Log)',
};

const ROLE_DEFAULT_PATH_MAP: Record<KnownRole, string> = {
  super_admin: ROLE_ROUTE_PATHS.super_admin.dashboard,
  admin_satuan: ROLE_ROUTE_PATHS.admin.dashboard,
  komandan: ROLE_ROUTE_PATHS.komandan.dashboard,
  prajurit: ROLE_ROUTE_PATHS.prajurit.dashboard,
  // guard default removed
  admin: ROLE_ROUTE_PATHS.admin.dashboard,
  staf: ROLE_ROUTE_PATHS.staf.dashboard,
};

const ROLE_FALLBACK_PATH_MAP: Record<KnownRole, string[]> = {
  super_admin: [ROLE_ROUTE_PATHS.super_admin.dashboard, ROLE_ROUTE_PATHS.super_admin.settings],
  admin_satuan: [ROLE_ROUTE_PATHS.admin.dashboard, ROLE_ROUTE_PATHS.admin.settings],
  komandan: [ROLE_ROUTE_PATHS.komandan.dashboard, ROLE_ROUTE_PATHS.komandan.tasks, ROLE_ROUTE_PATHS.komandan.attendance],
  prajurit: [ROLE_ROUTE_PATHS.prajurit.dashboard, ROLE_ROUTE_PATHS.prajurit.profile],
  // guard fallbacks removed
  admin: [ROLE_ROUTE_PATHS.admin.dashboard, ROLE_ROUTE_PATHS.admin.settings],
  staf: [ROLE_ROUTE_PATHS.staf.dashboard, ROLE_ROUTE_PATHS.admin.users],
};

const ROLE_PROFILE_PATH_MAP: Record<KnownRole, string> = {
  super_admin: ROLE_ROUTE_PATHS.super_admin.satuans,
  admin_satuan: ROLE_ROUTE_PATHS.admin.users,
  komandan: ROLE_ROUTE_PATHS.komandan.personnel,
  prajurit: ROLE_ROUTE_PATHS.prajurit.profile,
  // guard profile removed
  admin: ROLE_ROUTE_PATHS.admin.users,
  staf: ROLE_ROUTE_PATHS.admin.users,
};

const ROLE_MESSAGES_PATH_MAP: Partial<Record<KnownRole, string>> = {
  komandan: ROLE_ROUTE_PATHS.komandan.messages,
  prajurit: ROLE_ROUTE_PATHS.prajurit.messages,
};

function humanizeRole(role: string): string {
  return role
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeRole(role: string | null | undefined): KnownRole | string | null {
  if (!role) return null;
  const trimmed = role.trim();
  const lowered = trimmed.toLowerCase();
  if (KNOWN_ROLES.includes(lowered as KnownRole)) return lowered as KnownRole;
  const aliasMatch = ROLE_ALIASES[lowered];
  if (aliasMatch) return aliasMatch;
  const compacted = lowered.replace(/[\s_/-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compactAliasMatch = ROLE_ALIASES[compacted];
  if (compactAliasMatch) return compactAliasMatch;
  const codeMatch = ROLE_CODE_TO_ROLE[trimmed.toUpperCase()];
  if (codeMatch) return codeMatch;
  return trimmed;
}

export function isKnownRole(role: string | null | undefined): role is KnownRole {
  const normalized = normalizeRole(role);
  return typeof normalized === 'string' && KNOWN_ROLES.includes(normalized as KnownRole);
}

export function getRoleDisplayLabel(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (!normalized) return '—';
  switch (normalized) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Super Admin';
    case 'admin_satuan': return 'Admin Satuan';
    case 'komandan': return 'Komandan';
    case 'prajurit': return 'Prajurit';
    // guard display removed
    default: return humanizeRole(normalized);
  }
}

export const ROLE_OPTIONS = KNOWN_ROLES.map((role) => ({
  value: role,
  label: `${getRoleDisplayLabel(role)} (${ROLE_CODE_MAP[role]})`,
  code: ROLE_CODE_MAP[role],
  description: ROLE_ACCESS_MAP[role],
}));

export const ROUTE_ROLE_GROUPS = {
  adminOnly: ['admin'],
  adminStaf: ['admin_satuan', 'admin'],
  komandanShared: ['komandan', 'admin_satuan', 'admin'],
  prajuritShared: ['prajurit', 'komandan', 'admin_satuan', 'admin'],
  // guardShared removed
  stafOnly: ['admin'],
} as const;

export function getRoleCode(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (!normalized) return '—';
  if (typeof normalized !== 'string') return '—';
  if (!isKnownRole(normalized)) return normalized.toUpperCase();
  return ROLE_CODE_MAP[normalized];
}

export function getRoleAccessDescription(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (!normalized || !isKnownRole(normalized)) return '—';
  return ROLE_ACCESS_MAP[normalized];
}

export function getRoleDefaultPath(role: string | null | undefined): string | null {
  const normalized = normalizeRole(role);
  if (!normalized || !isKnownRole(normalized)) return null;
  return ROLE_DEFAULT_PATH_MAP[normalized];
}

export function getRoleFallbackPaths(role: string | null | undefined): string[] {
  const normalized = normalizeRole(role);
  if (!normalized || !isKnownRole(normalized)) return [];
  return ROLE_FALLBACK_PATH_MAP[normalized];
}

export function getRoleProfilePath(role: string | null | undefined): string | null {
  const normalized = normalizeRole(role);
  if (!normalized || !isKnownRole(normalized)) return null;
  return ROLE_PROFILE_PATH_MAP[normalized] ?? null;
}

export function getRoleMessagesPath(role: string | null | undefined): string | null {
  const normalized = normalizeRole(role);
  if (!normalized || !isKnownRole(normalized)) return null;
  return ROLE_MESSAGES_PATH_MAP[normalized] ?? null;
}

export type GlobalSearchResultType = 'task' | 'user' | 'announcement';

export function getGlobalSearchResultPath(type: GlobalSearchResultType, role: string | null | undefined): string {
  if (type === 'task') {
    if (isRolePrajurit(role)) return ROLE_ROUTE_PATHS.prajurit.tasks;
    if (isRoleKomandan(role)) return ROLE_ROUTE_PATHS.komandan.tasks;
    return getRoleDefaultPath(role) ?? APP_ROUTE_PATHS.login;
  }

  if (type === 'user') {
    if (isRoleAdmin(role)) return ROLE_ROUTE_PATHS.admin.users;
    if (isRoleKomandan(role)) return ROLE_ROUTE_PATHS.komandan.personnel;
    return getRoleDefaultPath(role) ?? APP_ROUTE_PATHS.login;
  }

  if (isRoleAdmin(role)) return ROLE_ROUTE_PATHS.admin.announcements;
  if (isRoleKomandan(role)) return ROLE_ROUTE_PATHS.komandan.dashboard;
  if (isRolePrajurit(role)) return ROLE_ROUTE_PATHS.prajurit.dashboard;
  return getRoleDefaultPath(role) ?? APP_ROUTE_PATHS.login;
}

export function hasRole(role: string | null | undefined, expectedRole: KnownRole): boolean {
  return normalizeRole(role) === expectedRole;
}

export function isRoleAdmin(role: string | null | undefined): boolean {
  return hasRole(role, 'super_admin');
}

export function isRoleKomandan(role: string | null | undefined): boolean {
  return hasRole(role, 'komandan');
}

export function isRoleStaf(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'staf';
}

export function isRolePrajurit(role: string | null | undefined): boolean {
  return hasRole(role, 'prajurit');
}

export function isRoleGuard(_role: string | null | undefined): boolean {
  // Role `guard` telah dihapus; kembalikan false untuk mencegah pemberian akses
  return false;
}

// ── Staf bidang ──────────────────────────────────────────────────────────────

export type StafBidang = 's1' | 's3' | 's4' | 'umum';

/**
 * Detect the operational field (bidang) of a staf user based on their `jabatan`.
 * Mirrors the logic from StafDashboard.detectBidang and the RLS policies.
 */
export function getBidangFromJabatan(jabatan?: string): StafBidang {
  if (!jabatan) return 'umum';
  const j = jabatan.toLowerCase();
  if (j.includes('s-1') || j.includes('s1') || j.includes('pers')) return 's1';
  if (j.includes('s-4') || j.includes('s4') || j.includes('log')) return 's4';
  if (j.includes('s-3') || j.includes('s3') || j.includes('ops')) return 's3';
  return 'umum';
}

export type WriteModule =
  | 'attendance'   // S-1 Pers
  | 'leave'        // S-1 Pers
  | 'tasks'        // S-3 Ops
  | 'shifts'       // S-3 Ops
  | 'logistics';   // S-4 Log

const BIDANG_WRITE_MAP: Record<StafBidang, WriteModule[]> = {
  s1:   ['attendance', 'leave'],
  s3:   ['tasks', 'shifts'],
  s4:   ['logistics'],
  umum: [],
};

/**
 * Returns true when `user` is allowed to perform write operations on `module`.
 *
 * - Admin → always allowed (for their own admin pages)
 * - Komandan → allowed on operational modules they command
 * - Staf → allowed only for their bidang
 * - Others (prajurit) → not allowed
 */
export function canWrite(user: User | null, module: WriteModule): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (isRoleAdmin(role)) return true;
  if (isRoleKomandan(role)) return true;
  if (isRoleStaf(role)) {
    const bidang = getBidangFromJabatan(user.jabatan);
    return BIDANG_WRITE_MAP[bidang].includes(module);
  }
  return false;
}

/**
 * Returns true when the user has NO write access in the current context.
 * Useful for showing read-only banners.
 */
export function isReadOnlyUser(user: User | null, module: WriteModule): boolean {
  return !canWrite(user, module);
}

// ── Komandan scope ────────────────────────────────────────────────────────────

export type KomandanScope = 'batalion' | 'kompi' | 'peleton' | 'none';

/** Map CommandLevel enum → internal scope enum */
const LEVEL_TO_SCOPE: Record<CommandLevel, KomandanScope> = {
  BATALION: 'batalion',
  KOMPI:    'kompi',
  PELETON:  'peleton',
};

export function getKomandanScope(user: User | null): KomandanScope {
  if (!user || !isRoleKomandan(user.role)) return 'none';
  if (!user.level_komando) return 'none';
  return LEVEL_TO_SCOPE[user.level_komando] ?? 'none';
}

/** Human-readable scope label */
export function getKomandanScopeLabel(level?: CommandLevel | null): string {
  if (!level) return '—';
  const labels: Record<CommandLevel, string> = {
    BATALION: 'Komandan Batalion',
    KOMPI:    'Komandan Kompi',
    PELETON:  'Komandan Peleton',
  };
  return labels[level];
}

/**
 * Returns the data-scope description for a given level:
 * - BATALION → lihat semua data batalion
 * - KOMPI    → lihat data kompi dan peleton di bawah kompinya
 * - PELETON  → lihat data peleton sendiri
 */
export function getKomandanScopeDescription(level?: CommandLevel | null): string {
  if (!level) return 'Akses data tidak terkonfigurasi.';
  const desc: Record<CommandLevel, string> = {
    BATALION: 'Akses penuh seluruh data satuan batalion.',
    KOMPI:    'Akses data kompi dan peleton di bawah kompinya.',
    PELETON:  'Akses terbatas pada data peleton sendiri.',
  };
  return desc[level];
}

// ── Operational label ─────────────────────────────────────────────────────────

/** Role + bidang/level → display label sesuai SPESIFIKASI §3.3 */
export function getOperationalRoleLabel(user: User | null): string {
  if (!user) return '—';
  const role = normalizeRole(user.role);
  switch (role) {
    case 'admin':    return getRoleDisplayLabel(user.role);
    case 'prajurit': return getRoleDisplayLabel(user.role);
    // guard operational label removed
    case 'komandan': return getKomandanScopeLabel(user.level_komando);
    case 'staf': {
      const b = getBidangFromJabatan(user.jabatan);
      const labels: Record<StafBidang, string> = {
        s1:   'Staf Bidang S-1 Personel',
        s3:   'Staf Bidang S-3 Operasional',
        s4:   'Staf Bidang S-4 Logistik',
        umum: 'Staf Operasional',
      };
      return labels[b];
    }
    default: return getRoleDisplayLabel(user.role);
  }
}

/** Returns true when the user can read discipline notes (Komandan or Admin). */
export function canReadDisciplineNotes(user: User | null): boolean {
  if (!user) return false;
  return isRoleKomandan(user.role) || isRoleAdmin(user.role);
}
