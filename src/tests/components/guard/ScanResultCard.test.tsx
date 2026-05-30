import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScanResultCard from '@/features/shared/components/guard/ScanResultCard';

describe('ScanResultCard', () => {
  it('shows allow entry button for checked_in status', () => {
    render(
      <ScanResultCard
        data={{
          user: { nama: 'Prajurit B', nrp: '22334' },
          status: 'checked_in',
          waktu_keluar: '2026-04-14T08:00:00Z',
          waktu_kembali: '2026-04-14T17:00:00Z',
          actual_keluar: '2026-04-14T08:05:00Z',
          actual_kembali: null,
        }}
      />,
    );

    expect(screen.getByText('Prajurit B')).toBeInTheDocument();
    expect(screen.getByText('Sudah Keluar')).toBeInTheDocument();
    expect(screen.getByText('Scan kembali untuk masuk')).toBeInTheDocument();
  });

  it('shows allow exit button for approved status', () => {
    render(
      <ScanResultCard
        data={{
          user: { nama: 'Prajurit C', nrp: '33445' },
          status: 'approved',
          waktu_keluar: '2026-04-14T08:00:00Z',
          waktu_kembali: '2026-04-14T17:00:00Z',
          actual_keluar: null,
          actual_kembali: null,
        }}
      />,
    );

    expect(screen.getByText('Prajurit C')).toBeInTheDocument();
    expect(screen.getByText('Siap untuk keluar')).toBeInTheDocument();
  });

  it('shows completed status with both actual times', () => {
    render(
      <ScanResultCard
        data={{
          user: { nama: 'Prajurit A', nrp: '11223' },
          status: 'completed',
          waktu_keluar: '2026-04-14T08:00:00Z',
          waktu_kembali: '2026-04-14T17:00:00Z',
          actual_keluar: '2026-04-14T08:05:00Z',
          actual_kembali: '2026-04-14T17:10:00Z',
        }}
      />,
    );

    expect(screen.getByText('Prajurit A')).toBeInTheDocument();
    expect(screen.getByText('Sudah Kembali')).toBeInTheDocument();
  });
});
