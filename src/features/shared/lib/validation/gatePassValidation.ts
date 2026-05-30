/**
 * Comprehensive validation functions for Gate Pass operations.
 * Centralized, reusable validation logic.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface GatePassValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/** Validate keperluan (reason for leave) */
export function validateKeperluan(keperluan: unknown): ValidationError | null {
  if (!keperluan || typeof keperluan !== 'string') {
    return { field: 'keperluan', message: 'Keperluan harus diisi' };
  }
  const trimmed = keperluan.trim();
  if (trimmed.length < 5) {
    return { field: 'keperluan', message: 'Keperluan minimal 5 karakter' };
  }
  if (trimmed.length > 255) {
    return { field: 'keperluan', message: 'Keperluan maksimal 255 karakter' };
  }
  return null;
}

/** Validate tujuan (destination) */
export function validateTujuan(tujuan: unknown): ValidationError | null {
  if (!tujuan || typeof tujuan !== 'string') {
    return { field: 'tujuan', message: 'Tujuan harus diisi' };
  }
  const trimmed = tujuan.trim();
  if (trimmed.length < 3) {
    return { field: 'tujuan', message: 'Tujuan minimal 3 karakter' };
  }
  if (trimmed.length > 255) {
    return { field: 'tujuan', message: 'Tujuan maksimal 255 karakter' };
  }
  return null;
}

/** Validate waktu_keluar (departure time) */
export function validateWaktuKeluar(waktuKeluar: unknown, now: Date = new Date()): ValidationError | null {
  if (!waktuKeluar || typeof waktuKeluar !== 'string') {
    return { field: 'waktu_keluar', message: 'Waktu keluar harus diisi' };
  }
  const departureDate = new Date(waktuKeluar);
  if (Number.isNaN(departureDate.getTime())) {
    return { field: 'waktu_keluar', message: 'Format waktu keluar tidak valid' };
  }
  if (departureDate < now) {
    return { field: 'waktu_keluar', message: 'Waktu keluar tidak boleh di masa lalu' };
  }
  // Max 30 days in future
  const maxFutureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (departureDate > maxFutureDate) {
    return { field: 'waktu_keluar', message: 'Waktu keluar tidak boleh lebih dari 30 hari ke depan' };
  }
  return null;
}

/** Validate waktu_kembali (return time) */
export function validateWaktuKembali(
  waktuKembali: unknown,
  waktuKeluar: string,
  now: Date = new Date()
): ValidationError | null {
  if (!waktuKembali || typeof waktuKembali !== 'string') {
    return { field: 'waktu_kembali', message: 'Waktu kembali harus diisi' };
  }
  const returnDate = new Date(waktuKembali);
  const departureDate = new Date(waktuKeluar);
  
  if (Number.isNaN(returnDate.getTime())) {
    return { field: 'waktu_kembali', message: 'Format waktu kembali tidak valid' };
  }
  if (returnDate <= departureDate) {
    return { field: 'waktu_kembali', message: 'Waktu kembali harus setelah waktu keluar' };
  }

  // Max 30 days from now
  const maxFutureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (returnDate > maxFutureDate) {
    return { field: 'waktu_kembali', message: 'Waktu kembali tidak boleh lebih dari 30 hari ke depan' };
  }

  // Duration validation: max 7 days
  const durationMs = returnDate.getTime() - departureDate.getTime();
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  if (durationDays > 7) {
    return { field: 'waktu_kembali', message: 'Durasi izin maksimal 7 hari' };
  }

  return null;
}

/** Validate QR token format */
export function validateQrToken(qrToken: unknown): ValidationError | null {
  if (!qrToken || typeof qrToken !== 'string') {
    return { field: 'qr_token', message: 'QR token harus diisi' };
  }
  // QR token should be 64 hex characters (32 bytes)
  if (!/^[a-f0-9]{64}$/i.test(qrToken)) {
    return { field: 'qr_token', message: 'Format QR token tidak valid' };
  }
  return null;
}

/** Comprehensive validation for Gate Pass creation */
export function validateGatePassForm(payload: {
  keperluan: unknown;
  tujuan: unknown;
  waktu_keluar: unknown;
  waktu_kembali: unknown;
  qr_token?: unknown;
}): GatePassValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const now = new Date();

  // Validate keperluan
  const keperluanErr = validateKeperluan(payload.keperluan);
  if (keperluanErr) errors.push(keperluanErr);

  // Validate tujuan
  const tujuanErr = validateTujuan(payload.tujuan);
  if (tujuanErr) errors.push(tujuanErr);

  // Validate waktu_keluar
  const waktuKeluarErr = validateWaktuKeluar(payload.waktu_keluar, now);
  if (waktuKeluarErr) errors.push(waktuKeluarErr);

  // Validate waktu_kembali (requires valid waktu_keluar)
  if (payload.waktu_keluar && typeof payload.waktu_keluar === 'string' && !waktuKeluarErr) {
    const waktuKembaliErr = validateWaktuKembali(payload.waktu_kembali, payload.waktu_keluar, now);
    if (waktuKembaliErr) errors.push(waktuKembaliErr);
  } else if (payload.waktu_kembali) {
    errors.push({ field: 'waktu_kembali', message: 'Tentukan waktu keluar terlebih dahulu' });
  }

  // Validate QR token if provided
  if (payload.qr_token) {
    const qrErr = validateQrToken(payload.qr_token);
    if (qrErr) errors.push(qrErr);
  }

  // Warnings
  const departureDate = new Date(payload.waktu_keluar as string);
  const hoursUntilDeparture = Math.abs(departureDate.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursUntilDeparture < 1) {
    warnings.push('Waktu keluar kurang dari 1 jam, pastikan sudah siap');
  }

  const returnDate = new Date(payload.waktu_kembali as string);
  const durationDays = Math.abs(returnDate.getTime() - departureDate.getTime()) / (24 * 60 * 60 * 1000);
  if (durationDays > 5) {
    warnings.push('Durasi izin lebih dari 5 hari, pastikan sudah koordinasi dengan komandan');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Check if gate pass can be auto-approved */
export interface AutoApprovalCriteria {
  executorRole?: string;
  userRank?: string;
  previousApprovals?: number;
  isRepeatedDestination?: boolean;
  isDuringWorkingHours?: boolean;
}

export function canAutoApprove(criteria: AutoApprovalCriteria): boolean {
  // Komandan always auto-approve
  if (criteria.executorRole === 'komandan') {
    return true;
  }

  // Admin can force approve
  if (criteria.executorRole === 'admin') {
    return true;
  }

  // Prajurit with good history (3+ previous approvals) + repeated destination + during working hours
  if (
    criteria.executorRole === 'prajurit' &&
    criteria.previousApprovals !== undefined &&
    criteria.previousApprovals >= 3 &&
    criteria.isRepeatedDestination &&
    criteria.isDuringWorkingHours
  ) {
    return true;
  }

  return false;
}

/** Validate scan result */
export interface ScanValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export function validateScanQrToken(qrToken: unknown): ScanValidationResult {
  if (!qrToken || typeof qrToken !== 'string') {
    return { isValid: false, error: 'QR token harus diisi' };
  }

  if (!qrToken.trim()) {
    return { isValid: false, error: 'QR token tidak boleh kosong' };
  }

  // Minimum length for normalized token
  if (qrToken.length < 10) {
    return { isValid: false, error: 'QR token terlalu pendek' };
  }

  return { isValid: true };
}

/** Validate status transition */
export function validateStatusTransition(
  fromStatus: string,
  toStatus: string,
): ScanValidationResult {
  const validTransitions: Record<string, string[]> = {
    pending: ['approved', 'rejected'],
    approved: ['checked_in', 'out'],
    checked_in: ['completed', 'returned', 'overdue'],
    out: ['returned', 'completed', 'overdue'],
    rejected: [],
    completed: [],
    returned: [],
    overdue: ['completed', 'returned'],
  };

  const allowedDestinations = validTransitions[fromStatus] ?? [];
  if (!allowedDestinations.includes(toStatus)) {
    return {
      isValid: false,
      error: `Status transition dari '${fromStatus}' ke '${toStatus}' tidak diizinkan`,
    };
  }

  return { isValid: true };
}
