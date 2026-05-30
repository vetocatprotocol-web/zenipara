import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createGatePassMock = vi.fn();
const showNotificationMock = vi.fn();

vi.mock('../../../store/gatePassStore', () => ({
  useGatePassStore: (selector: (state: { createGatePass: typeof createGatePassMock }) => unknown) =>
    selector({ createGatePass: createGatePassMock }),
}));

vi.mock('../../../store/uiStore', () => ({
  useUIStore: () => ({ showNotification: showNotificationMock }),
}));

import GatePassForm from '@/features/shared/components/gatepass/GatePassForm';

describe('GatePassForm', () => {
  beforeEach(() => {
    createGatePassMock.mockReset();
    showNotificationMock.mockReset();
  });

  it('shows auto-approval feedback when the backend approves automatically', async () => {
    createGatePassMock.mockResolvedValue({
      gate_pass_id: 'gp-1',
      auto_approved: true,
      status: 'approved',
      approval_reason: 'Auto-approved: Komandan',
    });

    const user = userEvent.setup();
    render(<GatePassForm />);

    await user.type(screen.getByPlaceholderText('Contoh: Menghadiri rapat penting (min. 5 karakter)'), 'Menghadiri rapat');
    await user.type(screen.getByPlaceholderText('Contoh: Kantor pusat di Bandung (min. 3 karakter)'), 'Bandung');
    await user.click(screen.getByRole('button', { name: /Ajukan Izin Keluar/i }));

    expect(createGatePassMock).toHaveBeenCalledWith({
      keperluan: 'Menghadiri rapat',
      tujuan: 'Bandung',
      submit_latitude: undefined,
      submit_longitude: undefined,
      submit_accuracy: undefined,
    });
    expect(await screen.findByText('Gate Pass Disetujui Otomatis!')).toBeInTheDocument();
    expect(showNotificationMock).toHaveBeenCalledWith('Auto-approved: Komandan', 'success');
  });
});