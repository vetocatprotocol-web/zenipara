import { create } from 'zustand';
import { getPlatformSettings, updatePlatformSettings } from '@/features/shared/lib/api/platform';

const PLATFORM_SETTINGS_CACHE_KEY = 'karyo_platform_settings';
const WEATHER_API_KEY_STORE = 'karyo_weather_api_key';
const WEATHER_CITY_STORE = 'karyo_weather_city';
const DEFAULT_FAVICON_SELECTOR = "link[rel='icon']";

export interface PlatformBranding {
  platformName: string;
  platformTagline: string;
  platformLogoUrl: string | null;
  platformLoginBackgroundUrl: string | null;
}

export interface WeatherSettings {
  weatherApiKey: string;
  weatherCity: string;
}

const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  platformName: 'KARYO OS',
  platformTagline: 'Command and Battalion Tracking',
  platformLogoUrl: null,
  platformLoginBackgroundUrl: null,
};

interface PlatformStore {
  settings: PlatformBranding;
  weatherSettings: WeatherSettings;
  isLoaded: boolean;
  isSaving: boolean;
  loadPlatformBranding: (force?: boolean) => Promise<void>;
  updatePlatformBranding: (settings: PlatformBranding) => Promise<void>;
  updateWeatherSettings: (settings: WeatherSettings) => void;
}

const safeStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

const normalizeBranding = (raw: unknown): PlatformBranding => {
  const data = (raw ?? {}) as Record<string, unknown>;
  const platformName = String(data.platform_name ?? data.platformName ?? '').trim() || DEFAULT_PLATFORM_BRANDING.platformName;
  const platformTagline = String(data.platform_tagline ?? data.platformTagline ?? '').trim() || DEFAULT_PLATFORM_BRANDING.platformTagline;
  const rawLogoUrl = String(data.platform_logo_url ?? data.platformLogoUrl ?? '').trim();
  const rawLoginBackgroundUrl = String(
    data.platform_login_background_url ?? data.platformLoginBackgroundUrl ?? '',
  ).trim();

  return {
    platformName,
    platformTagline,
    platformLogoUrl: rawLogoUrl || null,
    platformLoginBackgroundUrl: rawLoginBackgroundUrl || null,
  };
};

const loadCachedBranding = (): PlatformBranding => {
  const raw = safeStorageGet(PLATFORM_SETTINGS_CACHE_KEY);
  if (!raw) return DEFAULT_PLATFORM_BRANDING;

  try {
    return normalizeBranding(JSON.parse(raw));
  } catch {
    return DEFAULT_PLATFORM_BRANDING;
  }
};

const loadCachedWeatherSettings = (): WeatherSettings => ({
  weatherApiKey: safeStorageGet(WEATHER_API_KEY_STORE) ?? '',
  weatherCity: safeStorageGet(WEATHER_CITY_STORE) ?? '',
});

const getDefaultFaviconHref = (): string | null => {
  if (typeof document === 'undefined') return null;

  const favicon = document.querySelector(DEFAULT_FAVICON_SELECTOR) as HTMLLinkElement | null;
  return favicon?.getAttribute('href') ?? null;
};

const defaultFaviconHref = getDefaultFaviconHref();

const applyDocumentBranding = (settings: PlatformBranding) => {
  if (typeof document === 'undefined') return;

  document.title = `${settings.platformName} | Sistem Operasional`;

  const favicon = document.querySelector(DEFAULT_FAVICON_SELECTOR) as HTMLLinkElement | null;
  if (!favicon) return;

  if (settings.platformLogoUrl) {
    favicon.href = settings.platformLogoUrl;
    return;
  }

  if (defaultFaviconHref) {
    favicon.href = defaultFaviconHref;
  }
};

const persistBranding = (settings: PlatformBranding) => {
  safeStorageSet(PLATFORM_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  applyDocumentBranding(settings);
};

export const usePlatformStore = create<PlatformStore>((set, get) => ({
  settings: loadCachedBranding(),
  weatherSettings: loadCachedWeatherSettings(),
  isLoaded: false,
  isSaving: false,

  loadPlatformBranding: async (force = false) => {
    if (get().isLoaded && !force) return;

    try {
      const data = await getPlatformSettings();
      if (!data) {
        set({ isLoaded: true });
        return;
      }
      const normalized = normalizeBranding(data);
      persistBranding(normalized);
      set({ settings: normalized, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  updatePlatformBranding: async (settings: PlatformBranding) => {
    const normalizedInput = normalizeBranding(settings);
    set({ isSaving: true });

    try {
      const data = await updatePlatformSettings({
        platformName: normalizedInput.platformName,
        platformTagline: normalizedInput.platformTagline,
        platformLogoUrl: normalizedInput.platformLogoUrl,
        platformLoginBackgroundUrl: normalizedInput.platformLoginBackgroundUrl,
      });

      const normalized = normalizeBranding(data ?? normalizedInput);
      persistBranding(normalized);
      set({ settings: normalized, isSaving: false, isLoaded: true });
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  updateWeatherSettings: (weatherSettings: WeatherSettings) => {
    safeStorageSet(WEATHER_API_KEY_STORE, weatherSettings.weatherApiKey);
    safeStorageSet(WEATHER_CITY_STORE, weatherSettings.weatherCity);
    set({ weatherSettings });
  },
}));

applyDocumentBranding(loadCachedBranding());
