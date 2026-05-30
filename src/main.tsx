import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './app/router';
import { useAuthStore } from './store/authStore';
import { usePlatformStore } from './store/platformStore';
import { useFeatureStore } from './store/featureStore';
import { useUIStore } from './store/uiStore';
import { useGlobalRealtimeSync } from './hooks/useGlobalRealtimeSync';
import { useNotifications } from './hooks/useNotifications';
import { subscribeDataChanges } from './lib/dataSync';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import { measurePageLoad } from './lib/metrics';

// Mulai pengukuran load halaman sebelum render pertama
measurePageLoad();

function AuthenticatedRuntimeEffects() {
  useGlobalRealtimeSync();
  useNotifications();
  return null;
}

export function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const updateOnlineStatus = useAuthStore((s) => s.updateOnlineStatus);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const hasUser = useAuthStore((s) => Boolean(s.user));
  const { loadPlatformBranding } = usePlatformStore();
  const { loadFeatureFlags } = useFeatureStore();
  const { loadUserPreferences } = useUIStore();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    void loadPlatformBranding();
  }, [loadPlatformBranding]);

  useEffect(() => {
    if (!hasUser) return;
    void loadUserPreferences();
  }, [hasUser, loadUserPreferences]);

  useEffect(() => {
    if (!hasUser) return;
    void loadFeatureFlags();
  }, [hasUser, loadFeatureFlags]);

  useEffect(() => {
    if (!hasUser) return;

    const syncPresence = (isOnline: boolean) => {
      void updateOnlineStatus(isOnline);
    };

    syncPresence(navigator.onLine);

    const handleOnline = () => syncPresence(true);
    const handleOffline = () => syncPresence(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hasUser, updateOnlineStatus]);

  useEffect(() => {
    return subscribeDataChanges('feature_flags', () => {
      void loadFeatureFlags(true);
    });
  }, [loadFeatureFlags]);

  // Show loading spinner during auth initialization to prevent early navigation
  if (isLoading || !isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <>
      {hasUser && <AuthenticatedRuntimeEffects />}
      <RouterProvider router={router} />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for cache management on GitHub Pages SPA
if ('serviceWorker' in navigator) {
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(registrations.map((registration) => registration.unregister()));
    });
    if ('caches' in window) {
      void caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))));
    }
  } else {
    const basePath = import.meta.env.BASE_URL || '/';
    const swPath = new URL('sw.js', new URL(basePath, window.location.origin)).toString().replace(window.location.origin, '');
    navigator.serviceWorker.register(swPath).then((registration) => {
      if (import.meta.env.DEV) console.log('[SW] Registered:', registration);
    }).catch((error) => {
      if (import.meta.env.DEV) console.warn('[SW] Registration failed:', error);
    });
  }
}
