import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import GatePassMonitorPage from '@/features/admin/pages/admin/GatePassMonitorPage';
import type { GatePass } from '@/types';

vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: 20, error: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ count: 20, error: null })),
      })),
    })),
  },
}));

const mockState: {
  gatePasses: GatePass[];
  fetchGatePasses: ReturnType<typeof vi.fn>;
} = {
  gatePasses: [],
  fetchGatePasses: vi.fn(async () => undefined),
};

vi.mock('@/store/gatePassStore', () => ({
  useGatePassStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock('@/features/shared/hooks/useGatePassRealtime', () => ({
  useGatePassRealtime: vi.fn(),
}));

vi.mock('@/features/shared/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function makeGatePass(partial: Partial<GatePass>): GatePass {
  return {
    id: partial.id ?? 'gp',
    user_id: partial.user_id ?? 'u1',
    keperluan: partial.keperluan ?? 'Keperluan',
    tujuan: partial.tujuan ?? 'Tujuan',
    waktu_keluar: partial.waktu_keluar ?? '2026-04-16T08:00:00Z',
    waktu_kembali: partial.waktu_kembali ?? '2026-04-16T18:00:00Z',
    status: partial.status ?? 'approved',
    qr_token: partial.qr_token ?? 'qr-token',
    created_at: partial.created_at ?? '2026-04-16T07:00:00Z',
    user: partial.user,
  };
}

describe('GatePassMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockState.fetchGatePasses = vi.fn(async () => undefined);
  });

  it('prioritizes critical rows: overdue first, then checked_in, then approved', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'approved-1',
        tujuan: 'Posko Approved',
        status: 'approved',
        waktu_keluar: '2026-04-16T08:00:00Z',
      }),
      makeGatePass({
        id: 'checked-in-1',
        tujuan: 'Posko Checked-In',
        status: 'checked_in',
        waktu_kembali: '2026-04-16T11:00:00Z',
      }),
      makeGatePass({
        id: 'overdue-1',
        tujuan: 'Posko Overdue',
        status: 'overdue',
        waktu_kembali: '2026-04-16T09:00:00Z',
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    const cards = screen.getAllByTestId(/monitor-card-/i);
    expect(cards[0]).toHaveTextContent('Posko Overdue');
    expect(cards[1]).toHaveTextContent('Posko Checked-In');
    expect(cards[2]).toHaveTextContent('Posko Approved');
  });

  it('filters by search text and status', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'alpha',
        tujuan: 'Rumah Sakit',
        status: 'overdue',
        waktu_kembali: '2026-04-16T09:00:00Z',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'beta',
        tujuan: 'Logistik',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Cari nama, NRP, tujuan, atau keperluan'), {
      target: { value: 'andi' },
    });
    fireEvent.change(screen.getByTestId('gatepass-monitor-status-filter'), { target: { value: 'overdue' } });

    expect(screen.getByText('Rumah Sakit')).toBeInTheDocument();
    expect(screen.queryByText('Logistik')).not.toBeInTheDocument();
  });

  it('filters rows by date range', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'old',
        tujuan: 'Kunjungan Lama',
        waktu_keluar: '2026-04-01T09:00:00Z',
      }),
      makeGatePass({
        id: 'new',
        tujuan: 'Kunjungan Baru',
        waktu_keluar: '2026-04-15T09:00:00Z',
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Tanggal keluar dari'), { target: { value: '2026-04-10' } });
    fireEvent.change(screen.getByLabelText('Tanggal keluar sampai'), { target: { value: '2026-04-20' } });

    const cards = screen.getAllByTestId(/monitor-card-/i);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Kunjungan Lama');
    expect(cards[1]).toHaveTextContent('Kunjungan Baru');
  });

  it('resets all active filters', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'reset-1',
        tujuan: 'Kunjungan Baru',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'reset-2',
        tujuan: 'Kunjungan Lama',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Cari nama, NRP, tujuan, atau keperluan'), {
      target: { value: 'andi' },
    });
    fireEvent.change(screen.getByTestId('gatepass-monitor-status-filter'), { target: { value: 'overdue' } });
    fireEvent.change(screen.getByLabelText('Tanggal keluar dari'), { target: { value: '2026-04-10' } });
    fireEvent.change(screen.getByLabelText('Tanggal keluar sampai'), { target: { value: '2026-04-20' } });

    expect(screen.queryByText('Kunjungan Lama')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Filter' }));

    expect(screen.getByPlaceholderText('Cari nama, NRP, tujuan, atau keperluan')).toHaveValue('');
    expect(screen.getByLabelText('Tanggal keluar dari')).toHaveValue('');
    expect(screen.getByLabelText('Tanggal keluar sampai')).toHaveValue('');
    expect(screen.getByTestId('gatepass-monitor-status-filter')).toHaveValue('all');
    expect(screen.getByText('Kunjungan Baru')).toBeInTheDocument();
    expect(screen.getByText('Kunjungan Lama')).toBeInTheDocument();
  });

  it('toggles critical mode to only show overdue and checked_in rows', async () => {
    mockState.gatePasses = [
      makeGatePass({ id: 'critical-1', tujuan: 'Kasus Overdue', status: 'overdue' }),
      makeGatePass({ id: 'critical-2', tujuan: 'Kasus Keluar', status: 'checked_in' }),
      makeGatePass({ id: 'critical-3', tujuan: 'Kasus Approved', status: 'approved' }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('gatepass-monitor-critical-mode'));

    expect(screen.getByText('Kasus Overdue')).toBeInTheDocument();
    expect(screen.getByText('Kasus Keluar')).toBeInTheDocument();
    expect(screen.queryByText('Kasus Approved')).not.toBeInTheDocument();
  });

  it('sorts by latest waktu_keluar when latest sort mode selected', async () => {
    mockState.gatePasses = [
      makeGatePass({ id: 'sort-1', tujuan: 'Kunjungan Lama', status: 'approved', waktu_keluar: '2026-04-10T08:00:00Z' }),
      makeGatePass({ id: 'sort-2', tujuan: 'Kunjungan Baru', status: 'approved', waktu_keluar: '2026-04-16T08:00:00Z' }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('gatepass-monitor-sort-mode'), { target: { value: 'latest' } });

    const cards = screen.getAllByTestId(/monitor-card-/i);
    expect(cards[0]).toHaveTextContent('Kunjungan Lama');
    expect(cards[1]).toHaveTextContent('Kunjungan Baru');
  });

  it('switches between card mode and table mode, then persists selection', async () => {
    mockState.gatePasses = [
      makeGatePass({ id: 'mode-1', tujuan: 'Data Alpha', status: 'approved' }),
      makeGatePass({ id: 'mode-2', tujuan: 'Data Bravo', status: 'checked_in' }),
    ];

    const { unmount } = render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    expect(screen.queryByTestId('monitor-table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/monitor-card-/i)).toHaveLength(2);

    fireEvent.click(screen.getByTestId('gatepass-monitor-display-table'));

    expect(screen.getByTestId('monitor-table')).toBeInTheDocument();
    expect(screen.queryByTestId(/monitor-card-/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('karyo_gatepass_monitor_display_mode')).toBe('table');

    unmount();
    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());
    expect(screen.getByTestId('monitor-table')).toBeInTheDocument();
  });

  it('renders all cards in test mode without virtualization gaps', async () => {
    mockState.gatePasses = Array.from({ length: 24 }, (_, index) =>
      makeGatePass({
        id: `bulk-${index + 1}`,
        tujuan: `Tujuan ${index + 1}`,
        status: index % 3 === 0 ? 'overdue' : index % 3 === 1 ? 'checked_in' : 'approved',
        user: {
          id: `u-${index + 1}`,
          nama: `Personel ${index + 1}`,
          nrp: `${10000 + index}`,
          role: 'prajurit',
          satuan: index % 2 === 0 ? 'Yon A' : 'Yon B',
          is_active: true,
          is_online: true,
          login_attempts: 0,
          created_at: '2026-04-16T00:00:00Z',
          updated_at: '2026-04-16T00:00:00Z',
        },
      }),
    );

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    const cards = screen.getAllByTestId(/monitor-card-/i);
    expect(cards).toHaveLength(24);
    expect(screen.getByTestId('monitor-card-bulk-1')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-card-bulk-24')).toBeInTheDocument();
  });

  it('filters rows by satuan', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'unit-1',
        tujuan: 'Unit Alpha',
        status: 'approved',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'unit-2',
        tujuan: 'Unit Bravo',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'Yon B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('gatepass-monitor-unit-filter'), { target: { value: 'Yon A' } });

    expect(screen.getByText('Unit Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Unit Bravo')).not.toBeInTheDocument();
  });

  it('filters overdue rows by overdue duration bucket', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'od-1',
        tujuan: 'Overdue Ringan',
        status: 'overdue',
        waktu_kembali: '2030-04-16T09:30:00Z',
      }),
      makeGatePass({
        id: 'od-2',
        tujuan: 'Overdue Berat',
        status: 'overdue',
        waktu_kembali: '2026-04-16T03:00:00Z',
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('gatepass-monitor-overdue-filter'), { target: { value: 'over_6h' } });

    const cards = screen.getAllByTestId(/monitor-card-/i);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Overdue Ringan');
    expect(cards[1]).toHaveTextContent('Overdue Berat');
  });

  it('shows unit summary cards for filtered rows', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'sum-1',
        tujuan: 'Unit A',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'sum-2',
        tujuan: 'Unit B',
        status: 'checked_in',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'sum-3',
        tujuan: 'Unit C',
        status: 'approved',
        user: { id: 'u3', nama: 'Candra', nrp: '54321', role: 'prajurit', satuan: 'Yon B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    expect(screen.getByText('Ringkasan per Satuan')).toBeInTheDocument();
    const summaryPanel = screen.getByTestId('gatepass-monitor-unit-summary');
    expect(within(summaryPanel).getByText('Yon A')).toBeInTheDocument();
    expect(within(summaryPanel).getByText('Yon B')).toBeInTheDocument();
  });

  it('filters rows when clicking a unit summary card', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'sum-click-1',
        tujuan: 'Unit Alpha',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'sum-click-2',
        tujuan: 'Unit Bravo',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'Yon B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(within(screen.getByTestId('gatepass-monitor-unit-summary')).getByText('Yon A'));

    expect(screen.getByTestId('gatepass-monitor-unit-filter')).toHaveValue('Yon A');
    expect(screen.getByText('Unit Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Unit Bravo')).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('gatepass-monitor-unit-summary')).getByText('Yon A'));

    expect(screen.getByTestId('gatepass-monitor-unit-filter')).toHaveValue('all');
  });

  it('copies gate pass detail and unit summary to clipboard', async () => {
    const writeTextMock = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    mockState.gatePasses = [
      makeGatePass({
        id: 'copy-1',
        tujuan: 'Unit Alpha',
        keperluan: 'Patroli',
        status: 'overdue',
        actual_keluar: '2026-04-16T10:00:00Z',
        actual_kembali: '2026-04-16T12:00:00Z',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'copy-2',
        tujuan: 'Unit Bravo',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'Yon B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ringkasan Yon A/i }));
    });

    const summaryCard = screen.getByRole('button', { name: /Ringkasan Yon A/i });
    await act(async () => {
      fireEvent.click(within(summaryCard).getByRole('button', { name: /Salin ringkasan/i }));
    });
    await waitFor(() => expect(screen.getByText(/Ringkasan Yon A disalin/i)).toBeInTheDocument());

    const monitorCard = screen.getByTestId('monitor-card-copy-1');
    await act(async () => {
      fireEvent.click(within(monitorCard).getByRole('button', { name: /Salin detail/i }));
    });
    await waitFor(() => expect(screen.getByText(/Detail Andi disalin/i)).toBeInTheDocument());

    expect(writeTextMock).toHaveBeenCalledTimes(2);
    expect(writeTextMock.mock.calls[0][0]).toContain('Satuan: Yon A');
    expect(writeTextMock.mock.calls[1][0]).toContain('Nama: Andi');
  });

  it('exports unit summary to csv file', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'summary-1',
        tujuan: 'Unit Alpha',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'Yon A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
      makeGatePass({
        id: 'summary-2',
        tujuan: 'Unit Bravo',
        status: 'approved',
        user: { id: 'u2', nama: 'Budi', nrp: '67890', role: 'prajurit', satuan: 'Yon B', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    const createObjectURLMock = vi.fn(() => 'blob:unit-summary');
    const revokeObjectURLMock = vi.fn(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Export Ringkasan/i }));

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:unit-summary');

    clickSpy.mockRestore();
  });

  it('exports filtered rows to csv file', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'csv-1',
        tujuan: 'Rumah Sakit',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    const createObjectURLMock = vi.fn(() => 'blob:gatepass');
    const revokeObjectURLMock = vi.fn(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:gatepass');

    clickSpy.mockRestore();
  });

  it('applies quick date preset 7 hari', async () => {
    mockState.gatePasses = [makeGatePass({ id: 'preset-1', tujuan: 'Preset Test' })];

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '7 hari' }));

    expect(screen.getByLabelText('Tanggal keluar dari')).not.toHaveValue('');
    expect(screen.getByLabelText('Tanggal keluar sampai')).not.toHaveValue('');
  });

  it('opens print window and triggers print for filtered rows', async () => {
    mockState.gatePasses = [
      makeGatePass({
        id: 'print-1',
        tujuan: 'Print Test',
        status: 'overdue',
        user: { id: 'u1', nama: 'Andi', nrp: '12345', role: 'prajurit', satuan: 'A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-16T00:00:00Z', updated_at: '2026-04-16T00:00:00Z' },
      }),
    ];

    const writeMock = vi.fn();
    const closeMock = vi.fn();
    const focusMock = vi.fn();
    const printMock = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: {
        write: writeMock,
        close: closeMock,
      } as unknown as Document,
      focus: focusMock,
      print: printMock,
    } as unknown as Window);

    render(<GatePassMonitorPage />);

    await waitFor(() => expect(screen.getByText('Monitoring Gate Pass')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Print Laporan' }));

    expect(openSpy).toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
    expect(printMock).toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
