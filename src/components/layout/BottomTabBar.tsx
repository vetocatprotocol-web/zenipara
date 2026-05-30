import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, Megaphone,
  UserCheck, Users, Settings, ScanLine, ScrollText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeatureStore } from '../../store/featureStore';
import { useUIStore } from '../../store/uiStore';
import { useMessages } from '../../hooks/useMessages';
import { isPathEnabled } from '../../lib/featureFlags';
import { ROLE_ROUTE_PATHS } from '../../lib/rolePermissions';
import type { Role } from '../../types';

interface BottomTabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  hasMessageBadge?: boolean;
}

/** Mobile bottom tab: show max 5 primary nav items per role (spec §10.2) */
const ADMIN_TABS: BottomTabItem[] = [
  { path: ROLE_ROUTE_PATHS.admin.dashboard,     label: 'Beranda',    icon: <LayoutDashboard size={20} aria-hidden="true" /> },
  { path: ROLE_ROUTE_PATHS.admin.users,         label: 'Personel',   icon: <Users size={20} aria-hidden="true" /> },
  { path: ROLE_ROUTE_PATHS.admin.announcements, label: 'Pengumuman', icon: <Megaphone size={20} aria-hidden="true" /> },
  { path: ROLE_ROUTE_PATHS.admin.settings,      label: 'Setelan',    icon: <Settings size={20} aria-hidden="true" /> },
];

const BOTTOM_TABS: Record<Role, BottomTabItem[]> = {
  admin: ADMIN_TABS,
  super_admin: ADMIN_TABS,
  admin_satuan: ADMIN_TABS,
  komandan: [
    { path: ROLE_ROUTE_PATHS.komandan.dashboard,  label: 'Beranda',   icon: <LayoutDashboard size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.komandan.tasks,      label: 'Tugas',     icon: <CheckSquare size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.komandan.personnel,  label: 'Personel',  icon: <Users size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.komandan.attendance, label: 'Hadir',     icon: <CalendarDays size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.komandan.messages,   label: 'Pesan',     icon: <Megaphone size={20} aria-hidden="true" />, hasMessageBadge: true },
  ],
  prajurit: [
    { path: ROLE_ROUTE_PATHS.prajurit.dashboard,  label: 'Beranda',   icon: <LayoutDashboard size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.prajurit.gatePass,   label: 'Gate Pass', icon: <CheckSquare size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.prajurit.scanPos,    label: 'Scan Pos',  icon: <ScanLine size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.prajurit.attendance, label: 'Absensi',   icon: <CalendarDays size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.prajurit.profile,    label: 'Profil',    icon: <UserCheck size={20} aria-hidden="true" /> },
  ],
  guard: [
    { path: ROLE_ROUTE_PATHS.guard.gatePassScan, label: 'Scan',     icon: <CheckSquare size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.guard.discipline,   label: 'Disiplin', icon: <ScrollText  size={20} aria-hidden="true" /> },
  ],
  // Staf Operasional
  staf: [
    { path: ROLE_ROUTE_PATHS.staf.dashboard,      label: 'Beranda',  icon: <LayoutDashboard size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.admin.users,         label: 'Personel', icon: <Users size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.admin.attendance,    label: 'Absensi',  icon: <CalendarDays size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.staf.leaveReview,    label: 'Izin',     icon: <UserCheck size={20} aria-hidden="true" /> },
    { path: ROLE_ROUTE_PATHS.staf.messages,       label: 'Pesan',    icon: <Megaphone size={20} aria-hidden="true" />, hasMessageBadge: true },
  ],
};

// eslint-disable-next-line react-refresh/only-export-components
export const getBottomTabPaths = (role: Role): string[] =>
  (BOTTOM_TABS[role] ?? []).map((tab) => tab.path);

/**
 * Mobile-only bottom tab bar (visible only on < lg screens).
 * Provides quick navigation to up to 5 primary destinations per role.
 * Spec §10.2: "Mobile — Bottom Tab Bar navigation (4-5 item)"
 */
export default function BottomTabBar() {
  const { user } = useAuthStore();
  const { flags } = useFeatureStore();
  const { bottomNavigationEnabled } = useUIStore();
  const { unreadCount } = useMessages({ includeSent: false, enableDirectRealtime: false, subscribeToDataChanges: false });

  if (!user || !bottomNavigationEnabled) return null;

  const tabs = (BOTTOM_TABS[user.role] ?? []).filter((tab) => isPathEnabled(tab.path, flags));

  if (!tabs || tabs.length === 0) return null;

  const gridColsClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };
  const colsClass = gridColsClass[Math.min(tabs.length, 5)] ?? 'grid-cols-5';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-surface/60 bg-bg-card/95 backdrop-blur-2xl lg:hidden"
      aria-label="Bottom navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className={`mx-auto grid max-w-xl ${colsClass} gap-0 px-2 pt-1 pb-1`}>
        {tabs.map((tab) => {
          const showBadge = tab.hasMessageBadge && unreadCount > 0;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `bottom-tab-item ${isActive ? 'bottom-tab-item--active' : ''}`
              }
              aria-label={showBadge ? `${tab.label} — ${unreadCount} belum dibaca` : tab.label}
            >
              {({ isActive }) => (
                <>
                  <span className="relative text-[22px] leading-none">
                    {tab.icon}
                    {showBadge && (
                      <span
                        className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-red px-0.5 text-[9px] font-bold text-white leading-none"
                        aria-hidden="true"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] leading-none mt-0.5 transition-all duration-200 ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
                  {/* Active dot indicator below label */}
                  {isActive && (
                    <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary animate-scale-in" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
