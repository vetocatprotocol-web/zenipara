/**
 * Toast notification system for user feedback
 * More advanced than simple alerts
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number; // ms, 0 = permanent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toastItem) => toastItem.id !== id),
        }));
      }, toast.duration ?? 4000);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toastItem) => toastItem.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Helper functions
export function useToast() {
  const { addToast, removeToast, clearAll } = useToastStore();

  return {
    success: (message: string, description?: string) =>
      addToast({ type: 'success', message, description }),
    error: (message: string, description?: string) =>
      addToast({ type: 'error', message, description, duration: 6000 }),
    info: (message: string, description?: string) =>
      addToast({ type: 'info', message, description }),
    warning: (message: string, description?: string) =>
      addToast({ type: 'warning', message, description, duration: 5000 }),
    custom: (toast: Omit<Toast, 'id'>) => addToast(toast),
    remove: removeToast,
    clearAll,
  };
}
