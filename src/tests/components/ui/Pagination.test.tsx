import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '@/features/shared/components/ui/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders previous and next buttons', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Halaman sebelumnya')).toBeInTheDocument();
    expect(screen.getByLabelText('Halaman berikutnya')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Halaman sebelumnya')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Halaman berikutnya')).toBeDisabled();
  });

  it('calls onPageChange with currentPage - 1 when previous is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText('Halaman sebelumnya'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with currentPage + 1 when next is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText('Halaman berikutnya'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('marks current page button with aria-current="page"', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const currentBtn = screen.getByRole('button', { name: '2' });
    expect(currentBtn).toHaveAttribute('aria-current', 'page');
  });

  it('shows totalItems label when totalItems is provided', () => {
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} totalItems={150} pageSize={50} />
    );
    expect(screen.getByText(/Menampilkan 1–50 dari 150 data/)).toBeInTheDocument();
  });

  it('shows correct range label on page 2', () => {
    render(
      <Pagination currentPage={2} totalPages={3} onPageChange={vi.fn()} totalItems={150} pageSize={50} />
    );
    expect(screen.getByText(/Menampilkan 51–100 dari 150 data/)).toBeInTheDocument();
  });

  it('shows ellipsis for large page counts', () => {
    render(<Pagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />);
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('renders all page buttons for small page count', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('calls onPageChange with correct page on page button click', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('does not show totalItems label when totalItems is not provided', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.queryByText(/Menampilkan/)).not.toBeInTheDocument();
  });
});
