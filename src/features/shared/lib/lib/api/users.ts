import { supabase } from '../supabase';
import { normalizeRole } from '../rolePermissions';
import type { User, Role, DisciplineNote } from '../../types';

// Helper: validate ID format (strict for real UUID, lenient for test IDs)
function validateId(value: string): boolean {
  if (!value) return false;
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
  const testLike = /^[a-z0-9-]{2,64}$/i.test(value);
  return uuidLike || testLike;
}

export interface FetchUsersParams {
  callerId: string;
  callerRole: string;
  role?: Role;
  satuan?: string;
  isActive?: boolean;
  orderBy?: 'nama' | 'created_at';
  ascending?: boolean;
}

export interface FetchUsersPageParams extends FetchUsersParams {
  search?: string;
  limit?: number;
  offset?: number;
}

function normalizeUserRole(user: User): User {
  return {
    ...user,
    role: normalizeRole(user.role) as User['role'],
  };
}

export async function fetchUsers(params: FetchUsersParams): Promise<User[]> {
  const { data, error } = await supabase.rpc('api_get_users', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_role_filter: params.role ?? null,
    p_satuan_filter: params.satuan ?? null,
    p_is_active: params.isActive ?? null,
    p_order_by: params.orderBy ?? 'nama',
    p_ascending: params.ascending ?? true,
  });
  if (error) throw error;
  return ((data as unknown as User[]) ?? []).map(normalizeUserRole);
}

export async function fetchUsersPage(params: FetchUsersPageParams): Promise<User[]> {
  const { data, error } = await supabase.rpc('api_get_users_page', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_role_filter: params.role ?? null,
    p_satuan_filter: params.satuan ?? null,
    p_is_active: params.isActive ?? null,
    p_order_by: params.orderBy ?? 'nama',
    p_ascending: params.ascending ?? true,
    p_search: params.search?.trim() ? params.search.trim() : null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return ((data as unknown as User[]) ?? []).map(normalizeUserRole);
}

export async function countUsers(params: FetchUsersPageParams): Promise<number> {
  const { data, error } = await supabase.rpc('api_count_users_filtered', {
    p_user_id: params.callerId,
    p_role: params.callerRole,
    p_role_filter: params.role ?? null,
    p_satuan_filter: params.satuan ?? null,
    p_is_active: params.isActive ?? null,
    p_search: params.search?.trim() ? params.search.trim() : null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function createUserWithPin(userData: {
  nrp: string;
  pin: string;
  nama: string;
  role: Role;
  satuan: string;
  pangkat?: string;
  jabatan?: string;
}): Promise<unknown> {
  const { data, error } = await supabase.rpc('create_user_with_pin', {
    p_nrp: userData.nrp,
    p_pin: userData.pin,
    p_nama: userData.nama,
    p_role: userData.role,
    p_satuan: userData.satuan,
    p_pangkat: userData.pangkat ?? null,
    p_jabatan: userData.jabatan ?? null,
  });
  if (error) throw error;
  return data;
}

export async function patchUser(callerId: string, callerRole: string, id: string, updates: Partial<User>): Promise<void> {
  if (!validateId(callerId)) throw new Error('Invalid caller ID format');
  if (!validateId(id)) throw new Error('Invalid user ID format');

  const { error } = await supabase.rpc('api_update_user', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_target_id: id,
    p_updates: updates,
  });
  if (error) throw error;
}

export async function deleteUser(callerId: string, callerRole: string, id: string): Promise<void> {
  if (!validateId(callerId)) throw new Error('Invalid caller ID format');
  if (!validateId(id)) throw new Error('Invalid user ID format');

  const { error } = await supabase.rpc('api_delete_user', {
    p_caller_id: callerId,
    p_caller_role: callerRole,
    p_target_id: id,
  });
  if (error) throw error;
}

export async function resetUserPin(userId: string, newPin: string): Promise<void> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');

  const { error } = await supabase.rpc('reset_user_pin', {
    p_user_id: userId,
    p_new_pin: newPin,
  });
  if (error) throw error;
}

export async function fetchUserById(userId: string): Promise<User> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');

  const { data, error } = await supabase.rpc('get_user_detail', { p_user_id: userId }).single();
  if (error) throw error;
  return normalizeUserRole(data as User);
}

export interface UpdateOwnProfileParams {
  tempat_lahir?: string;
  tanggal_lahir?: string;
  no_telepon?: string;
  alamat?: string;
  pendidikan_terakhir?: string;
  agama?: string;
  status_pernikahan?: User['status_pernikahan'];
  golongan_darah?: User['golongan_darah'];
  kontak_darurat_nama?: string;
  kontak_darurat_telp?: string;
}

export async function updateOwnProfile(userId: string, params: UpdateOwnProfileParams): Promise<void> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');

  const { error } = await supabase.rpc('update_own_profile', {
    p_user_id: userId,
    p_tempat_lahir: params.tempat_lahir ?? null,
    p_tanggal_lahir: params.tanggal_lahir ?? null,
    p_no_telepon: params.no_telepon ?? null,
    p_alamat: params.alamat ?? null,
    p_pendidikan_terakhir: params.pendidikan_terakhir ?? null,
    p_agama: params.agama ?? null,
    p_status_pernikahan: params.status_pernikahan ?? null,
    p_golongan_darah: params.golongan_darah ?? null,
    p_kontak_darurat_nama: params.kontak_darurat_nama ?? null,
    p_kontak_darurat_telp: params.kontak_darurat_telp ?? null,
  });
  if (error) throw error;
}

// ── User personal stats ──────────────────────────────────────────────────────

export interface UserPersonalStats {
  totalTasks: number;
  approvedTasks: number;
  totalAttendance: number;
  hadirCount: number;
}

export async function fetchUserPersonalStats(userId: string): Promise<UserPersonalStats> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');

  const { data, error } = await supabase.rpc('api_get_user_personal_stats', {
    p_user_id: userId,
  });

  if (error) throw error;

  const stats = (data as UserPersonalStats | null) ?? null;
  if (!stats) {
    return {
      totalTasks: 0,
      approvedTasks: 0,
      totalAttendance: 0,
      hadirCount: 0,
    };
  }

  return stats;
}

// ── Discipline notes ─────────────────────────────────────────────────────────

export async function fetchUserDisciplineNotes(userId: string): Promise<DisciplineNote[]> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');

  const { data, error } = await supabase.rpc('api_get_user_discipline_notes', {
    p_user_id: userId,
  });

  if (error) throw error;
  return (data ?? []) as DisciplineNote[];
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

export interface UploadAvatarResult {
  publicUrl: string;
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadAvatarResult> {
  if (!validateId(userId)) throw new Error('Invalid user ID format');
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar (JPG, PNG, WebP)');
  if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran file maksimal 2 MB');

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase.rpc('api_update_user_avatar', {
    p_user_id: userId,
    p_avatar_url: publicUrl,
  });

  if (updateError) throw updateError;

  return { publicUrl };
}
