/**
 * Modal state management for personnel management.
 * Consolidates 8+ modal states into a single state machine.
 */

import type { User } from '../../types';

export type ModalActionType =
  | 'create'
  | 'reset-pin'
  | 'bulk-reset-pin'
  | 'import'
  | 'detail'
  | 'delete'
  | 'unlock'
  | 'role-edit'
  | 'batch-delete'
  | 'batch-role'
  | 'batch-toggle'
  | null;

export interface ModalState {
  type: ModalActionType;
  user?: User | null;
  users?: User[];
}

export interface ModalContextData {
  state: ModalState;
  selectedUser: User | null;
  selectedUserIds: Set<string>;
  formData: Record<string, unknown>;
}

export const INITIAL_MODAL_STATE: ModalState = { type: null };

/**
 * Helper functions for modal state management
 */

export function openCreateModal(): ModalState {
  return { type: 'create' };
}

export function openResetPinModal(user: User): ModalState {
  return { type: 'reset-pin', user };
}

export function openBulkResetPinModal(): ModalState {
  return { type: 'bulk-reset-pin' };
}

export function openImportModal(): ModalState {
  return { type: 'import' };
}

export function openDetailModal(user: User): ModalState {
  return { type: 'detail', user };
}

export function openDeleteModal(user: User): ModalState {
  return { type: 'delete', user };
}

export function openUnlockModal(user: User): ModalState {
  return { type: 'unlock', user };
}

export function openRoleEditModal(user: User): ModalState {
  return { type: 'role-edit', user };
}

export function openBatchDeleteModal(users: User[]): ModalState {
  return { type: 'batch-delete', users };
}

export function openBatchRoleModal(users: User[]): ModalState {
  return { type: 'batch-role', users };
}

export function openBatchToggleModal(users: User[]): ModalState {
  return { type: 'batch-toggle', users };
}

export function closeModal(): ModalState {
  return { type: null };
}

/**
 * Get modal title based on action type
 */
export function getModalTitle(state: ModalState): string {
  switch (state.type) {
    case 'create':
      return 'Tambah Personel Baru';
    case 'reset-pin':
      return `Reset PIN — ${state.user?.nama || ''}`;
    case 'bulk-reset-pin':
      return 'Reset PIN Massal';
    case 'import':
      return 'Import Personel dari CSV';
    case 'detail':
      return `Detail Personel — ${state.user?.nama || ''}`;
    case 'delete':
      return `Hapus Personel — ${state.user?.nama || ''}`;
    case 'unlock':
      return `Buka Kunci Akun — ${state.user?.nama || ''}`;
    case 'role-edit':
      return `Ubah Role — ${state.user?.nama || ''}`;
    case 'batch-delete':
      return `Hapus ${state.users?.length || 0} Personel`;
    case 'batch-role':
      return `Ubah Role ${state.users?.length || 0} Personel`;
    case 'batch-toggle':
      return `Toggle Status ${state.users?.length || 0} Personel`;
    default:
      return '';
  }
}

/**
 * Get modal size based on action type
 */
export function getModalSize(state: ModalState): 'sm' | 'md' | 'lg' {
  switch (state.type) {
    case 'import':
      return 'lg';
    case 'create':
    case 'detail':
      return 'md';
    default:
      return 'sm';
  }
}

/**
 * Check if modal is open
 */
export function isModalOpen(state: ModalState): boolean {
  return state.type !== null;
}

/**
 * Check if modal is of specific type
 */
export function isModalType(state: ModalState, type: ModalActionType): boolean {
  return state.type === type;
}

/**
 * Check if modal is batch operation (operates on multiple users)
 */
export function isBatchOperation(state: ModalState): boolean {
  return ['batch-delete', 'batch-role', 'batch-toggle', 'bulk-reset-pin'].includes(state.type || '');
}
