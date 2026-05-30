import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StafLeaveReview from '@/features/shared/pages/staf/LeaveReview';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReviewLeaveRequest = vi.fn().mockResolvedValue(undefined);
const mockShowNotification = vi.fn();

vi.mock('@/features/shared/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('@/features/shared/components/ui/PageHeader', () => ({
  default: ({ title, meta }: { title: string; meta?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <div data-testid="meta">{meta}</div>
    </header>
  ),
}));

vi.mock('@/features/shared/components/ui/Table', () => ({
  default: <T,>({ data, columns }: { data: T[]; columns: { key: string; header: string; render?: (row: T) => React.ReactNode }[] }) => (
    <table>
      <thead>
        <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {(data as Record<string, unknown>[]).map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key}>{c.render ? (c.render as (r: T) => React.ReactNode)(row as T) : String(row[c.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('@/features/shared/components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/features/shared/components/common/EmptyState', () => ({
  default: ({ title }: { title: string }) => <div data-testid="empty">{title}</div>,
}));

vi.mock('@/features/shared/components/common/Badge', () => ({
  LeaveStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('@/features/shared/components/common/Modal', () => ({
  default: ({ isOpen, children, title, footer }: { isOpen: boolean; children: React.ReactNode; title: string; footer: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('@/features/shared/components/common/Input', () => ({
  default: ({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) => (
    <div>
      {label && <label>{label}</label>}
      <input aria-label={label ?? placeholder ?? ''} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  ),
}));

vi.mock('@/features/shared/components/common/Button', () => ({
  default: ({ children, onClick, disabled, isLoading }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; isLoading?: boolean }) => (
    <button onClick={onClick} disabled={disabled ?? isLoading}>{isLoading ? 'Loading...' : children}</button>
  ),
}));

vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'staf-s1',
      role: 'staf',
      jabatan: 'S-1 Personalia',
      satuan: 'BATALION 1',
    },
  }),
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: () => ({ showNotification: mockShowNotification }),
}));

vi.mock('@/features/shared/lib/rolePermissions', () => ({
  canWrite: (_user: unknown, module: string) => module === 'leave',
  getOperationalRoleLabel: () => 'Staf S-1',
}));

const mockRequests = [
  {
    id: 'req-1',
    user_id: 'prajurit-1',
    user: { nama: 'Budi Santoso', nrp: '1234567' },
    jenis_izin: 'cuti',
    tanggal_mulai: '2026-04-01',
    tanggal_selesai: '2026-04-03',
    alasan: 'Urusan keluarga',
    status: 'pending',
    created_at: '2026-03-28T08:00:00Z',
  },
  {
    id: 'req-2',
    user_id: 'prajurit-2',
    user: { nama: 'Sari Dewi', nrp: '7654321' },
    jenis_izin: 'sakit',
    tanggal_mulai: '2026-04-05',
    tanggal_selesai: '2026-04-06',
    alasan: 'Sakit dengan surat dokter',
    status: 'approved',
    reviewed_by: 'staf-s1',
    reviewed_at: '2026-03-29T09:00:00Z',
    created_at: '2026-04-04T07:00:00Z',
  },
];

vi.mock('@/features/shared/hooks/useLeaveRequests', () => ({
  useLeaveRequests: () => ({
    requests: mockRequests,
    isLoading: false,
    reviewLeaveRequest: mockReviewLeaveRequest,
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StafLeaveReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(<StafLeaveReview />);
    expect(screen.getByText('Permohonan Izin Personel')).toBeInTheDocument();
  });

  it('shows pending count badge when there are pending requests', () => {
    render(<StafLeaveReview />);
    expect(screen.getByText(/menunggu persetujuan/i)).toBeInTheDocument();
  });

  it('shows pending requests by default', () => {
    render(<StafLeaveReview />);
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.queryByText('Sari Dewi')).not.toBeInTheDocument();
  });

  it('switches to "Semua" filter and shows all requests', () => {
    render(<StafLeaveReview />);
    fireEvent.click(screen.getByText('Semua'));
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Sari Dewi')).toBeInTheDocument();
  });

  it('shows empty state when filter has no results', () => {
    render(<StafLeaveReview />);
    fireEvent.click(screen.getByText('Ditolak'));
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('calls reviewLeaveRequest with approved when Setujui is clicked', async () => {
    render(<StafLeaveReview />);
    // Use exact text to avoid matching the "Disetujui" filter tab
    const approveBtn = screen.getByRole('button', { name: 'Setujui' });
    fireEvent.click(approveBtn);
    await waitFor(() => {
      expect(mockReviewLeaveRequest).toHaveBeenCalledWith('req-1', 'approved');
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('disetujui'),
      'success',
    );
  });

  it('opens rejection modal when Tolak is clicked', () => {
    render(<StafLeaveReview />);
    const rejectBtn = screen.getByRole('button', { name: 'Tolak' });
    fireEvent.click(rejectBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls reviewLeaveRequest with rejected from modal confirm', async () => {
    render(<StafLeaveReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
    const confirmBtn = screen.getByRole('button', { name: 'Ya, Tolak Izin' });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockReviewLeaveRequest).toHaveBeenCalledWith('req-1', 'rejected');
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('ditolak'),
      'info',
    );
  });
});
