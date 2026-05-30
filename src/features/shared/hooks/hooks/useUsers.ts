import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchUsers as apiFetchUsers,
  fetchUsersPage as apiFetchUsersPage,
  countUsers as apiCountUsers,
  fetchUserById as apiFetchUserById,
  createUserWithPin,
  patchUser,
  deleteUser as apiDeleteUser,
  resetUserPin as apiResetUserPin,
  updateOwnProfile as apiUpdateOwnProfile,
  type UpdateOwnProfileParams,
} from '../lib/api/users';
import { handleError } from '../lib/handleError';
import { notifyDataChanged, subscribeDataChanges } from '../lib/dataSync';
import { isRoleKomandan } from '../lib/rolePermissions';
import { readSessionContext } from '../lib/sessionContext';
import { globalRequestCoalescer, createRequestKey } from '../lib/requestCoalescer600';
import { userSearchCache, createUserSearchCacheKey } from '../lib/cacheWithTTL600';
import type { User, Role } from '../types';
import { useAuthStore } from '../store/authStore';

interface UseUsersOptions {
  role?: Role;
  satuan?: string;
  isActive?: boolean;
  orderBy?: 'nama' | 'created_at';
  ascending?: boolean;
  serverPaginated?: boolean;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export function useUsers(options: UseUsersOptions = {}) {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const isFetchingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const fetchUsersRef = useRef<(() => Promise<void>) | null>(null);

  const sessionContext = readSessionContext();
  const callerId = user?.id ?? sessionContext?.user_id ?? '';
  const callerRole = user?.role ?? sessionContext?.role ?? '';

  const requestParams = useMemo(() => ({
    callerId,
    callerRole,
    role: options.role,
    satuan: options.satuan,
    isActive: options.isActive,
    orderBy: options.orderBy,
    ascending: options.ascending,
    serverPaginated: options.serverPaginated ?? false,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 50,
    searchQuery: options.searchQuery ?? '',
  }), [
    callerId,
    callerRole,
    options.role,
    options.satuan,
    options.isActive,
    options.orderBy,
    options.ascending,
    options.serverPaginated,
    options.page,
    options.pageSize,
    options.searchQuery,
  ]);

  const loadUsersData = useCallback(async () => {
    if (!callerId || !callerRole) return [] as User[];

    if (!requestParams.serverPaginated) {
      const cacheKey = createRequestKey('fetch-all-users', {
        callerRole: requestParams.role,
        satuan: requestParams.satuan,
        isActive: requestParams.isActive,
      });
      
      return globalRequestCoalescer.coalesce(cacheKey, () =>
        apiFetchUsers({
          callerId,
          callerRole,
          role: requestParams.role,
          satuan: requestParams.satuan,
          isActive: requestParams.isActive,
          orderBy: requestParams.orderBy,
          ascending: requestParams.ascending,
        })
      );
    }

    const page = Math.max(1, requestParams.page);
    const offset = (page - 1) * requestParams.pageSize;
    
    // Use cache key for coalescing
    const cacheKey = createUserSearchCacheKey(
      requestParams.searchQuery,
      requestParams.role,
      requestParams.satuan,
      requestParams.isActive,
      page,
      requestParams.pageSize
    );

    // Use cache first if available and not modified filter
    const cached = userSearchCache.get(cacheKey);
    if (cached) {
      return cached.users;
    }

    // Coalesce identical requests within time window
    const coalescedKey = createRequestKey('fetch-users-page', {
      page,
      pageSize: requestParams.pageSize,
      search: requestParams.searchQuery,
      role: requestParams.role,
      satuan: requestParams.satuan,
      isActive: requestParams.isActive,
    });

    return globalRequestCoalescer.coalesce(coalescedKey, () =>
      apiFetchUsersPage({
        callerId,
        callerRole,
        role: requestParams.role,
        satuan: requestParams.satuan,
        isActive: requestParams.isActive,
        orderBy: requestParams.orderBy,
        ascending: requestParams.ascending,
        search: requestParams.searchQuery,
        limit: requestParams.pageSize,
        offset,
      }).then((data) => {
        // Cache result after fetch
        userSearchCache.set(cacheKey, { users: data, total: 0 }, 2 * 60 * 1000);
        return data;
      })
    );
  }, [callerId, callerRole, requestParams]);

  const fetchUsers = useCallback(async () => {
    if (!callerId || !callerRole) {
      setUsers([]);
      setTotalItems(0);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    isFetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const countPromise = requestParams.serverPaginated
        ? globalRequestCoalescer.coalesce(
            createRequestKey('count-users', {
              role: requestParams.role,
              satuan: requestParams.satuan,
              isActive: requestParams.isActive,
              search: requestParams.searchQuery,
            }),
            () =>
              apiCountUsers({
                callerId,
                callerRole,
                role: requestParams.role,
                satuan: requestParams.satuan,
                isActive: requestParams.isActive,
                orderBy: requestParams.orderBy,
                ascending: requestParams.ascending,
                search: requestParams.searchQuery,
                limit: requestParams.pageSize,
                offset: 0,
              })
          )
        : Promise.resolve(0);

      const [data, total] = await Promise.all([loadUsersData(), countPromise]);
      setUsers(data);
      setTotalItems(requestParams.serverPaginated ? total : data.length);
    } catch (err) {
      setError(handleError(err, 'Gagal memuat data user'));
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void fetchUsersRef.current?.();
      }
    }
  }, [callerId, callerRole, loadUsersData, requestParams]);

  useEffect(() => {
    fetchUsersRef.current = fetchUsers;
  }, [fetchUsers]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    return subscribeDataChanges('users', () => {
      void fetchUsers();
    }, { debounceMs: 220 });
  }, [fetchUsers]);

  const createUser = async (userData: Omit<User, 'id' | 'created_at' | 'updated_at' | 'is_online' | 'login_attempts'> & { pin: string }) => {
    const { pin, ...rest } = userData;
    const data = await createUserWithPin({
      nrp: rest.nrp,
      pin,
      nama: rest.nama,
      role: rest.role,
      satuan: rest.satuan,
      pangkat: rest.pangkat,
      jabatan: rest.jabatan,
    });
    if (isRoleKomandan(rest.role) && rest.level_komando && callerId && callerRole && typeof data === 'string') {
      await patchUser(callerId, callerRole, data, { level_komando: rest.level_komando });
    }
    void fetchUsers();
    notifyDataChanged('users');
    return data;
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    if (!callerId || !callerRole) throw new Error('Not authenticated');
    await patchUser(callerId, callerRole, id, updates);
    void fetchUsers();
    notifyDataChanged('users');
  };

  const toggleUserActive = async (id: string, isActive: boolean) => {
    await updateUser(id, { is_active: isActive });
  };

  const deleteUser = async (id: string) => {
    if (!callerId || !callerRole) throw new Error('Not authenticated');
    await apiDeleteUser(callerId, callerRole, id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setTotalItems((prev) => Math.max(0, prev - 1));
    void fetchUsers();
    notifyDataChanged('users');
  };

  const resetUserPin = async (userId: string, newPin: string) => {
    await apiResetUserPin(userId, newPin);
    notifyDataChanged('users');
  };

  const getUserById = async (userId: string): Promise<User> => {
    return apiFetchUserById(userId);
  };

  const updateOwnProfile = async (userId: string, params: UpdateOwnProfileParams): Promise<void> => {
    await apiUpdateOwnProfile(userId, params);
    notifyDataChanged('users');
  };

  const pageSize = options.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    users,
    isLoading,
    error,
    totalItems,
    totalPages,
    refetch: fetchUsers,
    createUser,
    updateUser,
    toggleUserActive,
    deleteUser,
    resetUserPin,
    getUserById,
    updateOwnProfile,
  };
}
