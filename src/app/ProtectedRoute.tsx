import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFeatureStore } from '../store/featureStore';
import { isPathEnabled } from '../lib/featureFlags';
import { APP_ROUTE_PATHS, getRoleDefaultPath, getRoleFallbackPaths } from '../lib/rolePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Role } from '../types';

interface ProtectedRouteProps {
  allowedRoles: readonly Role[];
}

function getRoleFallbackPath(role: Role, flags: ReturnType<typeof useFeatureStore.getState>['flags']): string | null {
  const candidates = getRoleFallbackPaths(role);
  return candidates.find((path) => isPathEnabled(path, flags)) ?? null;
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const requiresPinChange = useAuthStore((s) => s.requiresPinChange);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const hasUser = useAuthStore((s) => Boolean(s.user));
  const userRole = useAuthStore((s) => s.user?.role ?? null);
  const userSatuanId = useAuthStore((s) => s.user?.satuan_id ?? null);
  const { pathname } = useLocation();
  const { flags, isLoaded, loadFeatureFlags } = useFeatureStore();

  useEffect(() => {
    if (!hasUser) return;
    if (isLoaded) return;
    void loadFeatureFlags();
  }, [hasUser, isLoaded, loadFeatureFlags]);

  if (!isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated || !userRole) {
    return <Navigate to={APP_ROUTE_PATHS.login} replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={getRoleDefaultPath(userRole) ?? APP_ROUTE_PATHS.login} replace />;
  }

  if (userRole !== 'super_admin' && !userSatuanId) {
    return <Navigate to="/error" state={{ code: '403', message: 'Akun belum terdaftar di satuan manapun.' }} replace />;
  }

  if (requiresPinChange && pathname !== APP_ROUTE_PATHS.forceChangePin) {
    return <Navigate to={APP_ROUTE_PATHS.forceChangePin} replace />;
  }

  if (!isPathEnabled(pathname, flags)) {
    const fallbackPath = getRoleFallbackPath(userRole, flags);
    if (!fallbackPath || fallbackPath === pathname) {
      return (
        <Navigate
          to={APP_ROUTE_PATHS.error}
          replace
          state={{
            code: '403',
            message: 'Modul untuk peran Anda sedang dinonaktifkan oleh admin.',
          }}
        />
      );
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
