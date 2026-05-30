import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useUIStore } from '../../../store/uiStore';
import SatuanManagement from '../../../pages/admin/SatuanManagement';

const mockFetchSatuans = vi.fn();
const mockUpdateSatuan = vi.fn();
const mockCreateSatuan = vi.fn();
const mockDeleteSatuan = vi.fn();
const mockShowNotification = vi.fn();

let satuans = [
  {
    id: 'satuan-1',
    nama: 'Batalion Alpha',
    kode_satuan: 'batalion-alpha',
    tingkat: 'battalion' as const,
    logo_url: 'https://example.com/alpha.png',
    is_active: true,
    created_by: 'creator-1',
    created_at: '2026-04-10T00:00:00Z',
    updated_at: '2026-04-10T00:00:00Z',
  },
  {
    id: 'satuan-2',
    nama: 'Kompani Bravo',
    kode_satuan: 'kompani-bravo',
    tingkat: 'company' as const,
    logo_url: null,
    is_active: false,
    created_by: 'creator-2',
    created_at: '2026-04-11T00:00:00Z',
    updated_at: '2026-04-11T00:00:00Z',
  },
];

vi.mock('../../../components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../lib/api/satuans', () => ({
  fetchSatuans: (...args: unknown[]) => mockFetchSatuans(...args),
  createSatuan: (...args: unknown[]) => mockCreateSatuan(...args),
  updateSatuan: (...args: unknown[]) => mockUpdateSatuan(...args),
  deleteSatuan: (...args: unknown[]) => mockDeleteSatuan(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  satuans = [
    {
      id: 'satuan-1',
      nama: 'Batalion Alpha',
      kode_satuan: 'batalion-alpha',
      tingkat: 'battalion',
      logo_url: 'https://example.com/alpha.png',
      is_active: true,
      created_by: 'creator-1',
      created_at: '2026-04-10T00:00:00Z',
      updated_at: '2026-04-10T00:00:00Z',
    },
    {
      id: 'satuan-2',
      nama: 'Kompani Bravo',
      kode_satuan: 'kompani-bravo',
      tingkat: 'company',
      logo_url: null,
      is_active: false,
      created_by: 'creator-2',
      created_at: '2026-04-11T00:00:00Z',
      updated_at: '2026-04-11T00:00:00Z',
    },
  ];

  mockFetchSatuans.mockImplementation(async () => satuans);
  mockUpdateSatuan.mockImplementation(async (id: string, payload: Record<string, unknown>) => {
    satuans = satuans.map((item) => (item.id === id ? { ...item, ...payload } : item));
    return satuans.find((item) => item.id === id) ?? null;
  });
  mockCreateSatuan.mockResolvedValue(null);
  mockDeleteSatuan.mockResolvedValue(null);

  useAuthStore.setState({
    user: {
      id: 'admin-1',
      nrp: '12345',
      nama: 'Admin Test',
      role: 'admin_satuan',
      satuan: 'HQ',
      is_active: true,
      is_online: true,
      login_attempts: 0,
      created_at: '2026-04-10T00:00:00Z',
      updated_at: '2026-04-10T00:00:00Z',
    },
    isAuthenticated: true,
    isLoading: false,
    isInitialized: true,
    error: null,
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
    showNotification: mockShowNotification,
    clearNotification: () => {},
    dismissNotification: () => {},
  });
});

describe('SatuanManagement', () => {
  it('toggles status satuan langsung dari tabel', async () => {
    render(
      <MemoryRouter>
        <SatuanManagement />
      </MemoryRouter>,
    );

    await screen.findByText('Batalion Alpha');

    const activeRow = screen.getByText('Batalion Alpha').closest('tr');
    expect(activeRow).not.toBeNull();

    fireEvent.click(within(activeRow as HTMLTableRowElement).getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(mockUpdateSatuan).toHaveBeenCalledWith('satuan-1', { is_active: false });
    });
    expect(mockShowNotification).toHaveBeenCalledWith('Satuan dinonaktifkan', 'success');
  });

  it('tidak menimpa created_by ketika mengedit satuan', async () => {
    render(
      <MemoryRouter>
        <SatuanManagement />
      </MemoryRouter>,
    );

    await screen.findByText('Batalion Alpha');

    const row = screen.getByText('Batalion Alpha').closest('tr');
    expect(row).not.toBeNull();

    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Satuan' });
    const nameInput = within(dialog).getByDisplayValue('Batalion Alpha');
    fireEvent.change(nameInput, { target: { value: 'Batalion Alpha Baru' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(mockUpdateSatuan).toHaveBeenCalledWith('satuan-1', expect.objectContaining({
        nama: 'Batalion Alpha Baru',
        kode_satuan: 'batalion-alpha',
        tingkat: 'battalion',
        logo_url: 'https://example.com/alpha.png',
        is_active: true,
      }));
    });

    const [, payload] = mockUpdateSatuan.mock.calls[0];
    expect(payload).not.toHaveProperty('created_by');
  });
});