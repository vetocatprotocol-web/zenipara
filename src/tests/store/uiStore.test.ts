import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { useUIStore } from '@/store/uiStore';

// Reset the Zustand store between tests by reinitialising state
function resetUIStore() {
  useUIStore.setState({
    isDarkMode: true,
    sidebarOpen: true,
    notificationsEnabled: true,
    displayDensity: 'comfortable',
    dashboardAutoRefreshEnabled: true,
    dashboardAutoRefreshMinutes: 3,
    notification: null,
    notifications: [],
  });
}

describe('uiStore', () => {
  beforeEach(() => {
    resetUIStore();
    localStorage.clear();
  });

  // ── Dark mode ──────────────────────────────────────────────
  describe('toggleDarkMode', () => {
    it('flips isDarkMode from true to false', () => {
      useUIStore.setState({ isDarkMode: true });
      act(() => useUIStore.getState().toggleDarkMode());
      expect(useUIStore.getState().isDarkMode).toBe(false);
    });

    it('flips isDarkMode from false to true', () => {
      useUIStore.setState({ isDarkMode: false });
      act(() => useUIStore.getState().toggleDarkMode());
      expect(useUIStore.getState().isDarkMode).toBe(true);
    });

    it('persists to localStorage', () => {
      useUIStore.setState({ isDarkMode: true });
      act(() => useUIStore.getState().toggleDarkMode());
      expect(localStorage.getItem('karyo_dark_mode')).toBe('false');
    });

    it('applies theme to document', () => {
      useUIStore.setState({ isDarkMode: true });
      act(() => useUIStore.getState().toggleDarkMode());
      expect(document.documentElement.dataset.theme).toBe('light');

      act(() => useUIStore.getState().toggleDarkMode());
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });

  // ── Sidebar ────────────────────────────────────────────────
  describe('toggleSidebar', () => {
    it('flips sidebarOpen', () => {
      useUIStore.setState({ sidebarOpen: true });
      act(() => useUIStore.getState().toggleSidebar());
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      act(() => useUIStore.getState().toggleSidebar());
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('persists to localStorage', () => {
      useUIStore.setState({ sidebarOpen: true });
      act(() => useUIStore.getState().toggleSidebar());
      expect(localStorage.getItem('karyo_sidebar_open')).toBe('false');
    });
  });

  describe('setSidebarOpen', () => {
    it('sets sidebarOpen to given value', () => {
      useUIStore.setState({ sidebarOpen: true });
      act(() => useUIStore.getState().setSidebarOpen(false));
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      act(() => useUIStore.getState().setSidebarOpen(true));
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  // ── Notifications enabled ──────────────────────────────────
  describe('setNotificationsEnabled', () => {
    it('sets notificationsEnabled', () => {
      act(() => useUIStore.getState().setNotificationsEnabled(false));
      expect(useUIStore.getState().notificationsEnabled).toBe(false);

      act(() => useUIStore.getState().setNotificationsEnabled(true));
      expect(useUIStore.getState().notificationsEnabled).toBe(true);
    });

    it('persists to localStorage', () => {
      act(() => useUIStore.getState().setNotificationsEnabled(false));
      expect(localStorage.getItem('karyo_notifications_enabled')).toBe('false');
    });
  });

  // ── Display density ────────────────────────────────────────
  describe('setDisplayDensity', () => {
    it('sets displayDensity to compact', () => {
      act(() => useUIStore.getState().setDisplayDensity('compact'));
      expect(useUIStore.getState().displayDensity).toBe('compact');
    });

    it('sets displayDensity to comfortable', () => {
      useUIStore.setState({ displayDensity: 'compact' });
      act(() => useUIStore.getState().setDisplayDensity('comfortable'));
      expect(useUIStore.getState().displayDensity).toBe('comfortable');
    });

    it('persists to localStorage', () => {
      act(() => useUIStore.getState().setDisplayDensity('compact'));
      expect(localStorage.getItem('karyo_display_density')).toBe('compact');
    });

    it('applies density to document', () => {
      act(() => useUIStore.getState().setDisplayDensity('compact'));
      expect(document.documentElement.dataset.density).toBe('compact');
    });
  });

  describe('toggleDisplayDensity', () => {
    it('toggles between comfortable and compact', () => {
      useUIStore.setState({ displayDensity: 'comfortable' });
      act(() => useUIStore.getState().toggleDisplayDensity());
      expect(useUIStore.getState().displayDensity).toBe('compact');

      act(() => useUIStore.getState().toggleDisplayDensity());
      expect(useUIStore.getState().displayDensity).toBe('comfortable');
    });
  });

  // ── Auto-refresh ───────────────────────────────────────────
  describe('setDashboardAutoRefreshEnabled', () => {
    it('sets dashboardAutoRefreshEnabled', () => {
      act(() => useUIStore.getState().setDashboardAutoRefreshEnabled(false));
      expect(useUIStore.getState().dashboardAutoRefreshEnabled).toBe(false);
    });
  });

  describe('setDashboardAutoRefreshMinutes', () => {
    it('accepts valid minutes', () => {
      act(() => useUIStore.getState().setDashboardAutoRefreshMinutes(10));
      expect(useUIStore.getState().dashboardAutoRefreshMinutes).toBe(10);
    });

    it('clamps below 1 to 1', () => {
      act(() => useUIStore.getState().setDashboardAutoRefreshMinutes(0));
      expect(useUIStore.getState().dashboardAutoRefreshMinutes).toBe(1);
    });

    it('clamps above 60 to 60', () => {
      act(() => useUIStore.getState().setDashboardAutoRefreshMinutes(99));
      expect(useUIStore.getState().dashboardAutoRefreshMinutes).toBe(60);
    });

    it('rounds to nearest integer', () => {
      act(() => useUIStore.getState().setDashboardAutoRefreshMinutes(4.7));
      expect(useUIStore.getState().dashboardAutoRefreshMinutes).toBe(5);
    });
  });

  // ── Notifications (UI toast) ───────────────────────────────
  describe('showNotification / clearNotification', () => {
    it('sets notification', () => {
      act(() => useUIStore.getState().showNotification('Hello', 'success'));
      expect(useUIStore.getState().notification).toEqual({ message: 'Hello', type: 'success' });
    });

    it('adds to notifications queue', () => {
      act(() => useUIStore.getState().showNotification('Hello', 'success'));
      expect(useUIStore.getState().notifications).toHaveLength(1);
      expect(useUIStore.getState().notifications[0]).toMatchObject({ message: 'Hello', type: 'success' });
    });

    it('clearNotification removes notification', () => {
      useUIStore.setState({ notification: { message: 'test', type: 'info' } });
      act(() => useUIStore.getState().clearNotification());
      expect(useUIStore.getState().notification).toBeNull();
    });

    it('clearNotification empties the notifications queue', () => {
      act(() => useUIStore.getState().showNotification('Hello', 'success'));
      act(() => useUIStore.getState().clearNotification());
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });

    it('auto-clears notification after 4 seconds', () => {
      vi.useFakeTimers();
      act(() => useUIStore.getState().showNotification('Auto clear', 'info'));
      expect(useUIStore.getState().notification).not.toBeNull();

      act(() => { vi.advanceTimersByTime(4000); });
      expect(useUIStore.getState().notification).toBeNull();
      vi.useRealTimers();
    });

    it('supports all notification types', () => {
      for (const type of ['success', 'error', 'info', 'warning'] as const) {
        act(() => useUIStore.getState().showNotification('msg', type));
        expect(useUIStore.getState().notification?.type).toBe(type);
      }
    });

    it('dismissNotification removes specific item from queue', () => {
      act(() => useUIStore.getState().showNotification('First', 'info'));
      act(() => useUIStore.getState().showNotification('Second', 'success'));
      expect(useUIStore.getState().notifications).toHaveLength(2);
      const firstId = useUIStore.getState().notifications[0].id;
      act(() => useUIStore.getState().dismissNotification(firstId));
      expect(useUIStore.getState().notifications).toHaveLength(1);
      expect(useUIStore.getState().notifications[0].message).toBe('Second');
    });
  });
});
