import { useState, useRef } from 'react';
import Button from '../../common/Button';
import Modal from '../../common/Modal';

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  missingRequiredRows: number;
  duplicateRows: number;
}

export interface ImportPersonelModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onImport: (file: File) => Promise<void>;
  onPreview?: (file: File) => Promise<ImportPreviewSummary>;
  onClose: () => void;
  onError: (message: string) => void;
}

export default function ImportPersonelModal({
  isOpen,
  isSaving,
  onImport,
  onPreview,
  onClose,
  onError,
}: ImportPersonelModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsvTemplate = () => {
    const rows = [
      ['NRP', 'Nama', 'Pangkat', 'Satuan', 'Role', 'Level Komando', 'Jabatan'],
      ['123456', 'Budi Santoso', 'Sertu', 'Komando I', 'komandan', 'KOMPI', 'Danton'],
      ['123457', 'Andi Pratama', 'Pratu', 'Komando I', 'prajurit', '', 'Anggota'],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerDownload(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), 'template_import_personel.csv');
  };

  const isSupportedImportFile = (file: File): boolean => {
    const fileName = file.name.trim().toLowerCase();
    const mimeType = file.type.trim().toLowerCase();
    return (
      fileName.endsWith('.csv') ||
      fileName.endsWith('.tsv') ||
      fileName.endsWith('.txt') ||
      mimeType === 'text/csv' ||
      mimeType === 'text/tab-separated-values' ||
      mimeType === 'text/plain' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/vnd.ms-excel'
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedImportFile(file)) {
      onError('Hanya file CSV/TSV/TXT yang diizinkan');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError('Ukuran file maksimal 5MB');
      return;
    }

    setSelectedFile(file);
    setPreview(null);

    if (onPreview) {
      setIsPreviewing(true);
      void onPreview(file)
        .then((result) => {
          setPreview(result);
        })
        .catch((error) => {
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          onError(error instanceof Error ? error.message : 'Gagal memvalidasi file impor');
        })
        .finally(() => {
          setIsPreviewing(false);
        });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      onError('Silakan pilih file CSV');
      return;
    }

    try {
      await onImport(selectedFile);
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    } catch {
      // Keep modal open so user can review/replace file after import failure.
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impor Data Personel"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button
            onClick={handleImport}
            isLoading={isSaving}
            disabled={!selectedFile || isPreviewing}
          >
            Impor
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-info-light rounded-md p-3">
          <p className="text-sm text-info-dark font-semibold mb-2">Format CSV:</p>
          <p className="text-xs text-info-dark font-mono bg-white rounded p-2 overflow-x-auto">
            NRP,Nama/Nama Lengkap,Pangkat,Satuan/Unit,Role,Tingkat Komando (opsional)
          </p>
          <p className="text-xs text-info-dark mt-2">
            <strong>Contoh:</strong> 123456,Budi Santoso,Sertu,Komando I,komandan,KOMPI
          </p>
          <p className="text-xs text-info-dark mt-2">
            File juga bisa memakai pemisah titik koma atau tab dari Excel/Spreadsheet.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleDownloadCsvTemplate}>
              Download Template CSV
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="personel-csv-input" className="text-sm font-semibold text-text-primary">File CSV/TSV/TXT *</label>
          <input
            id="personel-csv-input"
            ref={fileInputRef}
            type="file"
            accept=".csv,.CSV,.tsv,.TSV,.txt,.TXT,text/csv,text/tab-separated-values,text/plain,application/vnd.ms-excel,application/csv"
            onChange={handleFileChange}
            disabled={isSaving}
            className="mt-1 block w-full text-sm text-text-secondary
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-white
              hover:file:bg-primary-dark"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-text-secondary">
              ✓ File dipilih: {selectedFile.name}
              {selectedFile.size && ` (${(selectedFile.size / 1024).toFixed(2)} KB)`}
            </p>
          )}
          {isPreviewing && (
            <p className="mt-2 text-xs text-text-muted">Memvalidasi isi file...</p>
          )}
          {!isPreviewing && preview && (
            <div className="mt-2 rounded-lg border border-surface/60 bg-surface/20 p-2 text-xs text-text-secondary">
              <p>Total baris data: {preview.totalRows}</p>
              <p>Baris valid: {preview.validRows}</p>
              <p>Baris dilewati: {preview.skippedRows}</p>
              <p>Alasan dilewati: {preview.missingRequiredRows} data wajib kosong, {preview.duplicateRows} duplikat NRP</p>
            </div>
          )}
        </div>

        <div className="text-xs text-text-secondary space-y-1">
          <p>• Maksimal ukuran file: 5MB</p>
          <p>• NRP, Nama, dan Satuan wajib diisi (Role opsional, default prajurit)</p>
          <p>• Mendukung format CSV/TSV/TXT</p>
          <p>• Untuk file teks: mendukung pemisah koma, titik koma, tab, dan pipe (|)</p>
          <p>• PIN di CSV diabaikan, sistem memakai PIN default 123456</p>
          <p>• Duplikat NRP akan dilewati</p>
        </div>
      </div>
    </Modal>
  );
}
