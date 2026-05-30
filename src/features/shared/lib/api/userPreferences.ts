import { supabase } from '../supabase';

export type DisplayDensity = 'comfortable' | 'compact';

export interface UserPreferencesPayload {
  isDarkMode: boolean;
  sidebarOpen: boolean;
  notificationsEnabled: boolean;
  displayDensity: DisplayDensity;
  dashboardAutoRefreshEnabled: boolean;
  dashboardAutoRefreshMinutes: number;
}

interface DbUserPreferences {
  is_dark_mode: boolean;
  sidebar_open: boolean;
  notifications_enabled: boolean;
  display_density: DisplayDensity;
  dashboard_auto_refresh_enabled: boolean;
  dashboard_auto_refresh_minutes: number;
}

export async function getUserPreferences(callerId: string, callerRole: string): Promise<UserPreferencesPayload | null> {
  const { data, error } = await supabase.rpc('get_user_preferences', {
    p_user_id: callerId,
    p_role: callerRole,
  });
  if (error) throw error;
  const row = data as DbUserPreferences | null;
  if (!row) return null;

  return {
    isDarkMode: row.is_dark_mode,
    sidebarOpen: row.sidebar_open,
    notificationsEnabled: row.notifications_enabled,
    displayDensity: row.display_density,
    dashboardAutoRefreshEnabled: row.dashboard_auto_refresh_enabled,
    dashboardAutoRefreshMinutes: row.dashboard_auto_refresh_minutes,
  };
}

export async function updateUserPreferences(
  callerId: string,
  callerRole: string,
  preferences: UserPreferencesPayload,
): Promise<UserPreferencesPayload> {
  const { data, error } = await supabase.rpc('update_user_preferences', {
    p_user_id: callerId,
    p_role: callerRole,
    p_is_dark_mode: preferences.isDarkMode,
    p_sidebar_open: preferences.sidebarOpen,
    p_notifications_enabled: preferences.notificationsEnabled,
    p_display_density: preferences.displayDensity,
    p_dashboard_auto_refresh_enabled: preferences.dashboardAutoRefreshEnabled,
    p_dashboard_auto_refresh_minutes: preferences.dashboardAutoRefreshMinutes,
  });

  if (error) throw error;

  const row = data as DbUserPreferences | null;
  if (!row) return preferences;

  return {
    isDarkMode: row.is_dark_mode,
    sidebarOpen: row.sidebar_open,
    notificationsEnabled: row.notifications_enabled,
    displayDensity: row.display_density,
    dashboardAutoRefreshEnabled: row.dashboard_auto_refresh_enabled,
    dashboardAutoRefreshMinutes: row.dashboard_auto_refresh_minutes,
  };
}
