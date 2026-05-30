import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from '@/features/prajurit/pages/prajurit/Profile';
import { useAuthStore } from '@/features/auth/authStore';
import { useUIStore } from '@/store/uiStore';
import { supabase } from '@/features/shared/lib/supabase';

const mockUpdateOwnProfile = vi.fn();
const mockRestoreSession = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/shared/components/layout/DashboardLayout', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/components/common/AvatarUpload', () => ({
  default: () => <div data-testid="avatar-upload" />,
}));

vi.mock('@/features/shared/hooks/useAttendance', () => ({
  useAttendance: () => ({ attendances: [] }),
}));

vi.mock('@/features/shared/hooks/useUsers', () => ({
  useUsers: () => ({ updateOwnProfile: mockUpdateOwnProfile }),
}));

vi.mock('@/features/shared/components/ui/AttendanceHeatmap', () => ({
  default: () => <div data-testid="attendance-heatmap" />,
}));

vi.mock('@/features/shared/components/ui/PageHeader', () => ({
  default: ({ title, subtitle, meta }: { title: string; subtitle: string; meta?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{meta}</div>
    </header>
  ),
}));

vi.mock('@/features/shared/lib/dataSync', () => ({
  notifyDataChanged: vi.fn(),
}));

vi.mock('@/features/shared/lib/handleError', () => ({
  handleError: (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback),
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

describe('Prajurit Profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nrp: '12345',
        nama: 'Prajurit Test',
        role: 'prajurit',
        satuan: 'Satuan Alpha',
        is_active: true,
        is_online: true,
        login_attempts: 0,
        created_at: '2026-04-18T00:00:00Z',
        updated_at: '2026-04-18T00:00:00Z',
        tempat_lahir: 'Bandung',
        tanggal_lahir: '1992-08-17',
        no_telepon: '081234567890',
        alamat: 'Jl. Merdeka 1',
        pendidikan_terakhir: 'S1',
        agama: 'Islam',
        status_pernikahan: 'menikah',
        golongan_darah: 'O',
        kontak_darurat_nama: 'Ibu Test',
        kontak_darurat_telp: '089876543210',
      },
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      error: null,
      restoreSession: mockRestoreSession,
    });
    useUIStore.setState({
      isDarkMode: true,
      sidebarOpen: true,
      notificationsEnabled: true,
      displayDensity: 'comfortable',
      dashboardAutoRefreshEnabled: false,
      dashboardAutoRefreshMinutes: 5,
      notification: null,
      notifications: [],
      toggleDarkMode: () => {},
      toggleSidebar: () => {},
      setSidebarOpen: () => {},
      setNotificationsEnabled: () => {},
      setDisplayDensity: () => {},
      toggleDisplayDensity: () => {},
      setDashboardAutoRefreshEnabled: () => {},
      setDashboardAutoRefreshMinutes: () => {},
      showNotification: vi.fn(),
      clearNotification: () => {},
      dismissNotification: () => {},
    });

    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'tasks') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      }
      if (table === 'attendance') {
        return {
          select: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }) }),
        };
      }
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      };
    });
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  });

  it('renders personal data and allows saving updated self profile fields', async () => {
    render(<Profile />);

    expect(await screen.findByRole('heading', { name: /Profil Saya/i })).toBeInTheDocument();
    expect(screen.getAllByText('Bandung').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendidikan Terakhir').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Golongan Darah').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    fireEvent.change(screen.getByLabelText('Tempat Lahir'), { target: { value: 'Jakarta' } });
    fireEvent.change(screen.getByLabelText('No. Telepon'), { target: { value: '081111111111' } });
    fireEvent.change(screen.getByLabelText('Kontak Darurat — Nama'), { target: { value: 'Ayah Test' } });
    fireEvent.change(screen.getByLabelText('Status Pernikahan'), { target: { value: 'cerai' } });

    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));

    await waitFor(() => expect(mockUpdateOwnProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
      tempat_lahir: 'Jakarta',
      no_telepon: '081111111111',
      kontak_darurat_nama: 'Ayah Test',
      status_pernikahan: 'cerai',
    })));
    expect(mockRestoreSession).toHaveBeenCalled();
  });
});
