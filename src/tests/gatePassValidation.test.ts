/**
 * Test suite for Gate Pass Validation Functions
 * Tests all validation scenarios and edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  validateKeperluan,
  validateTujuan,
  validateWaktuKeluar,
  validateWaktuKembali,
  validateQrToken,
  validateGatePassForm,
  canAutoApprove,
  validateScanQrToken,
  validateStatusTransition,
} from '@/features/shared/lib/validation/gatePassValidation';

describe('Gate Pass Validation Functions', () => {
  describe('validateKeperluan', () => {
    it('should reject empty keperluan', () => {
      const result = validateKeperluan('');
      expect(result).toBeTruthy();
      expect(result?.message).toContain('harus diisi');
    });

    it('should reject non-string keperluan', () => {
      const result = validateKeperluan(null);
      expect(result).toBeTruthy();
    });

    it('should reject keperluan less than 5 characters', () => {
      const result = validateKeperluan('abc');
      expect(result).toBeTruthy();
      expect(result?.message).toContain('minimal 5 karakter');
    });

    it('should reject keperluan more than 255 characters', () => {
      const result = validateKeperluan('a'.repeat(256));
      expect(result).toBeTruthy();
      expect(result?.message).toContain('maksimal 255 karakter');
    });

    it('should accept valid keperluan', () => {
      const result = validateKeperluan('Menghadiri rapat penting');
      expect(result).toBeNull();
    });
  });

  describe('validateTujuan', () => {
    it('should reject empty tujuan', () => {
      const result = validateTujuan('');
      expect(result).toBeTruthy();
    });

    it('should reject tujuan less than 3 characters', () => {
      const result = validateTujuan('ab');
      expect(result).toBeTruthy();
      expect(result?.message).toContain('minimal 3 karakter');
    });

    it('should accept valid tujuan', () => {
      const result = validateTujuan('Bandung');
      expect(result).toBeNull();
    });
  });

  describe('validateWaktuKeluar', () => {
    it('should reject empty waktu_keluar', () => {
      const result = validateWaktuKeluar('');
      expect(result).toBeTruthy();
    });

    it('should reject invalid date format', () => {
      const result = validateWaktuKeluar('not-a-date');
      expect(result).toBeTruthy();
      expect(result?.message).toContain('tidak valid');
    });

    it('should reject past datetime', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const result = validateWaktuKeluar(past.toISOString(), now);
      expect(result).toBeTruthy();
      expect(result?.message).toContain('masa lalu');
    });

    it('should reject datetime more than 30 days in future', () => {
      const now = new Date();
      const tooFar = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      const result = validateWaktuKeluar(tooFar.toISOString(), now);
      expect(result).toBeTruthy();
      expect(result?.message).toContain('30 hari');
    });

    it('should accept valid future datetime', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      const result = validateWaktuKeluar(future.toISOString(), now);
      expect(result).toBeNull();
    });
  });

  describe('validateWaktuKembali', () => {
    it('should reject waktu_kembali before or equal to waktu_keluar', () => {
      const keluar = new Date().toISOString();
      const result = validateWaktuKembali(keluar, keluar);
      expect(result).toBeTruthy();
      expect(result?.message).toContain('setelah');
    });

    it('should reject duration more than 7 days', () => {
      const now = new Date();
      const keluar = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
      const kembali = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateWaktuKembali(kembali, keluar, now);
      expect(result).toBeTruthy();
      expect(result?.message).toContain('7 hari');
    });

    it('should accept valid duration', () => {
      const now = new Date();
      const keluar = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
      const kembali = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
      const result = validateWaktuKembali(kembali, keluar, now);
      expect(result).toBeNull();
    });
  });

  describe('validateQrToken', () => {
    it('should reject invalid QR token format', () => {
      const result = validateQrToken('not-hex-token');
      expect(result).toBeTruthy();
    });

    it('should accept valid 64-char hex token', () => {
      const token = 'a'.repeat(64);
      const result = validateQrToken(token);
      expect(result).toBeNull();
    });
  });

  describe('validateGatePassForm', () => {
    const validPayload = {
      keperluan: 'Menghadiri rapat',
      tujuan: 'Bandung',
      waktu_keluar: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      waktu_kembali: new Date(Date.now() + 5 * 1000 * 60 * 60).toISOString(),
    };

    it('should return valid result for correct form', () => {
      const result = validateGatePassForm(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accumulate multiple errors', () => {
      const payload = {
        keperluan: 'a',
        tujuan: '',
        waktu_keluar: 'invalid',
        waktu_kembali: 'invalid',
      };
      const result = validateGatePassForm(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for long duration', () => {
      const now = new Date();
      const payload = {
        keperluan: 'Long trip',
        tujuan: 'Destination',
        waktu_keluar: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
        waktu_kembali: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const result = validateGatePassForm(payload);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('canAutoApprove', () => {
    it('should auto-approve komandan submissions', () => {
      const result = canAutoApprove({
        executorRole: 'komandan',
      });
      expect(result).toBe(true);
    });

    it('should auto-approve admin submissions', () => {
      const result = canAutoApprove({
        executorRole: 'admin_satuan',
      });
      expect(result).toBe(true);
    });

    it('should auto-approve prajurit with good history', () => {
      const result = canAutoApprove({
        executorRole: 'prajurit',
        previousApprovals: 5,
        isRepeatedDestination: true,
        isDuringWorkingHours: true,
      });
      expect(result).toBe(true);
    });

    it('should not auto-approve prajurit without good history', () => {
      const result = canAutoApprove({
        executorRole: 'prajurit',
        previousApprovals: 1,
        isRepeatedDestination: false,
        isDuringWorkingHours: true,
      });
      expect(result).toBe(false);
    });

    it('should not auto-approve guard', () => {
      const result = canAutoApprove({
        executorRole: 'guard',
      });
      expect(result).toBe(false);
    });
  });

  describe('validateScanQrToken', () => {
    it('should reject empty QR token', () => {
      const result = validateScanQrToken('');
      expect(result.isValid).toBe(false);
    });

    it('should reject short QR token', () => {
      const result = validateScanQrToken('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('pendek');
    });

    it('should accept valid QR token', () => {
      const result = validateScanQrToken('a'.repeat(64));
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow pending -> approved', () => {
      const result = validateStatusTransition('pending', 'approved');
      expect(result.isValid).toBe(true);
    });

    it('should allow pending -> rejected', () => {
      const result = validateStatusTransition('pending', 'rejected');
      expect(result.isValid).toBe(true);
    });

    it('should not allow pending -> completed', () => {
      const result = validateStatusTransition('pending', 'completed');
      expect(result.isValid).toBe(false);
    });

    it('should allow approved -> checked_in', () => {
      const result = validateStatusTransition('approved', 'checked_in');
      expect(result.isValid).toBe(true);
    });

    it('should allow checked_in -> completed', () => {
      const result = validateStatusTransition('checked_in', 'completed');
      expect(result.isValid).toBe(true);
    });

    it('should not allow completed -> any status', () => {
      const result = validateStatusTransition('completed', 'approved');
      expect(result.isValid).toBe(false);
    });
  });
});
