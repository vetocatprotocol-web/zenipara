/**
 * Batch operations utilities for personnel management.
 * Provides consistent UI and logic for batch operations.
 */

import type { User } from '../../types';

export interface BatchOperation {
  id: string;
  label: string;
  description?: string;
  requiresConfirm: boolean;
  warningText?: string;
  inputFields?: BatchOperationField[];
  onExecute: (selectedUsers: User[], inputValues?: Record<string, unknown>) => Promise<void>;
}

export interface BatchOperationField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  maxLength?: number;
}

export interface BatchProgressInfo {
  current: number;
  total: number;
  currentLabel?: string;
}

/**
 * Get the appropriate batch operations available for selected users
 */
export function getAvailableBatchOperations(
  selectedCount: number,
  isAdmin: boolean,
): BatchOperation[] {
  if (selectedCount === 0) return [];

  const operations: BatchOperation[] = [
    {
      id: 'bulk-reset-pin',
      label: `Reset PIN (${selectedCount})`,
      description: 'Atur ulang PIN untuk semua personel yang dipilih',
      requiresConfirm: true,
      warningText: `Semua ${selectedCount} personel akan mendapat PIN yang sama. Pastikan PIN disebarkan dengan aman.`,
      inputFields: [
        {
          id: 'pin',
          label: 'PIN Baru',
          type: 'password',
          placeholder: '6 digit angka',
          required: true,
          maxLength: 6,
          helpText: 'PIN harus 6 digit angka',
        },
      ],
      onExecute: async () => {
        // Implementation in component
      },
    },
  ];

  // Admin-only operations
  if (isAdmin) {
    operations.push(
      {
        id: 'batch-toggle-active',
        label: `Toggle Status (${selectedCount})`,
        description: 'Aktifkan atau nonaktifkan akun untuk personel yang dipilih',
        requiresConfirm: true,
        inputFields: [
          {
            id: 'action',
            label: 'Aksi',
            type: 'select',
            required: true,
            options: [
              { value: 'activate', label: 'Aktifkan Semua' },
              { value: 'deactivate', label: 'Nonaktifkan Semua' },
              { value: 'toggle', label: 'Balik Status' },
            ],
          },
        ],
        onExecute: async () => {
          // Implementation in component
        },
      },
      {
        id: 'batch-delete',
        label: `Hapus (${selectedCount})`,
        description: 'Hapus permanen untuk personel yang dipilih',
        requiresConfirm: true,
        warningText: `Anda akan menghapus ${selectedCount} personel secara permanen. Tindakan ini tidak dapat dibatalkan.`,
        onExecute: async () => {
          // Implementation in component
        },
      },
    );
  }

  return operations;
}

/**
 * Format batch operation result
 */
export interface BatchOperationResult {
  success: number;
  failed: number;
  skipped?: number;
  errors?: Array<{ id: string; error: string }>;
}

export function formatBatchResult(result: BatchOperationResult): string {
  const parts = [];
  if (result.success > 0) {
    parts.push(`${result.success} berhasil`);
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} gagal`);
  }
  if (result.skipped && result.skipped > 0) {
    parts.push(`${result.skipped} dilewati`);
  }
  return parts.join(', ');
}

/**
 * Batch operations state
 */
export interface BatchOperationState {
  isRunning: boolean;
  progress: BatchProgressInfo | null;
  result: BatchOperationResult | null;
  error: string | null;
}

export const INITIAL_BATCH_STATE: BatchOperationState = {
  isRunning: false,
  progress: null,
  result: null,
  error: null,
};

export function resetBatchState(): BatchOperationState {
  return { ...INITIAL_BATCH_STATE };
}

/**
 * Chunk users for batch processing (useful for API rate limiting)
 */
export function chunkUsers(users: User[], chunkSize: number): User[][] {
  const chunks: User[][] = [];
  for (let i = 0; i < users.length; i += chunkSize) {
    chunks.push(users.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Validate batch operation inputs
 */
export function validateBatchOperationInput(
  fields: BatchOperationField[] | undefined,
  values: Record<string, unknown>,
): string | null {
  if (!fields) return null;

  for (const field of fields) {
    if (field.required && !values[field.id]) {
      return `${field.label} harus diisi`;
    }

    if (field.type === 'password' && field.id === 'pin' && values[field.id]) {
      const pin = String(values[field.id]);
      if (!/^\d{6}$/.test(pin)) {
        return 'PIN harus 6 digit angka';
      }
    }
  }

  return null;
}
