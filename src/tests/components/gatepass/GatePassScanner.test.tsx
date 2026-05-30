import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { Html5QrcodeScanner } from 'html5-qrcode';
import GatePassScanner from '@/features/shared/components/gatepass/GatePassScanner';

describe('GatePassScanner', () => {
  it('renders scanner container and initializes Html5QrcodeScanner', async () => {
    const onScan = vi.fn();
    const { container } = render(<GatePassScanner onScan={onScan} />);

    expect(container.querySelector('#gatepass-scanner')).toBeInTheDocument();
    await waitFor(() => {
      expect(Html5QrcodeScanner).toHaveBeenCalledWith('gatepass-scanner', { fps: 10, qrbox: 250 }, false);
    });
    const scannerInstance = (Html5QrcodeScanner as unknown as { mock: { results: Array<{ value: { render: ReturnType<typeof vi.fn> } }> } }).mock.results[0].value;
    expect(scannerInstance.render).toHaveBeenCalled();
  });
});
