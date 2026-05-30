import { useEffect, useMemo, useRef, useState } from 'react';
import useSatuanBranding from '../../hooks/useSatuanBranding';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ICONS, IconType } from '../../icons';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { useFeatureStore } from '../../store/featureStore';
import { isPathEnabled } from '../../lib/featureFlags';
import { APP_ROUTE_PATHS, getRoleDisplayLabel, ROLE_ROUTE_PATHS } from '../../lib/rolePermissions';
import { getBottomTabPaths } from './BottomTabBar';
import type { Role } from '../../types';

interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof ICONS;
}

type NavSection = 'Utama' | 'Operasional' | 'Administrasi' | 'Komunikasi' | 'Pribadi' | 'Sistem';
const SECTION_ORDER: NavSection[] = ['Utama', 'Operasional', 'Administrasi', 'Komunikasi', 'Pribadi', 'Sistem'];

const resolveNavSection = (item: NavItem): NavSection => {
  const { path } = item;
  if (path.includes('/dashboard')) return 'Utama';
  if (path.includes('/messages') || path.includes('/announcements')) return 'Komunikasi';
  if (path.includes('/profile') || path.includes('/leave')) return 'Pribadi';
  if (path.includes('/settings')) return 'Sistem';
  if (path.includes('/audit') || path.includes('/users') || path.includes('/satuan') || path.includes('/documents')) return 'Administrasi';
  return 'Operasional';
};

const ADMIN_NAV: NavItem[] = [
  { path: ROLE_ROUTE_PATHS.admin.dashboard,       label: 'Pusat Kendali',  icon: 'LayoutDashboard' },
  { path: ROLE_ROUTE_PATHS.admin.satuan,          label: 'Satuan',         icon: 'Building2' },
  { path: ROLE_ROUTE_PATHS.admin.users,           label: 'Personel',       icon: 'Users' },
  { path: ROLE_ROUTE_PATHS.admin.analytics,       label: 'Analitik',       icon: 'TrendingUp' },
  { path: ROLE_ROUTE_PATHS.admin.logistics,       label: 'Logistik',       icon: 'Package' },
  { path: ROLE_ROUTE_PATHS.admin.documents,       label: 'Dokumen',        icon: 'FileText' },
  { path: ROLE_ROUTE_PATHS.admin.announcements,   label: 'Pengumuman',     icon: 'Megaphone' },
  { path: ROLE_ROUTE_PATHS.admin.schedule,        label: 'Jadwal Shift',   icon: 'CalendarDays' },
  { path: ROLE_ROUTE_PATHS.admin.attendance,      label: 'Rekap Absensi',  icon: 'ClipboardCheck' },
  { path: ROLE_ROUTE_PATHS.admin.apel,            label: 'Apel Digital',   icon: 'Bell' },
  { path: ROLE_ROUTE_PATHS.admin.kegiatan,        label: 'Kalender Kegiatan', icon: 'CalendarDays' },
  { path: ROLE_ROUTE_PATHS.admin.gatePassMonitor, label: 'Gate Pass',      icon: 'ClipboardCheck' },
  { path: ROLE_ROUTE_PATHS.admin.posJaga,         label: 'Pos Jaga',       icon: 'MapPin' },
  { path: ROLE_ROUTE_PATHS.admin.audit,           label: 'Audit Log',      icon: 'ScrollText' },
  { path: ROLE_ROUTE_PATHS.admin.settings,        label: 'Pengaturan',     icon: 'Settings' },
];

const NAV_ITEMS: Record<Role, NavItem[]> = {
  admin: ADMIN_NAV,
  super_admin: ADMIN_NAV,
  admin_satuan: ADMIN_NAV,
  komandan: [
    { path: ROLE_ROUTE_PATHS.komandan.dashboard,       label: 'Pusat Operasi',       icon: 'LayoutDashboard' },
    { path: ROLE_ROUTE_PATHS.komandan.tasks,           label: 'Tugas',                icon: 'CheckSquare' },
    { path: ROLE_ROUTE_PATHS.komandan.personnel,       label: 'Personel',             icon: 'Users' },
    { path: ROLE_ROUTE_PATHS.komandan.attendance,      label: 'Kehadiran',            icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.komandan.apel,            label: 'Monitoring Apel',      icon: 'Bell' },
    { path: ROLE_ROUTE_PATHS.komandan.kegiatan,        label: 'Kalender Kegiatan',    icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.komandan.laporanOps,      label: 'Laporan Ops',          icon: 'FileText' },
    { path: ROLE_ROUTE_PATHS.komandan.sprint,          label: 'Surat Perintah',       icon: 'ScrollText' },
    { path: ROLE_ROUTE_PATHS.komandan.gatePassApproval,label: 'Approval Gate Pass',   icon: 'ClipboardCheck' },
    { path: ROLE_ROUTE_PATHS.komandan.gatePassMonitor, label: 'Monitoring Gate Pass', icon: 'BarChart2' },
    { path: ROLE_ROUTE_PATHS.komandan.evaluation,      label: 'Evaluasi',             icon: 'NotebookPen' },
    { path: ROLE_ROUTE_PATHS.komandan.reports,         label: 'Laporan',              icon: 'BarChart2' },
    { path: ROLE_ROUTE_PATHS.komandan.logisticsRequest,label: 'Permintaan Logistik',  icon: 'ClipboardList' },
    { path: ROLE_ROUTE_PATHS.komandan.messages,        label: 'Pesan',                icon: 'Megaphone' },
  ],
  prajurit: [
    { path: ROLE_ROUTE_PATHS.prajurit.dashboard,  label: 'Beranda',           icon: 'LayoutDashboard' },
    { path: ROLE_ROUTE_PATHS.prajurit.gatePass,   label: 'Gate Pass',         icon: 'ClipboardCheck' },
    { path: ROLE_ROUTE_PATHS.prajurit.scanPos,    label: 'Scan Pos Jaga',     icon: 'ScanLine' },
    { path: ROLE_ROUTE_PATHS.prajurit.tasks,      label: 'Tugas Saya',        icon: 'CheckSquare' },
    { path: ROLE_ROUTE_PATHS.prajurit.attendance, label: 'Absensi',           icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.prajurit.apel,       label: 'Apel Digital',      icon: 'Bell' },
    { path: ROLE_ROUTE_PATHS.prajurit.kegiatan,   label: 'Kalender Kegiatan', icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.prajurit.messages,   label: 'Pesan',             icon: 'Megaphone' },
    { path: ROLE_ROUTE_PATHS.prajurit.leave,      label: 'Permohonan Izin',   icon: 'UserCheck' },
    { path: ROLE_ROUTE_PATHS.prajurit.profile,    label: 'Profil',            icon: 'Users' },
  ],
  guard: [
    { path: ROLE_ROUTE_PATHS.guard.gatePassScan, label: 'Scan Gate Pass',   icon: 'ClipboardCheck' },
    { path: ROLE_ROUTE_PATHS.guard.discipline,   label: 'Catatan Disiplin', icon: 'ScrollText' },
  ],
  staf: [
    { path: ROLE_ROUTE_PATHS.staf.dashboard,      label: 'Pusat Staf',      icon: 'LayoutDashboard' },
    { path: ROLE_ROUTE_PATHS.admin.users,         label: 'Personel',        icon: 'Users' },
    { path: ROLE_ROUTE_PATHS.admin.attendance,    label: 'Rekap Absensi',   icon: 'ClipboardCheck' },
    { path: ROLE_ROUTE_PATHS.admin.apel,          label: 'Apel Digital',    icon: 'Bell' },
    { path: ROLE_ROUTE_PATHS.admin.kegiatan,      label: 'Kalender Kegiatan', icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.staf.leaveReview,    label: 'Izin Personel',   icon: 'UserCheck' },
    { path: ROLE_ROUTE_PATHS.staf.laporanOps,     label: 'Laporan Ops',     icon: 'FileText' },
    { path: ROLE_ROUTE_PATHS.staf.sprint,         label: 'Surat Perintah',  icon: 'ScrollText' },
    { path: ROLE_ROUTE_PATHS.admin.schedule,      label: 'Jadwal Shift',    icon: 'CalendarDays' },
    { path: ROLE_ROUTE_PATHS.admin.logistics,     label: 'Logistik',        icon: 'Package' },
    { path: ROLE_ROUTE_PATHS.komandan.tasks,      label: 'Tugas',           icon: 'CheckSquare' },
    { path: ROLE_ROUTE_PATHS.admin.posJaga,       label: 'Pos Jaga',        icon: 'MapPin' },
    { path: ROLE_ROUTE_PATHS.staf.messages,       label: 'Pesan',           icon: 'Megaphone' },
  ],
};

// eslint-disable-next-line react-refresh/only-export-components
export const getSidebarNavPaths = (role: Role): string[] =>
  (NAV_ITEMS[role] ?? []).map((item) => item.path);

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, bottomNavigationEnabled } = useUIStore();
  const { settings } = usePlatformStore();
  const { branding: satuanBranding } = useSatuanBranding();
  const { flags } = useFeatureStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false),
  );

  // Swipe-to-close: track touch start X position
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    // Swipe left ≥ 60px → close sidebar
    if (dx < -60) setSidebarOpen(false);
    touchStartX.current = null;
  };

  useEffect(() => {
    if (!sidebarOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const navItems = useMemo(() => {
    if (!user) return [] as NavItem[];

    const roleNavItems = (NAV_ITEMS[user.role] ?? []).filter((item) => isPathEnabled(item.path, flags));

    if (!isMobileViewport || !bottomNavigationEnabled) return roleNavItems;

    const bottomTabPaths = new Set(getBottomTabPaths(user.role));
    return roleNavItems.filter((item) => !bottomTabPaths.has(item.path));
  }, [user, flags, isMobileViewport, bottomNavigationEnabled]);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (!sidebarOpen) return;
    if (navItems.length > 0) return;
    setSidebarOpen(false);
  }, [isMobileViewport, sidebarOpen, navItems.length, setSidebarOpen]);

  const filteredNavItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return navItems;
    return navItems.filter((item) =>
      `${item.label} ${item.path}`.toLowerCase().includes(normalizedQuery),
    );
  }, [navItems, query]);

  const groupedNavItems = useMemo(() => {
    const grouped = new Map<NavSection, NavItem[]>();
    filteredNavItems.forEach((item) => {
      const section = resolveNavSection(item);
      grouped.set(section, [...(grouped.get(section) ?? []), item]);
    });
    return SECTION_ORDER
      .map((section) => [section, grouped.get(section) ?? []] as const)
      .filter(([, items]) => items.length > 0);
  }, [filteredNavItems]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate(APP_ROUTE_PATHS.login);
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-[3px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          app-panel fixed left-0 top-0 z-30 h-full w-[min(86vw,280px)] border-r border-surface/60 sm:w-[260px]
          flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Logo */}
        <div className="border-b border-surface/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
              {satuanBranding?.logo_url ? (
                <img
                  src={satuanBranding.logo_url}
                  alt={satuanBranding.nama_pendek ?? settings.platformName}
                  className="h-10 w-10 rounded-2xl border border-primary/20 bg-primary/10 object-cover shadow-sm"
                />
              ) : settings.platformLogoUrl ? (
                <img
                  src={settings.platformLogoUrl}
                  alt={settings.platformName}
                  className="h-10 w-10 rounded-2xl border border-primary/20 bg-primary/10 object-cover shadow-sm"
                />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-blue-700 text-lg text-white shadow-md shadow-primary/30">◈</span>
              )}
              <div>
                <div className="text-sm font-extrabold tracking-tight text-text-primary leading-tight">{satuanBranding?.nama_pendek ?? settings.platformName}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{settings.platformTagline}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-xl text-text-muted transition-colors hover:bg-slate-100 dark:hover:bg-surface/50 lg:hidden"
              aria-label="Tutup navigasi"
            >
              {ICONS.X ? <ICONS.X className="h-5 w-5" aria-hidden="true" /> : '✕'}
            </button>
          </div>
        </div>

        <div className="border-b border-surface/60 px-4 py-3">
          <label htmlFor="sidebar-nav-search" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Cari menu
          </label>
          <input
            id="sidebar-nav-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="form-control h-10 min-h-[40px] bg-slate-50/85 text-sm dark:bg-surface/35"
            placeholder="Contoh: personel, gate pass..."
            autoComplete="off"
          />
        </div>

        {/* User info */}
        <div className="border-b border-surface/60 px-4 py-3">
          <div className="flex items-center gap-3 rounded-xl border border-surface/50 bg-slate-50/80 p-2.5 dark:bg-surface/30">
            {user.foto_url ? (
              <img
                src={user.foto_url}
                alt={user.nama}
                className="h-9 w-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-primary/20"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-600/20 font-bold text-primary flex-shrink-0 text-sm">
                {user.nama.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-text-primary">{user.nama}</div>
              <div className="truncate text-[10px] text-text-muted">
                {user.pangkat ?? getRoleDisplayLabel(user.role)} — {user.satuan}
              </div>
            </div>
            <div className="h-2 w-2 status-dot status-dot--online status-dot--pulse flex-shrink-0" title="Online" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {groupedNavItems.map(([section, items]) => (
            <div key={section} className="space-y-1">
              <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted/80">
                {section}
              </p>
              {items.map((item) => {
                const Icon = ICONS[item.icon] as IconType;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                    }
                    onClick={() => {
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                  >
                    <span className="sidebar-link__icon text-center">
                      {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
          {filteredNavItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-surface/80 px-3 py-4 text-center text-xs text-text-muted">
              Menu tidak ditemukan, ubah kata kunci pencarian.
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="border-t border-surface/60 px-3 py-3 space-y-1">
          <button
            onClick={handleLogout}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-accent-red transition-all duration-200 hover:bg-accent-red/8 active:scale-[0.97]"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent-red/10 text-center text-sm">
              {ICONS.LogOut ? <ICONS.LogOut className="w-4 h-4" aria-hidden="true" /> : null}
            </span>
            Keluar
          </button>
          <p className="px-3 text-[10px] text-text-muted/50 select-none">
            v{import.meta.env.VITE_APP_VERSION ?? '1.2.1'}
          </p>
        </div>
      </aside>
    </>
  );
}
