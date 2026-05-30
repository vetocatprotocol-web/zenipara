import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import { DEFAULT_FEATURE_FLAGS } from '@/features/shared/lib/featureFlags';
import { updateFeatureFlag, updateFeatureFlags } from '@/features/shared/lib/api/featureFlags';

const mockSupabase = supabase as unknown as {
  rpc: ReturnType<typeof vi.fn>;
};

const adminId = '11111111-1111-1111-1111-111111111111';
const adminRole = 'admin_satuan';

describe('featureFlags API fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses single update RPC when available', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await updateFeatureFlag(adminId, adminRole, 'tasks', false);

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_feature_flag', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_key: 'tasks',
      p_is_enabled: false,
    });
  });

  it('falls back to batch RPC when single update RPC is missing', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.update_feature_flag' },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await updateFeatureFlag(adminId, adminRole, 'messages', true);

    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'update_feature_flag', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_key: 'messages',
      p_is_enabled: true,
    });
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'update_feature_flags', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_flags: { messages: true },
    });
  });

  it('falls back to batch RPC when single update RPC returns ambiguous feature_key error', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column reference "feature_key" is ambiguous' },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await updateFeatureFlag(adminId, adminRole, 'messages', true);

    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'update_feature_flag', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_key: 'messages',
      p_is_enabled: true,
    });
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'update_feature_flags', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_flags: { messages: true },
    });
  });

  it('falls back to single update RPC loop when batch RPC is missing', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.update_feature_flags' },
      })
      .mockResolvedValue({ data: null, error: null });

    await updateFeatureFlags(adminId, adminRole, {
      ...DEFAULT_FEATURE_FLAGS,
      tasks: false,
      reports: false,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_feature_flags', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_flags: expect.objectContaining({ tasks: false, reports: false }),
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_feature_flag', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_key: 'tasks',
      p_is_enabled: false,
    });
  });

  it('falls back to single update RPC loop when batch RPC returns ambiguous feature_key error', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column reference "feature_key" is ambiguous' },
      })
      .mockResolvedValue({ data: null, error: null });

    await updateFeatureFlags(adminId, adminRole, {
      ...DEFAULT_FEATURE_FLAGS,
      tasks: false,
      reports: false,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_feature_flags', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_flags: expect.objectContaining({ tasks: false, reports: false }),
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_feature_flag', {
      p_user_id: adminId,
      p_role: adminRole,
      p_feature_key: 'tasks',
      p_is_enabled: false,
    });
  });

  it('throws user-friendly error from supabase payload', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    await expect(updateFeatureFlag(adminId, adminRole, 'tasks', false)).rejects.toThrow('Unauthorized');
  });
});
