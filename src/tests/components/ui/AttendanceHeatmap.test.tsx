import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttendanceHeatmap from '@/features/shared/components/ui/AttendanceHeatmap';
import type { Attendance } from '../../../../types';

function makeAttendance(daysAgo: number, status: Attendance['status']): Attendance {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `a-${daysAgo}`,
    user_id: 'u1',
    tanggal: d.toISOString().split('T')[0],
    status,
    created_at: d.toISOString(),
  };
}

describe('AttendanceHeatmap', () => {
  it('renders 30 day cells', () => {
    const { container } = render(<AttendanceHeatmap attendances={[]} />);
    // All cells are inside the grid; count grid-item divs (has h-7 class)
    const cells = container.querySelectorAll('.h-7');
    expect(cells).toHaveLength(30);
  });

  it('renders the heading', () => {
    render(<AttendanceHeatmap attendances={[]} />);
    expect(screen.getByText(/Kalender Kehadiran/)).toBeInTheDocument();
  });

  it('renders legend for all statuses', () => {
    render(<AttendanceHeatmap attendances={[]} />);
    expect(screen.getByText('Hadir')).toBeInTheDocument();
    expect(screen.getByText('Izin')).toBeInTheDocument();
    expect(screen.getByText('Sakit')).toBeInTheDocument();
    expect(screen.getByText('Dinas Luar')).toBeInTheDocument();
    expect(screen.getByText('Alpa')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada data')).toBeInTheDocument();
  });

  it('applies correct color class for hadir status', () => {
    const attendance = makeAttendance(0, 'hadir');
    const { container } = render(<AttendanceHeatmap attendances={[attendance]} />);
    const hadirCell = container.querySelector('.bg-success');
    expect(hadirCell).not.toBeNull();
  });

  it('applies correct color class for alpa status', () => {
    const attendance = makeAttendance(1, 'alpa');
    const { container } = render(<AttendanceHeatmap attendances={[attendance]} />);
    const alpaCell = container.querySelector('.bg-accent-red');
    expect(alpaCell).not.toBeNull();
  });

  it('applies no-data class for days without records', () => {
    const { container } = render(<AttendanceHeatmap attendances={[]} />);
    const noDataCells = container.querySelectorAll('.bg-surface\\/40');
    expect(noDataCells.length).toBeGreaterThan(0);
  });

  it('sets title attribute with date and status', () => {
    const attendance = makeAttendance(0, 'hadir');
    const { container } = render(<AttendanceHeatmap attendances={[attendance]} />);
    const cell = container.querySelector('[title*="Hadir"]');
    expect(cell).not.toBeNull();
  });

  it('sets aria-label on each cell', () => {
    render(<AttendanceHeatmap attendances={[]} />);
    const cells = screen.getAllByLabelText(/Tidak ada data/);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('handles multiple attendance records', () => {
    const attendances = [
      makeAttendance(0, 'hadir'),
      makeAttendance(1, 'izin'),
      makeAttendance(2, 'sakit'),
      makeAttendance(3, 'alpa'),
      makeAttendance(4, 'dinas_luar'),
    ];
    const { container } = render(<AttendanceHeatmap attendances={attendances} />);
    expect(container.querySelector('.bg-success')).not.toBeNull();
    expect(container.querySelector('.bg-accent-red')).not.toBeNull();
  });

  it('renders correctly with an empty attendance list', () => {
    render(<AttendanceHeatmap attendances={[]} />);
    // No errors thrown; legend is still visible
    expect(screen.getByText(/Kalender Kehadiran/)).toBeInTheDocument();
  });
});
