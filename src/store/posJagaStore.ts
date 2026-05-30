import { create } from 'zustand';
import {
  fetchAllPosJaga,
  insertPosJaga,
  patchPosJagaActive,
  deletePosJaga as apiDeletePosJaga,
  renamePosJaga as apiRenamePosJaga,
  rotatePosJagaQr as apiRotatePosJagaQr,
  rpcScanPosJagaWithCredentials,
} from '@/features/shared/lib/api/posJaga';
import type { PosJaga, ScanPosJagaResult } from '../types';
import { useAuthStore } from './authStore';
import { normalizeScannedQrToken } from '../utils/gatepass';

interface PosJagaState {
  posJagaList: PosJaga[];
  fetchPosJaga: () => Promise<void>;
  createPosJaga: (nama: string) => Promise<PosJaga>;
  setActive: (id: string, is_active: boolean) => Promise<void>;
  deletePosJaga: (id: string) => Promise<void>;
  renamePosJaga: (id: string, nama: string) => Promise<void>;
  rotateQr: (id: string) => Promise<PosJaga>;
  scanPosJaga: (posToken: string, nrp: string, pin: string) => Promise<ScanPosJagaResult>;
}

export const usePosJagaStore = create<PosJagaState>()((set, get) => ({
  posJagaList: [],

  async fetchPosJaga() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const data = await fetchAllPosJaga(user.id, user.role);
    set({ posJagaList: data });
  },

  async createPosJaga(nama) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const created = await insertPosJaga(user.id, user.role, { nama });
    set((state) => ({
      posJagaList: [created, ...state.posJagaList.filter((p) => p.id !== created.id)],
    }));
    return created;
  },

  async setActive(id, is_active) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    await patchPosJagaActive(user.id, user.role, id, is_active);
    await get().fetchPosJaga();
  },

  async deletePosJaga(id) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    await apiDeletePosJaga(user.id, user.role, id);
    set((state) => ({ posJagaList: state.posJagaList.filter((p) => p.id !== id) }));
  },

  async renamePosJaga(id, nama) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const updated = await apiRenamePosJaga(user.id, user.role, id, nama);
    set((state) => ({
      posJagaList: state.posJagaList.map((p) => (p.id === id ? updated : p)),
    }));
  },

  async rotateQr(id) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User tidak ditemukan');
    const updated = await apiRotatePosJagaQr(user.id, user.role, id);
    set((state) => ({
      posJagaList: state.posJagaList.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  async scanPosJaga(posToken, nrp, pin) {
    return rpcScanPosJagaWithCredentials(normalizeScannedQrToken(posToken), nrp, pin);
  },
}));
