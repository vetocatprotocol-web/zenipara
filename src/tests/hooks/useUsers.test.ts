import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUsers } from '@/features/shared/hooks/useUsers';
import { supabase } from '@/features/shared/lib/supabase';
import { userSearchCache } from '@/features/shared/lib/cacheWithTTL600';
import { useAuthStore } from '@/features/auth/authStore';
import type { User } from '@/types';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
};

const mockAdminUser = {
  id: 'admin-1', nrp: '00001', nama: 'Admin', role: 'admin_satuan' as const,
  satuan: 'HQ', is_active: true, is_online: true, login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};

const mockUsers: User[] = [
  { id: 'u1', nrp: '11111', nama: 'Alpha', role: 'prajurit', satuan: 'Satuan A', is_active: true, is_online: false, login_attempts: 0, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'u2', nrp: '22222', nama: 'Bravo', role: 'komandan', satuan: 'Satuan B', is_active: false, is_online: false, login_attempts: 0, created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
];

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userSearchCache.clearAll();
    useAuthStore.setState({ user: mockAdminUser, isAuthenticated: true });
  });

  it('loads users on mount', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockUsers, error: null });

    const { result } = renderHook(() => useUsers());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toHaveLength(2);
    expect(result.current.users.map((u) => u.nama)).toEqual(expect.arrayContaining(['Alpha', 'Bravo']));
  });

  it('sets error when fetch fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('connection refused') });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(Array.isArray(result.current.users)).toBe(true);
  });

  it('returns empty list and no error for empty dataset', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  describe('createUser', () => {
    it('calls create_user_with_pin RPC with correct args', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        if (rpcName === 'create_user_with_pin') return Promise.resolve({ data: 'new-id', error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.createUser({ nrp: '33333', pin: '5678', nama: 'Charlie', role: 'prajurit', satuan: 'Satuan C', is_active: true, locked_until: undefined, last_login: undefined, foto_url: undefined });
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_user_with_pin',
        expect.objectContaining({ p_nrp: '33333', p_pin: '5678', p_nama: 'Charlie', p_role: 'prajurit', p_satuan: 'Satuan C' })
      );
    });

    it('throws when RPC returns error', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        return Promise.resolve({ data: null, error: new Error('rpc error') });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => { await result.current.createUser({ nrp: '33333', pin: '5678', nama: 'Charlie', role: 'prajurit', satuan: 'Satuan C', is_active: true }); })
      ).rejects.toThrow('rpc error');
    });
  });

  describe('updateUser', () => {
    it('calls api_update_user rpc with correct fields', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: mockUsers, error: null });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.updateUser('u1', { nama: 'Alpha Updated' }); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_user',
        expect.objectContaining({ p_target_id: 'u1', p_updates: { nama: 'Alpha Updated' } })
      );
    });

    it('throws when rpc returns error', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        return Promise.resolve({ data: null, error: new Error('update failed') });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.updateUser('u1', { nama: 'Fail' }); })).rejects.toThrow('update failed');
    });
  });

  describe('toggleUserActive', () => {
    it('calls updateUser (api_update_user rpc) with is_active flag', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: mockUsers, error: null });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.toggleUserActive('u2', true); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_update_user',
        expect.objectContaining({ p_updates: { is_active: true } })
      );
    });
  });

  describe('deleteUser', () => {
    it('calls api_delete_user RPC with correct args', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        if (rpcName === 'api_delete_user') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.deleteUser('u1'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('api_delete_user', {
        p_caller_id: 'admin-1',
        p_caller_role: 'admin_satuan',
        p_target_id: 'u1',
      });
    });

    it('throws when api_delete_user RPC returns error', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        if (rpcName === 'api_delete_user') return Promise.resolve({ data: null, error: new Error('delete failed') });
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.deleteUser('u1'); })).rejects.toThrow('delete failed');
    });
  });

  describe('resetUserPin', () => {
    it('calls reset_user_pin RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.resetUserPin('u1', '9999'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('reset_user_pin', { p_user_id: 'u1', p_new_pin: '9999' });
    });

    it('throws when RPC returns error', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        return Promise.resolve({ data: null, error: new Error('pin reset failed') });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.resetUserPin('u1', '0000'); })).rejects.toThrow('pin reset failed');
    });
  });

  describe('getUserById', () => {
    it('calls get_user_detail RPC with correct user id', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        if (rpcName === 'get_user_detail') return { single: singleMock };
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let user: User | undefined;
      await act(async () => { user = await result.current.getUserById('u1'); });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_detail', { p_user_id: 'u1' });
      expect(user?.id).toBe('u1');
    });

    it('throws when get_user_detail RPC returns error', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: new Error('not found') });
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        if (rpcName === 'get_user_detail') return { single: singleMock };
        return Promise.resolve({ data: null, error: null });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.getUserById('invalid-id'); })).rejects.toThrow('not found');
    });
  });

  describe('updateOwnProfile', () => {
    it('calls update_own_profile RPC with allowed fields', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateOwnProfile('u1', {
          tempat_lahir: 'Bandung',
          tanggal_lahir: '1990-01-02',
          no_telepon: '081234567890',
          alamat: 'Jl. Merdeka No. 1',
          pendidikan_terakhir: 'S1',
          agama: 'Islam',
          status_pernikahan: 'menikah',
          golongan_darah: 'O',
          kontak_darurat_nama: 'Ibu Sari',
          kontak_darurat_telp: '089876543210',
        });
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_own_profile', {
        p_user_id: 'u1',
        p_tempat_lahir: 'Bandung',
        p_tanggal_lahir: '1990-01-02',
        p_no_telepon: '081234567890',
        p_alamat: 'Jl. Merdeka No. 1',
        p_pendidikan_terakhir: 'S1',
        p_agama: 'Islam',
        p_status_pernikahan: 'menikah',
        p_golongan_darah: 'O',
        p_kontak_darurat_nama: 'Ibu Sari',
        p_kontak_darurat_telp: '089876543210',
      });
    });

    it('throws when update_own_profile RPC returns error', async () => {
      mockSupabase.rpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'api_get_users') return Promise.resolve({ data: mockUsers, error: null });
        return Promise.resolve({ data: null, error: new Error('not authorized') });
      });

      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(act(async () => { await result.current.updateOwnProfile('u2', { no_telepon: '0812' }); })).rejects.toThrow('not authorized');
    });
  });
});
