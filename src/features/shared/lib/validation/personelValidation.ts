/**
 * Validation functions for personnel management forms.
 * Centralized, reusable validation logic.
 */

import type { Role, CommandLevel } from '../../types';
import { isRoleKomandan } from '../rolePermissions';

export interface ValidationError {
  field: string;
  message: string;
}

/** Validate NRP (Nomor Registrasi Personel) */
export function validateNrp(nrp: unknown): ValidationError | null {
  if (!nrp || typeof nrp !== 'string') {
    return { field: 'nrp', message: 'NRP harus diisi' };
  }
  if (!/^\d{4,20}$/.test(nrp.trim())) {
    return { field: 'nrp', message: 'NRP harus 4-20 digit angka' };
  }
  return null;
}

/** Validate nama (full name) */
export function validateNama(nama: unknown): ValidationError | null {
  if (!nama || typeof nama !== 'string') {
    return { field: 'nama', message: 'Nama harus diisi' };
  }
  if (nama.trim().length < 3) {
    return { field: 'nama', message: 'Nama minimal 3 karakter' };
  }
  if (nama.trim().length > 100) {
    return { field: 'nama', message: 'Nama maksimal 100 karakter' };
  }
  return null;
}

/** Validate PIN */
export function validatePin(pin: unknown): ValidationError | null {
  if (!pin || typeof pin !== 'string') {
    return { field: 'pin', message: 'PIN harus diisi' };
  }
  if (!/^\d{6}$/.test(pin)) {
    return { field: 'pin', message: 'PIN harus 6 digit angka' };
  }
  return null;
}

/** Validate role */
export function validateRole(role: unknown): ValidationError | null {
  const validRoles = ['prajurit', 'staf', 'komandan', 'guard', 'admin'];
  if (!role || !validRoles.includes(String(role))) {
    return { field: 'role', message: 'Role tidak valid' };
  }
  return null;
}

/** Validate level_komando (only required for komandan role) */
export function validateLevelKomando(levelKomando: unknown, role: Role): ValidationError | null {
  if (!isRoleKomandan(role)) {
    return null; // Not required for non-komandan roles
  }
  const validLevels = ['BATALION', 'KOMPI', 'PELETON'];
  if (!levelKomando || !validLevels.includes(String(levelKomando))) {
    return { field: 'level_komando', message: 'Tingkat komando harus dipilih untuk role Komandan' };
  }
  return null;
}

/** Validate satuan (unit) */
export function validateSatuan(satuan: unknown): ValidationError | null {
  if (!satuan || typeof satuan !== 'string') {
    return { field: 'satuan', message: 'Satuan harus diisi' };
  }
  if (satuan.trim().length === 0) {
    return { field: 'satuan', message: 'Satuan tidak boleh kosong' };
  }
  return null;
}

/** Validate bulk PIN list (for bulk reset) */
export function validateBulkPin(pin: unknown): ValidationError | null {
  if (!pin || typeof pin !== 'string') {
    return { field: 'bulk_pin', message: 'PIN baru harus diisi' };
  }
  if (!/^\d{6}$/.test(pin)) {
    return { field: 'bulk_pin', message: 'PIN baru harus 6 digit angka' };
  }
  return null;
}

/** Validate selected users for bulk operations */
export function validateBulkSelection(selectedCount: number, minRequired: number = 1): ValidationError | null {
  if (selectedCount < minRequired) {
    return {
      field: 'selection',
      message: `Pilih minimal ${minRequired} personel`,
    };
  }
  return null;
}

/** Validate new user form data */
export interface NewUserFormData {
  nrp: string;
  nama: string;
  pin: string;
  role: Role;
  satuan: string;
  pangkat?: string;
  level_komando?: CommandLevel;
}

export function validateNewUserForm(data: NewUserFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  const nrpError = validateNrp(data.nrp);
  if (nrpError) errors.push(nrpError);

  const namaError = validateNama(data.nama);
  if (namaError) errors.push(namaError);

  const pinError = validatePin(data.pin);
  if (pinError) errors.push(pinError);

  const roleError = validateRole(data.role);
  if (roleError) errors.push(roleError);

  const satuanError = validateSatuan(data.satuan);
  if (satuanError) errors.push(satuanError);

  const levelError = validateLevelKomando(data.level_komando, data.role);
  if (levelError) errors.push(levelError);

  return errors;
}

/** Validate role edit form data */
export interface RoleEditFormData {
  role: Role;
  level_komando?: CommandLevel;
}

export function validateRoleEditForm(data: RoleEditFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  const roleError = validateRole(data.role);
  if (roleError) errors.push(roleError);

  const levelError = validateLevelKomando(data.level_komando, data.role);
  if (levelError) errors.push(levelError);

  return errors;
}

/**
 * Get first error message from validation error list.
 * Useful for displaying single error at a time.
 */
export function getFirstErrorMessage(errors: ValidationError[]): string | null {
  return errors.length > 0 ? errors[0].message : null;
}

/**
 * Check if a field has an error.
 */
export function hasFieldError(errors: ValidationError[], field: string): boolean {
  return errors.some((e) => e.field === field);
}

/**
 * Get error message for a specific field.
 */
export function getFieldErrorMessage(errors: ValidationError[], field: string): string | null {
  const error = errors.find((e) => e.field === field);
  return error?.message ?? null;
}
