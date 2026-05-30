import { describe, expect, it } from 'vitest';
import {
  APP_ROUTE_PATHS,
  ROLE_ROUTE_PATHS,
  ROLE_OPTIONS,
  getGlobalSearchResultPath,
  getRoleAccessDescription,
  getRoleCode,
  getRoleDefaultPath,
  getRoleDisplayLabel,
  getRoleFallbackPaths,
  getRoleMessagesPath,
  getRoleProfilePath,
  isRoleAdmin,
  isRoleGuard,
  isRoleKomandan,
  isRolePrajurit,
  isRoleStaf,
  isKnownRole,
  normalizeRole,
} from '@/features/shared/lib/rolePermissions';

describe('rolePermissions helpers', () => {
  it('normalizes role codes to canonical role', () => {
    expect(normalizeRole('SAD')).toBe('admin');
    expect(normalizeRole('KMD')).toBe('komandan');
    expect(normalizeRole('STF')).toBe('staf');
    expect(normalizeRole('PRJ')).toBe('prajurit');
    expect(normalizeRole('PJP')).toBe('PJP');
  });

  it('keeps canonical roles as-is', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('komandan')).toBe('komandan');
    expect(normalizeRole('staf')).toBe('staf');
    expect(normalizeRole('prajurit')).toBe('prajurit');
    // guard removed: keep as raw value if provided
  });

  it('normalizes common human-friendly role aliases', () => {
    expect(normalizeRole('Super Admin')).toBe('admin');
    expect(normalizeRole('Staff Operasional')).toBe('staf');
    expect(normalizeRole('Petugas Jaga / Provos')).toBe('Petugas Jaga / Provos');
  });

  it('recognizes known roles from canonical and code forms', () => {
    expect(isKnownRole('admin')).toBe(true);
    expect(isKnownRole('SAD')).toBe(true);
    expect(isKnownRole('PJP')).toBe(false);
    expect(isKnownRole('unknown')).toBe(false);
  });

  it('returns correct display label and role code', () => {
    expect(getRoleDisplayLabel('admin')).toBe('Super Admin');
    expect(getRoleDisplayLabel('SAD')).toBe('Super Admin');
    // guard removed from display labels
    expect(getRoleCode('komandan')).toBe('KMD');
    expect(getRoleCode('KMD')).toBe('KMD');
  });

  it('returns access description and default path for both code and canonical role', () => {
    expect(getRoleAccessDescription('STF')).toBe('Input operasional sesuai bidang (S-1/S-3/S-4)');
    expect(getRoleDefaultPath('PRJ')).toBe('/prajurit/dashboard');
    expect(getRoleDefaultPath('admin')).toBe('/admin/dashboard');
    expect(getRoleDefaultPath('unknown')).toBeNull();
  });

  it('returns profile and message paths for canonical and code roles', () => {
    expect(getRoleProfilePath('PRJ')).toBe('/prajurit/profile');
    expect(getRoleProfilePath('admin')).toBe('/admin/users');
    expect(getRoleMessagesPath('KMD')).toBe('/komandan/messages');
    expect(getRoleMessagesPath('PJP')).toBeNull();
    expect(getRoleMessagesPath('unknown')).toBeNull();
  });

  it('keeps centralized route path catalog in sync with helper outputs', () => {
    expect(ROLE_ROUTE_PATHS.admin.dashboard).toBe('/admin/dashboard');
    // guard routes removed
    expect(getRoleDefaultPath('admin')).toBe(ROLE_ROUTE_PATHS.admin.dashboard);
    expect(getRoleProfilePath('PRJ')).toBe(ROLE_ROUTE_PATHS.prajurit.profile);
    expect(getRoleMessagesPath('STF')).toBe(ROLE_ROUTE_PATHS.staf.messages);
  });

  it('maps global search result type and role to centralized route paths', () => {
    expect(getGlobalSearchResultPath('task', 'PRJ')).toBe(ROLE_ROUTE_PATHS.prajurit.tasks);
    expect(getGlobalSearchResultPath('task', 'KMD')).toBe(ROLE_ROUTE_PATHS.komandan.tasks);
    expect(getGlobalSearchResultPath('user', 'SAD')).toBe(ROLE_ROUTE_PATHS.admin.users);
    expect(getGlobalSearchResultPath('user', 'komandan')).toBe(ROLE_ROUTE_PATHS.komandan.personnel);
    expect(getGlobalSearchResultPath('announcement', 'admin')).toBe(ROLE_ROUTE_PATHS.admin.announcements);
    expect(getGlobalSearchResultPath('announcement', 'PRJ')).toBe(ROLE_ROUTE_PATHS.prajurit.dashboard);
    expect(getGlobalSearchResultPath('announcement', 'unknown')).toBe(APP_ROUTE_PATHS.login);
    expect(APP_ROUTE_PATHS.error).toBe('/error');
  });

  it('returns fallback paths and role options with code labels', () => {
    expect(getRoleFallbackPaths('SAD')).toContain('/admin/settings');
    expect(getRoleFallbackPaths('PJP')).toEqual([]);
    const adminOption = ROLE_OPTIONS.find((opt) => opt.value === 'admin');
    expect(adminOption?.label).toBe('Super Admin (SAD)');
    expect(adminOption?.description).toBe('Super Admin: konfigurasi sistem & audit');
  });

  it('supports semantic role predicates for code and canonical values', () => {
    expect(isRoleAdmin('admin')).toBe(true);
    expect(isRoleAdmin('SAD')).toBe(true);
    expect(isRoleKomandan('KMD')).toBe(true);
    expect(isRoleStaf('STF')).toBe(true);
    expect(isRolePrajurit('PRJ')).toBe(true);
    expect(isRoleGuard('PJP')).toBe(false);
    expect(isRoleGuard('staf')).toBe(false);
  });
});
