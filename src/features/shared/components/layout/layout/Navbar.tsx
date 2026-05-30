import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ICONS } from '../../icons';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useUIStore } from '../../store/uiStore';
import { useMessages } from '../../hooks/useMessages';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { isPathEnabled } from '../../lib/featureFlags';
import { getBottomTabPaths } from './BottomTabBar';
import { getSidebarNavPaths } from './Sidebar';
import {
  APP_ROUTE_PATHS,
  getRoleDisplayLabel,
  getRoleMessagesPath,
  getRoleProfilePath,
  isRoleAdmin,
  isRolePrajurit,
  isRoleStaf,
} from '../../lib/rolePermissions';
import GlobalSearch from '../ui/GlobalSearch';
import OfflineIndicator from '../common/OfflineIndicator';
import SyncQueueBadge from '../common/SyncQueueBadge';

interface NavbarProps {
  title: string;
}

export default function Navbar({ title }: NavbarProps) {
  const { user, logout } = useAuthStore();
  const { flags } = useFeatureStore();
  const { toggleSidebar, toggleDarkMode, isDarkMode, bottomNavigationEnabled } = useUIStore();
  const { unreadCount } = useMessages({ includeSent: false, enableDirectRealtime: false });
  const { isOnline, isSyncing, syncStats, requestSync, getLastSyncTimeFormatted } = useOfflineSync();
  const { isInstallAvailable, installApp } = usePWAInstall();
  const navigate = useNavigate();
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAvatarDropdownOpen(false);
      }
    };
    if (isAvatarDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAvatarDropdownOpen]);

  const handleAvatarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsAvatarDropdownOpen(false);
  };

  const handleLogout = async () => {
    setIsAvatarDropdownOpen(false);
    await logout();
    navigate(APP_ROUTE_PATHS.login);
  };

  const messagePath = getRoleMessagesPath(user?.role);
  const canOpenMessages = Boolean(messagePath && isPathEnabled(messagePath, flags));
  const profilePath = getRoleProfilePath(user?.role);
  const showSidebarToggleOnMobile = useMemo(() => {
    if (!user) return false;

    const enabledSidebarPaths = getSidebarNavPaths(user.role).filter((path) => isPathEnabled(path, flags));
    if (!bottomNavigationEnabled) return enabledSidebarPaths.length > 0;

    const bottomPaths = new Set(
      getBottomTabPaths(user.role).filter((path) => isPathEnabled(path, flags)),
    );

    return enabledSidebarPaths.some((path) => !bottomPaths.has(path));
  }, [user, flags, bottomNavigationEnabled]);
  const currentDateLabel = useMemo(
    () => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );
  const handleSyncNow = useCallback(() => {
    void requestSync();
  }, [requestSync]);

  return (
    <header className="nav-header-shell sticky top-0 z-20 px-4 sm:px-5 lg:px-8" data-print-hide>
      <div className="flex h-16 items-center gap-3">
        {showSidebarToggleOnMobile && (
          <button
            onClick={toggleSidebar}
            className="icon-btn lg:hidden h-11 w-11"
            aria-label="Toggle sidebar"
          >
            {ICONS.Menu ? (
              <ICONS.Menu className="h-5 w-5" aria-hidden="true" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        )}

        <div className="min-w-0 flex-1 lg:hidden">
          <h1 className="truncate text-sm font-bold leading-tight text-text-primary sm:text-base">{title}</h1>
          <p className="hidden text-[11px] leading-tight text-text-muted sm:block">{currentDateLabel}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <OfflineIndicator
            isOnline={isOnline}
            isSyncing={isSyncing}
            lastSyncLabel={getLastSyncTimeFormatted()}
          />
          <SyncQueueBadge
            pending={syncStats.pending}
            failed={syncStats.failed}
            isSyncing={isSyncing}
            isOnline={isOnline}
            onSync={handleSyncNow}
          />

          {/* Global search */}
          <GlobalSearch />

          {/* NRP display */}
          <span className="hidden rounded-lg border border-surface/80 bg-slate-50/80 px-2.5 py-1 text-[11px] text-text-muted sm:block dark:bg-surface/35 font-mono">
            {user?.nrp}
          </span>

          {/* Bell — shows unread message count badge */}
          {canOpenMessages && (
            <div className="relative">
              <button
                className="icon-btn"
                aria-label={`Pesan${unreadCount > 0 ? ` — ${unreadCount} belum dibaca` : ''}`}
                title="Pesan & Notifikasi"
                onClick={() => {
                  if (messagePath) navigate(messagePath);
                }}
              >
                {ICONS.Bell ? <ICONS.Bell className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
              {unreadCount > 0 && (
                <span
                  className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-red px-0.5 text-[10px] font-bold text-white animate-scale-in"
                  aria-hidden="true"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="icon-btn hidden sm:flex"
            aria-label={isDarkMode ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
            title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
          >
            {isDarkMode ? (
              ICONS.Sun ? <ICONS.Sun className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">L</span>
            ) : (
              ICONS.Moon ? <ICONS.Moon className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">D</span>
            )}
          </button>

          {/* Avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
              onKeyDown={handleAvatarKeyDown}
              className="flex h-10 items-center gap-2 rounded-xl border border-surface/70 bg-slate-50/80 px-2 py-1 text-left transition-all duration-200 hover:bg-slate-100 hover:border-primary/30 active:scale-[0.97] focus:border-primary focus:bg-blue-50/80 dark:bg-surface/35 dark:hover:bg-surface/60 dark:focus:bg-primary/10"
              aria-label="Profil pengguna"
              aria-expanded={isAvatarDropdownOpen}
              aria-haspopup="menu"
            >
              {user?.foto_url ? (
                <img
                  src={user.foto_url}
                  alt={user.nama}
                  className="h-7 w-7 rounded-lg object-cover ring-1 ring-primary/20"
                />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-blue-600/20 text-xs font-semibold text-primary" aria-hidden="true">
                  {user?.nama?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="max-w-[120px] truncate text-xs font-medium text-text-primary">{user?.nama}</p>
                <p className="text-[10px] text-text-muted">{getRoleDisplayLabel(user?.role ?? 'prajurit')}</p>
              </div>
            </button>

            {/* Dropdown menu */}
            <div
              className={`dropdown-panel right-0 top-[calc(100%+8px)] w-52 ${
                isAvatarDropdownOpen
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-2 opacity-0'
              }`}
              role="menu"
            >
              {/* User info header */}
              <div className="mb-1 border-b border-surface/60 px-2 pb-2.5 pt-1">
                <p className="text-xs font-semibold text-text-primary truncate">{user?.nama}</p>
                <p className="text-[10px] text-text-muted font-mono">{user?.nrp}</p>
              </div>

              {/* Profil link — only for roles that have a profile page */}
              {(isRolePrajurit(user?.role) || isRoleStaf(user?.role)) && user?.role && (
                <Link
                  to={profilePath ?? APP_ROUTE_PATHS.login}
                  role="menuitem"
                  onClick={() => setIsAvatarDropdownOpen(false)}
                  className="dropdown-item"
                >
                  {ICONS.User ? <ICONS.User className="w-4 h-4 text-text-muted" aria-hidden="true" /> : null}
                  {isRoleStaf(user.role) ? 'Dasbor Staf' : 'Profil Saya'}
                </Link>
              )}

              {/* Pengaturan link — admin only */}
              {isRoleAdmin(user?.role) && (
                <Link
                  to="/admin/settings"
                  role="menuitem"
                  onClick={() => setIsAvatarDropdownOpen(false)}
                  className="dropdown-item"
                >
                  {ICONS.Settings ? <ICONS.Settings className="w-4 h-4 text-text-muted" aria-hidden="true" /> : null}
                  Pengaturan
                </Link>
              )}

              {isInstallAvailable && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    void installApp();
                    setIsAvatarDropdownOpen(false);
                  }}
                  className="dropdown-item w-full text-left"
                >
                  {ICONS.Download ? <ICONS.Download className="w-4 h-4 text-text-muted" aria-hidden="true" /> : null}
                  Install Aplikasi
                </button>
              )}

              <div className="my-1 border-t border-surface/60" />

              {/* Keluar */}
              <button
                role="menuitem"
                onClick={handleLogout}
                className="dropdown-item dropdown-item--danger w-full"
              >
                {ICONS.LogOut ? <ICONS.LogOut className="w-4 h-4" aria-hidden="true" /> : null}
                Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
