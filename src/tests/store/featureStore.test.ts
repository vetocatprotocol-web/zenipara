import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEATURE_FLAGS } from '@/features/shared/lib/featureFlags';
import { notifyDataChanged } from '@/features/shared/lib/dataSync';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { updateFeatureFlags } from '@/features/shared/lib/api/featureFlags';

vi.mock('../../lib/api/featureFlags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue(DEFAULT_FEATURE_FLAGS),
  updateFeatureFlag: vi.fn().mockResolvedValue(undefined),
  updateFeatureFlags: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/dataSync', () => ({
  notifyDataChanged: vi.fn(),
}));

const mockUpdateFeatureFlags = vi.mocked(updateFeatureFlags);
const mockNotifyDataChanged = vi.mocked(notifyDataChanged);

const now = new Date().toISOString();

function resetStore() {
  useFeatureStore.setState({
    flags: { ...DEFAULT_FEATURE_FLAGS },
    isLoaded: false,
    isLoading: false,
    isSaving: false,
    loadedForUserId: null,
  });
}

describe('featureStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        nrp: '12345',
        nama: 'Admin',
        role: 'admin',
        satuan: 'Satuan Test',
        is_active: true,
        is_online: true,
        login_attempts: 0,
        created_at: now,
        updated_at: now,
      },
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      error: null,
    });
  });

  it('can disable all features globally', async () => {
    await act(async () => {
      await useFeatureStore.getState().setAllFeaturesEnabled(false);
    });

    expect(mockUpdateFeatureFlags).toHaveBeenCalledTimes(1);
    expect(mockUpdateFeatureFlags).toHaveBeenCalledWith('admin-1', 'admin', expect.objectContaining({
      user_management: false,
      reports: false,
    }));
    expect(useFeatureStore.getState().flags.user_management).toBe(false);
    expect(useFeatureStore.getState().flags.reports).toBe(false);
    expect(useFeatureStore.getState().isSaving).toBe(false);
    expect(mockNotifyDataChanged).toHaveBeenCalledWith('feature_flags');
  });

  it('can restore a mixed flag set through setFeatureFlags', async () => {
    const customFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      gate_pass: false,
      pos_jaga: false,
      reports: false,
    };

    await act(async () => {
      await useFeatureStore.getState().setFeatureFlags(customFlags);
    });

    expect(mockUpdateFeatureFlags).toHaveBeenCalledTimes(1);
    expect(mockUpdateFeatureFlags).toHaveBeenCalledWith('admin-1', 'admin', customFlags);
    expect(useFeatureStore.getState().flags).toMatchObject(customFlags);
  });
});
