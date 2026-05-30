import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportPersonelModal from '@/features/shared/components/admin/modals/ImportPersonelModal';

describe('ImportPersonelModal', () => {
  const onImport = vi.fn();
  const onPreview = vi.fn();
  const onClose = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onPreview.mockResolvedValue({
      totalRows: 4,
      validRows: 3,
      skippedRows: 1,
      missingRequiredRows: 1,
      duplicateRows: 0,
    });
  });

  it('accepts uppercase CSV extensions and triggers import', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ImportPersonelModal
        isOpen
        isSaving={false}
        onImport={onImport}
        onClose={onClose}
        onError={onError}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['NRP,Nama,Satuan,Role\n123456,Budi,Satuan A,prajurit'], 'personel.CSV', { type: 'text/csv' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: 'Impor' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects unsupported files', async () => {
    render(
      <ImportPersonelModal
        isOpen
        isSaving={false}
        onImport={onImport}
        onClose={onClose}
        onError={onError}
      />,
    );

    const targetInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(targetInput).toBeTruthy();
    const file = new File(['hello'], 'personel.pdf', { type: 'application/pdf' });
    fireEvent.change(targetInput as HTMLInputElement, { target: { files: [file] } });

    expect(onError).toHaveBeenCalledWith('Hanya file CSV/TSV/TXT yang diizinkan');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('accepts tsv files and triggers import', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ImportPersonelModal
        isOpen
        isSaving={false}
        onImport={onImport}
        onClose={onClose}
        onError={onError}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['NRP\tNama\tSatuan\tRole\n123456\tBudi\tSatuan A\tprajurit'], 'personel.tsv', { type: 'text/tab-separated-values' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: 'Impor' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects xlsx files', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ImportPersonelModal
        isOpen
        isSaving={false}
        onImport={onImport}
        onClose={onClose}
        onError={onError}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['dummy-binary'], 'personel.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: 'Impor' }));

    expect(onError).toHaveBeenCalledWith('Hanya file CSV/TSV/TXT yang diizinkan');
    expect(onImport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows preview summary when preview callback is provided', async () => {
    const { container } = render(
      <ImportPersonelModal
        isOpen
        isSaving={false}
        onImport={onImport}
        onPreview={onPreview}
        onClose={onClose}
        onError={onError}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['NRP,Nama,Satuan\n123456,Budi,Satuan A'], 'personel.csv', { type: 'text/csv' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(file));
    await waitFor(() => expect(screen.getByText('Total baris data: 4')).toBeInTheDocument());
    expect(screen.getByText('Baris valid: 3')).toBeInTheDocument();
    expect(screen.getByText('Baris dilewati: 1')).toBeInTheDocument();
  });
});
