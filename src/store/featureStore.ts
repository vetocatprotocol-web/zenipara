import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { notifyDataChanged } from '@/features/shared/lib/dataSync';
import {
  FEATURE_DEFINITIONS,
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagsState,
  type FeatureKey,
} from '@/features/shared/lib/featureFlags';
import {
  getFeatureFlags as apiGetFeatureFlags,
  updateFeatureFlags as apiUpdateFeatureFlags,
  updateFeatureFlag as apiUpdateFeatureFlag,
} from '@/features/shared/lib/api/featureFlags';
import { requestCoalescer } from '@/features/shared/lib/requestCoalescer';

const FEATURE_FLAGS_CACHE_KEY = 'karyo_feature_flags';
const featureFlagsRequestKey = (userId: string, force: boolean) => `feature_flags:${force ? 'force' : 'normal'}:${userId}`;

let featureFlagsLoadVersion = 0;

interface FeatureStore {
  flags: FeatureFlagsState;
  isLoaded: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadedForUserId: string | null;
  loadFeatureFlags: (force?: boolean) => Promise<void>;
  setFeatureEnabled: (featureKey: FeatureKey, isEnabled: boolean) => Promise<void>;
  setFeatureFlags: (nextFlags: FeatureFlagsState) => Promise<void>;
  setAllFeaturesEnabled: (isEnabled: boolean) => Promise<void>;
}

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore local storage failures
  }
};

const loadCachedFlags = (): FeatureFlagsState => {
  const raw = safeGet(FEATURE_FLAGS_CACHE_KEY);
  if (!raw) return { ...DEFAULT_FEATURE_FLAGS };

  try {
    const parsed = JSON.parse(raw) as Partial<FeatureFlagsState>;
    return { ...DEFAULT_FEATURE_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
};

const persistFlags = (flags: FeatureFlagsState) => {
  safeSet(FEATURE_FLAGS_CACHE_KEY, JSON.stringify(flags));
};

export const useFeatureStore = create<FeatureStore>((set, get) => ({
  flags: loadCachedFlags(),
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  loadedForUserId: null,

  loadFeatureFlags: async (force = false) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ flags: { ...DEFAULT_FEATURE_FLAGS }, isLoaded: false, isLoading: false, loadedForUserId: null });
      return;
    }

    if (get().isLoaded && !force && get().loadedForUserId === user.id) return;

    set({ isLoading: true });
    const loadVersion = ++featureFlagsLoadVersion;

    try {
      const flags = await requestCoalescer.coalesce(featureFlagsRequestKey(user.id, force), () => apiGetFeatureFlags(user.id, user.role));
      if (loadVersion !== featureFlagsLoadVersion) return;
      persistFlags(flags);
      set({ flags, isLoaded: true, isLoading: false, loadedForUserId: user.id });
    } catch {
      if (loadVersion !== featureFlagsLoadVersion) return;
      set({ isLoaded: true, isLoading: false, loadedForUserId: user.id });
    }
  },

  setFeatureEnabled: async (featureKey, isEnabled) => {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('Sesi pengguna tidak tersedia');

    const previous = get().flags;
    const next = { ...previous, [featureKey]: isEnabled };

    set({ flags: next, isSaving: true });
    persistFlags(next);

    try {
      await apiUpdateFeatureFlag(user.id, user.role, featureKey, isEnabled);
      set({ isSaving: false, isLoaded: true });
      notifyDataChanged('feature_flags');
    } catch (error) {
      set({ flags: previous, isSaving: false });
      persistFlags(previous);
      throw error;
    }
  },

  setFeatureFlags: async (nextFlags) => {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('Sesi pengguna tidak tersedia');

    const previous = get().flags;
    set({ flags: nextFlags, isSaving: true });
    persistFlags(nextFlags);

    try {
      await apiUpdateFeatureFlags(user.id, user.role, nextFlags);
      set({ isSaving: false, isLoaded: true });
      notifyDataChanged('feature_flags');
    } catch (error) {
      set({ flags: previous, isSaving: false });
      persistFlags(previous);
      throw error;
    }
  },

  setAllFeaturesEnabled: async (isEnabled) => {
    const nextFlags = FEATURE_DEFINITIONS.reduce((accumulator, feature) => {
      accumulator[feature.key] = isEnabled;
      return accumulator;
    }, { ...DEFAULT_FEATURE_FLAGS } as FeatureFlagsState);

    await get().setFeatureFlags(nextFlags);
  },
}));