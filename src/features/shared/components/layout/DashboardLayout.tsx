import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomTabBar from './BottomTabBar';
import Notification from '../common/Notification';
import { ToastContainer } from '../common/Toast';
import { useUIStore } from '../../store/uiStore';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { displayDensity, setSidebarOpen, bottomNavigationEnabled } = useUIStore();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    if (mediaQuery.matches) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  // Scroll to top on route change
  useEffect(() => {
    if (typeof mainRef.current?.scrollTo === 'function') {
      mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location.pathname]);

  const mobileBottomPadding = bottomNavigationEnabled ? 'pb-40' : 'pb-16';
  const mainPadding = displayDensity === 'compact'
    ? `px-4 py-3 ${mobileBottomPadding} sm:px-5 sm:py-4 lg:px-7 lg:py-6 lg:pb-12`
    : `px-5 py-5 ${mobileBottomPadding} sm:px-6 lg:px-10 lg:py-8 lg:pb-12`;

  const shellWidth = displayDensity === 'compact' ? 'max-w-[1560px]' : 'max-w-[1480px]';

  return (
    <div className="desktop-shell flex h-[100dvh] overflow-hidden bg-military-dark" data-density={displayDensity}>
      <Sidebar />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Navbar title={title} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, var(--color-primary) 40%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 40%, transparent) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-75"
          style={{
            background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 55%), linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent)',
          }}
        />
        {/* pb-28 on mobile to avoid content being hidden behind BottomTabBar + safe area */}
        <main ref={mainRef} className={`relative min-h-0 flex-1 overflow-y-auto scroll-y ${mainPadding}`}>
          <div className={`mx-auto w-full ${shellWidth} animate-fade-up`}>
            {children}
          </div>
        </main>
      </div>
      <BottomTabBar />
      <Notification />
      <ToastContainer />
    </div>
  );
}
