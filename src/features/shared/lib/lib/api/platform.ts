import { supabase } from '../supabase';
import { CacheWithTTL } from '../cacheWithTTL';
import { requestCoalescer } from '../requestCoalescer';

export interface PlatformSettings {
  platform_name: string;
  platform_tagline: string;
  platform_logo_url: string | null;
  platform_login_background_url: string | null;
}

const PLATFORM_SETTINGS_CACHE_KEY = 'platform_settings';
const platformSettingsCache = new CacheWithTTL<string, PlatformSettings | null>(5 * 60 * 1000);

function normalizePlatformSettings(data: unknown): PlatformSettings | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  return {
    platform_name: String(raw.platform_name ?? raw.platformName ?? '').trim(),
    platform_tagline: String(raw.platform_tagline ?? raw.platformTagline ?? '').trim(),
    platform_logo_url: raw.platform_logo_url == null ? null : String(raw.platform_logo_url),
    platform_login_background_url:
      raw.platform_login_background_url == null ? null : String(raw.platform_login_background_url),
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  return requestCoalescer.coalesce(PLATFORM_SETTINGS_CACHE_KEY, async () => {
    const cached = platformSettingsCache.get(PLATFORM_SETTINGS_CACHE_KEY);
    if (cached !== undefined) return cached;

    const { data, error } = await supabase.rpc('get_platform_settings');
    if (error) throw error;

    const normalized = normalizePlatformSettings(data);
    platformSettingsCache.set(PLATFORM_SETTINGS_CACHE_KEY, normalized);
    return normalized;
  });
}

export async function updatePlatformSettings(settings: {
  platformName: string;
  platformTagline: string;
  platformLogoUrl: string | null;
  platformLoginBackgroundUrl: string | null;
}): Promise<PlatformSettings> {
  const { data, error } = await supabase.rpc('update_platform_settings', {
    p_platform_name: settings.platformName,
    p_platform_logo_url: settings.platformLogoUrl,
    p_platform_login_background_url: settings.platformLoginBackgroundUrl,
    p_platform_tagline: settings.platformTagline,
  });
  if (error) throw error;

  const normalized = normalizePlatformSettings(data);
  platformSettingsCache.delete(PLATFORM_SETTINGS_CACHE_KEY);
  return normalized ?? {
    platform_name: settings.platformName,
    platform_tagline: settings.platformTagline,
    platform_logo_url: settings.platformLogoUrl,
    platform_login_background_url: settings.platformLoginBackgroundUrl,
  };
}
