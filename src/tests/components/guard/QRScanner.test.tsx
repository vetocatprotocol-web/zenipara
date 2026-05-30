import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { Html5QrcodeScanner } from 'html5-qrcode';
import QRScanner from '@/features/shared/components/guard/QRScanner';

describe('QRScanner', () => {
  it('renders scanner placeholder and initializes scanner', async () => {
    const onScan = vi.fn();
    const { container } = render(<QRScanner onScan={onScan} />);

    expect(container.querySelector('#qr-guard-scanner')).toBeInTheDocument();
    await waitFor(() => {
      expect(Html5QrcodeScanner).toHaveBeenCalled();
    });

    const scannerArgs = (Html5QrcodeScanner as unknown as { mock: { calls: Array<[string, { fps: number; qrbox: number }, boolean]> } }).mock.calls[0];
    expect(scannerArgs[0]).toBe('qr-guard-scanner');
    expect(scannerArgs[1]).toMatchObject({ fps: 10 });
    expect(scannerArgs[1].qrbox).toBeGreaterThan(0);
    expect(scannerArgs[2]).toBe(false);
    const scannerInstance = (Html5QrcodeScanner as unknown as { mock: { results: Array<{ value: { render: ReturnType<typeof vi.fn> } }> } }).mock.results[0].value;
    expect(scannerInstance.render).toHaveBeenCalled();
  });
});
