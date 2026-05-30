import { create } from 'zustand';
import { useAuthStore } from './authStore';
import {
  getUserPreferences,
  updateUserPreferences,
  type DisplayDensity,
  type UserPreferencesPayload,
} from '@/features/shared/lib/api/userPreferences';

type NotificationType = 'success' | 'error' | 'info' | 'warning';
const NOTIFICATION_DURATION_MS = 4000;
const DARK_MODE_KEY = 'karyo_dark_mode';
const SIDEBAR_OPEN_KEY = 'karyo_sidebar_open';
const NOTIFICATIONS_ENABLED_KEY = 'karyo_notifications_enabled';
const DISPLAY_DENSITY_KEY = 'karyo_display_density';
const BOTTOM_NAVIGATION_ENABLED_KEY = 'karyo_bottom_navigation_enabled';
const DASHBOARD_AUTO_REFRESH_ENABLED_KEY = 'karyo_dashboard_auto_refresh_enabled';
const DASHBOARD_AUTO_REFRESH_MINUTES_KEY = 'karyo_dashboard_auto_refresh_minutes';

const normalizeNotificationMessage = (message: string): string => {
  return message
    .replace(/menabah/gi, 'menambah')
    .replace(/menambh/gi, 'menambah');
};

interface Notification {
  message: string;
  type: NotificationType;
}

/** Notification item with unique ID for queue-based display */
export interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
}

interface UIStore {
  isDarkMode: boolean;
  sidebarOpen: boolean;
  notificationsEnabled: boolean;
  displayDensity: DisplayDensity;
  bottomNavigationEnabled: boolean;
  dashboardAutoRefreshEnabled: boolean;
  dashboardAutoRefreshMinutes: number;
  /** Legacy single-slot notification (kept for backward compatibility) */
  notification: Notification | null;
  /** Queue of active notifications for stacked display */
  notifications: NotificationItem[];
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDisplayDensity: (density: DisplayDensity) => void;
  toggleDisplayDensity: () => void;
  setBottomNavigationEnabled: (enabled: boolean) => void;
  toggleBottomNavigation: () => void;
  setDashboardAutoRefreshEnabled: (enabled: boolean) => void;
  setDashboardAutoRefreshMinutes: (minutes: number) => void;
  loadUserPreferences: () => Promise<void>;
  showNotification: (message: string, type: NotificationType) => void;
  /** Remove a specific notification from the queue by ID */
  dismissNotification: (id: string) => void;
  /** Clear all notifications (legacy API kept for backward compat) */
  clearNotification: () => void;
}

const loadBoolean = (key: string, fallback: boolean): boolean => {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch {
    return fallback;
  }
};

const loadNumber = (key: string, fallback: number): number => {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = Number(stored);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const loadDarkMode = (): boolean => loadBoolean(DARK_MODE_KEY, true);
const loadSidebarOpen = (): boolean => loadBoolean(SIDEBAR_OPEN_KEY, true);
const loadNotificationsEnabled = (): boolean => loadBoolean(NOTIFICATIONS_ENABLED_KEY, true);
const loadDisplayDensity = (): DisplayDensity => {
  try {
    const stored = localStorage.getItem(DISPLAY_DENSITY_KEY);
    return stored === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
};
const loadBottomNavigationEnabled = (): boolean => loadBoolean(BOTTOM_NAVIGATION_ENABLED_KEY, true);
const loadDashboardAutoRefreshEnabled = (): boolean => loadBoolean(DASHBOARD_AUTO_REFRESH_ENABLED_KEY, true);
const loadDashboardAutoRefreshMinutes = (): number => loadNumber(DASHBOARD_AUTO_REFRESH_MINUTES_KEY, 3);

const savePreference = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

const getCurrentPreferences = (state: Pick<
  UIStore,
  | 'isDarkMode'
  | 'sidebarOpen'
  | 'notificationsEnabled'
  | 'displayDensity'
  | 'dashboardAutoRefreshEnabled'
  | 'dashboardAutoRefreshMinutes'
>): UserPreferencesPayload => ({
  isDarkMode: state.isDarkMode,
  sidebarOpen: state.sidebarOpen,
  notificationsEnabled: state.notificationsEnabled,
  displayDensity: state.displayDensity,
  dashboardAutoRefreshEnabled: state.dashboardAutoRefreshEnabled,
  dashboardAutoRefreshMinutes: state.dashboardAutoRefreshMinutes,
});

const applyPreferenceSnapshot = (prefs: UserPreferencesPayload) => {
  savePreference(DARK_MODE_KEY, String(prefs.isDarkMode));
  savePreference(SIDEBAR_OPEN_KEY, String(prefs.sidebarOpen));
  savePreference(NOTIFICATIONS_ENABLED_KEY, String(prefs.notificationsEnabled));
  savePreference(DISPLAY_DENSITY_KEY, prefs.displayDensity);
  savePreference(DASHBOARD_AUTO_REFRESH_ENABLED_KEY, String(prefs.dashboardAutoRefreshEnabled));
  savePreference(DASHBOARD_AUTO_REFRESH_MINUTES_KEY, String(prefs.dashboardAutoRefreshMinutes));
  applyTheme(prefs.isDarkMode);
  applyDensity(prefs.displayDensity);
};

const syncUserPreferencesToServer = async (prefs: UserPreferencesPayload): Promise<void> => {
  const { user } = useAuthStore.getState();
  if (!user) return;

  try {
    await updateUserPreferences(user.id, user.role, prefs);
  } catch {
    // Silent fallback: local preference remains available on this device.
  }
};

const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
};

const applyDensity = (density: DisplayDensity) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.density = density;
};

export const useUIStore = create<UIStore>((set, get) => ({
  isDarkMode: loadDarkMode(),
  sidebarOpen: loadSidebarOpen(),
  notificationsEnabled: loadNotificationsEnabled(),
  displayDensity: loadDisplayDensity(),
  bottomNavigationEnabled: loadBottomNavigationEnabled(),
  dashboardAutoRefreshEnabled: loadDashboardAutoRefreshEnabled(),
  dashboardAutoRefreshMinutes: loadDashboardAutoRefreshMinutes(),
  notification: null,
  notifications: [],

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      savePreference(DARK_MODE_KEY, String(next));
      applyTheme(next);
      void syncUserPreferencesToServer(
        getCurrentPreferences({
          ...state,
          isDarkMode: next,
        }),
      );
      return { isDarkMode: next };
    }),

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarOpen;
      savePreference(SIDEBAR_OPEN_KEY, String(next));
      void syncUserPreferencesToServer(
        getCurrentPreferences({
          ...state,
          sidebarOpen: next,
        }),
      );
      return { sidebarOpen: next };
    }),

  setSidebarOpen: (open: boolean) => {
    savePreference(SIDEBAR_OPEN_KEY, String(open));
    void syncUserPreferencesToServer(
      getCurrentPreferences({
        ...get(),
        sidebarOpen: open,
      }),
    );
    set({ sidebarOpen: open });
  },

  setNotificationsEnabled: (enabled: boolean) => {
    savePreference(NOTIFICATIONS_ENABLED_KEY, String(enabled));
    void syncUserPreferencesToServer(
      getCurrentPreferences({
        ...get(),
        notificationsEnabled: enabled,
      }),
    );
    set({ notificationsEnabled: enabled });
  },

  setDisplayDensity: (density: DisplayDensity) => {
    savePreference(DISPLAY_DENSITY_KEY, density);
    applyDensity(density);
    void syncUserPreferencesToServer(
      getCurrentPreferences({
        ...get(),
        displayDensity: density,
      }),
    );
    set({ displayDensity: density });
  },

  setBottomNavigationEnabled: (enabled: boolean) => {
    savePreference(BOTTOM_NAVIGATION_ENABLED_KEY, String(enabled));
    set({ bottomNavigationEnabled: enabled });
  },

  toggleBottomNavigation: () =>
    set((state) => {
      const next = !state.bottomNavigationEnabled;
      savePreference(BOTTOM_NAVIGATION_ENABLED_KEY, String(next));
      return { bottomNavigationEnabled: next };
    }),

  toggleDisplayDensity: () =>
    set((state) => {
      const next = state.displayDensity === 'compact' ? 'comfortable' : 'compact';
      savePreference(DISPLAY_DENSITY_KEY, next);
      applyDensity(next);
      void syncUserPreferencesToServer(
        getCurrentPreferences({
          ...state,
          displayDensity: next,
        }),
      );
      return { displayDensity: next };
    }),

  setDashboardAutoRefreshEnabled: (enabled: boolean) => {
    savePreference(DASHBOARD_AUTO_REFRESH_ENABLED_KEY, String(enabled));
    void syncUserPreferencesToServer(
      getCurrentPreferences({
        ...get(),
        dashboardAutoRefreshEnabled: enabled,
      }),
    );
    set({ dashboardAutoRefreshEnabled: enabled });
  },

  setDashboardAutoRefreshMinutes: (minutes: number) => {
    const next = Math.max(1, Math.min(60, Math.round(minutes)));
    savePreference(DASHBOARD_AUTO_REFRESH_MINUTES_KEY, String(next));
    void syncUserPreferencesToServer(
      getCurrentPreferences({
        ...get(),
        dashboardAutoRefreshMinutes: next,
      }),
    );
    set({ dashboardAutoRefreshMinutes: next });
  },

  loadUserPreferences: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const prefs = await getUserPreferences(user.id, user.role);
      if (!prefs) return;

      applyPreferenceSnapshot(prefs);
      set({
        isDarkMode: prefs.isDarkMode,
        sidebarOpen: prefs.sidebarOpen,
        notificationsEnabled: prefs.notificationsEnabled,
        displayDensity: prefs.displayDensity,
        dashboardAutoRefreshEnabled: prefs.dashboardAutoRefreshEnabled,
        dashboardAutoRefreshMinutes: prefs.dashboardAutoRefreshMinutes,
      });
    } catch {
      // Keep local fallback preferences when remote fetch fails.
    }
  },

  showNotification: (message: string, type: NotificationType) => {
    const normalized = normalizeNotificationMessage(message);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: NotificationItem = { id, message: normalized, type };
    // Update both legacy slot (compat) and the queue (max 4 visible)
    set((state) => ({
      notification: { message: normalized, type },
      notifications: [...state.notifications, item].slice(-4),
    }));
    setTimeout(() => {
      set((state) => {
        const next = state.notifications.filter((n) => n.id !== id);
        return {
          notifications: next,
          notification: next.length > 0 ? { message: next[next.length - 1].message, type: next[next.length - 1].type } : null,
        };
      });
    }, NOTIFICATION_DURATION_MS);
  },

  dismissNotification: (id: string) => {
    set((state) => {
      const next = state.notifications.filter((n) => n.id !== id);
      return {
        notifications: next,
        notification: next.length > 0 ? { message: next[next.length - 1].message, type: next[next.length - 1].type } : null,
      };
    });
  },

  clearNotification: () => set({ notification: null, notifications: [] }),
}));

// Apply theme on module load (before first render)
applyTheme(loadDarkMode());
applyDensity(loadDisplayDensity());
