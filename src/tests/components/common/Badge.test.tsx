import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge, {
  TaskStatusBadge,
  AttendanceBadge,
  LeaveStatusBadge,
  RoleBadge,
} from '@/features/shared/components/common/Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('applies neutral variant by default', () => {
    const { container } = render(<Badge>Neutral</Badge>);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('applies sm size by default', () => {
    const { container } = render(<Badge>Small</Badge>);
    expect(container.firstChild).toHaveClass('text-[11px]');
  });

  it('applies md size when specified', () => {
    const { container } = render(<Badge size="md">Medium</Badge>);
    expect(container.firstChild).toHaveClass('text-sm');
  });

  const variants = ['success', 'error', 'warning', 'info', 'neutral', 'gold'] as const;
  for (const variant of variants) {
    it(`renders ${variant} variant`, () => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
    });
  }
});

describe('TaskStatusBadge', () => {
  const cases = [
    { status: 'pending', label: 'Menunggu' },
    { status: 'in_progress', label: 'Dikerjakan' },
    { status: 'done', label: 'Selesai' },
    { status: 'approved', label: 'Disetujui' },
    { status: 'rejected', label: 'Ditolak' },
  ] as const;

  for (const { status, label } of cases) {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<TaskStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }
});

describe('AttendanceBadge', () => {
  const cases = [
    { status: 'hadir', label: 'Hadir' },
    { status: 'izin', label: 'Izin' },
    { status: 'sakit', label: 'Sakit' },
    { status: 'alpa', label: 'Alpa' },
    { status: 'dinas_luar', label: 'Dinas Luar' },
  ] as const;

  for (const { status, label } of cases) {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<AttendanceBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }
});

describe('LeaveStatusBadge', () => {
  const cases = [
    { status: 'pending', label: 'Menunggu' },
    { status: 'approved', label: 'Disetujui' },
    { status: 'rejected', label: 'Ditolak' },
  ] as const;

  for (const { status, label } of cases) {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<LeaveStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }
});

describe('RoleBadge', () => {
  const cases = [
    { role: 'admin_satuan', label: 'Super Admin' },
    { role: 'komandan', label: 'Komandan' },
    { role: 'prajurit', label: 'Prajurit' },
    { role: 'guard', label: 'Petugas Jaga / Provost' },
    { role: 'staff_satuan', label: 'Staff Operasional' },
  ] as const;

  for (const { role, label } of cases) {
    it(`renders "${label}" for role "${role}"`, () => {
      render(<RoleBadge role={role} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }
});
