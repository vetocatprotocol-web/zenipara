import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/features/shared/components/layout/DashboardLayout';
import Table from '@/features/shared/components/ui/Table';
import Button from '@/features/shared/components/common/Button';
import PageHeader from '@/features/shared/components/ui/PageHeader';
import { RoleBadge } from '@/features/shared/components/common/Badge';
import { TableSkeleton } from '@/features/shared/components/common/Skeleton';
import Pagination from '@/features/shared/components/ui/Pagination';
import UserDetailModal from '@/features/shared/components/common/UserDetailModal';
import UserTableActions from '@/features/shared/components/admin/UserTableActions';
import BatchOperationModals from '@/features/shared/components/admin/BatchOperationModals';
import {
  CreateUserModal,
  ResetPinModal,
  BulkResetPinModal,
  RoleEditModal,
  DeleteUserModal,
  UnlockUserModal,
  ImportPersonelModal,
} from '@/features/shared/components/admin/modals';
import { useUsers } from '@/features/shared/hooks/useUsers';
import { useSatuans } from '@/features/shared/hooks/useSatuans';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useDebounce } from '@/features/shared/hooks/useDebounce';
import { ICONS } from '../../icons';
import { supabase } from '@/features/shared/lib/supabase';
import { notifyDataChanged } from '@/features/shared/lib/dataSync';
import { ensureSessionContext } from '@/features/shared/lib/api/sessionContext';
import { ROLE_OPTIONS, getRoleCode, getRoleDisplayLabel, isRoleAdmin, isRoleKomandan, normalizeRole } from '@/features/shared/lib/rolePermissions';
import { validatePin, validateRoleEditForm, getFirstErrorMessage } from '@/features/shared/lib/validation/personelValidation';
import type { User, Role, CommandLevel } from '../../types';

const PAGE_SIZE = 50;
const MAX_IMPORT_ROWS = 5000;
const IMPORT_CHUNK_SIZE = 50;
const DEFAULT_IMPORT_PIN = '123456';
const FALLBACK_HEADERS = ['nrp', 'nama', 'pangkat', 'satuan', 'role', 'level_komando', 'jabatan', 'pin'];

type CsvDelimiter = ',' | ';' | '\t' | '|';
type TabularRow = string[];

interface RegistrationFormLink {
  id: string;
  role: Role;
  token: string;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_at: string;
  created_by_name: string | null;
}

function normalizeImportedRole(value: string | undefined): Role {
  const normalized = normalizeRole(value ?? '') ?? 'prajurit';
  return (normalized === 'admin_satuan' || normalized === 'komandan' || normalized === 'staff_satuan' || normalized === 'guard' || normalized === 'prajurit')
    ? normalized
    : 'prajurit';
}

function splitCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function detectCsvDelimiter(text: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [',', ';', '\t', '|'];
  let bestDelimiter: CsvDelimiter = ',';
  let bestCount = -1;

  const sampleLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 10);

  if (sampleLines.length === 0) return bestDelimiter;

  for (const delimiter of candidates) {
    const count = sampleLines.reduce((total, line) => total + Math.max(splitCsvLine(line, delimiter).length - 1, 0), 0);
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .replace(/^"|"$/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toPlainNumberString(value: string): string {
  const normalized = value.trim().replace(',', '.');

  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) {
    return value.trim();
  }

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return value.trim();

  if (Number.isInteger(numberValue) && Math.abs(numberValue) <= Number.MAX_SAFE_INTEGER) {
    return Math.trunc(numberValue).toString();
  }

  return numberValue.toString();
}

function normalizeNrp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const plain = toPlainNumberString(trimmed)
    .replace(/^'+/, '')
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '');

  const digitsOnly = plain.replace(/[^0-9]/g, '');
  return digitsOnly || plain;
}

function mapTabularRowsToObjects(records: TabularRow[]): Record<string, string>[] {
  if (records.length === 0) return [];

  const firstRow = records[0];
  const hasHeader = isLikelyHeaderRow(firstRow);
  const headerRow = hasHeader ? firstRow : FALLBACK_HEADERS;
  const headers = headerRow.map((h, index) => {
    const normalizedHeader = normalizeCsvHeader(h);
    if (normalizedHeader.length > 0) return normalizedHeader;
    return `column_${index + 1}`;
  });

  const dataRows = hasHeader ? records.slice(1) : records;
  return dataRows
    .filter((row) => row.some((value) => value.trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? '').trim()])));
}

function parseDelimitedText(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((field) => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += ch;
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((field) => field !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

function isTextImportFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const mimeType = file.type.trim().toLowerCase();
  return (
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.txt') ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv' ||
    mimeType === 'text/tab-separated-values' ||
    mimeType === 'text/plain' ||
    mimeType === 'application/csv'
  );
}

async function parseTextImportFile(file: File): Promise<Record<string, string>[]> {
  return parseCSV(await decodeImportFile(file));
}

function isLikelyHeaderRow(row: string[]): boolean {
  const knownHeaderTokens = new Set([
    'nrp',
    'nomor_registrasi_personel',
    'nomor_registrasi',
    'nomor_induk',
    'nip',
    'nama',
    'nama_lengkap',
    'satuan',
    'unit',
    'role',
    'jabatan',
    'pangkat',
    'level_komando',
    'tingkat_komando',
    'pin',
  ]);

  const normalizedRow = row.map((cell) => normalizeCsvHeader(cell));
  const knownCount = normalizedRow.filter((cell) => knownHeaderTokens.has(cell)).length;
  return knownCount >= 2;
}

async function decodeImportFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return '';

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  if (utf8Text.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(bytes);
  }

  return utf8Text;
}

function pickRowValue(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value.trim() !== '') {
      return value.trim();
    }
  }

  return '';
}

function normalizeImportRow(row: Record<string, string>): Record<string, string> {
  return {
    nrp: pickRowValue(row, ['nrp', 'nomor_registrasi_personel', 'nomor_registrasi', 'nomor_induk', 'nip', 'no_nrp', 'id_personel']),
    nama: pickRowValue(row, ['nama', 'nama_lengkap', 'nama_personel', 'nama_anggota', 'nama_nama_lengkap', 'full_name', 'name']),
    pangkat: pickRowValue(row, ['pangkat', 'rank']),
    satuan: pickRowValue(row, ['satuan', 'unit', 'subunit', 'satuan_unit', 'nama_satuan', 'kesatuan', 'satker', 'unit_kerja', 'department']),
    role: pickRowValue(row, ['role', 'jabatan_role', 'jenis_role', 'status_role', 'peran', 'akses', 'hak_akses']),
    level_komando: pickRowValue(row, ['level_komando', 'tingkat_komando', 'levelkomando', 'tingkatkomando', 'command_level']),
    jabatan: pickRowValue(row, ['jabatan', 'posisi', 'position']),
    pin: pickRowValue(row, ['pin', 'pin_awal', 'default_pin']),
  };
}

/** Parse CSV text into array of objects keyed by header row. */
function parseCSV(text: string): Record<string, string>[] {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  if (!normalized) return [];

  const delimiter = detectCsvDelimiter(normalized);
  const records = parseDelimitedText(normalized, delimiter);
  return mapTabularRowsToObjects(records);
}

interface ImportRowsResult {
  totalRows: number;
  rows: Record<string, string>[];
  skippedRows: number;
  missingRequiredRows: number;
  duplicateRows: number;
}

function getErrorMessage(error: unknown, fallback = 'Gagal memproses data import'): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;

    const maybeDetails = (error as { details?: unknown }).details;
    if (typeof maybeDetails === 'string' && maybeDetails.trim()) return maybeDetails;

    const maybeHint = (error as { hint?: unknown }).hint;
    if (typeof maybeHint === 'string' && maybeHint.trim()) return maybeHint;
  }

  return fallback;
}

export default function UserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const setPage = (page: number) => setCurrentPage(Math.max(1, page));
  const [displayMode, setDisplayMode] = useState<'all' | 'paged'>('all');
  const isPagedMode = displayMode === 'paged';

  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [filterRole, setFilterRole] = useState<Role | ''>('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('');

  const { users, isLoading, error, totalItems, totalPages, createUser, updateUser, toggleUserActive, deleteUser, resetUserPin, getUserById } = useUsers({
    orderBy: 'created_at',
    ascending: false,
    serverPaginated: isPagedMode,
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchQuery: isPagedMode ? search : '',
    role: filterRole || undefined,
    isActive: filterStatus ? filterStatus === 'active' : undefined,
  });
  const { showNotification } = useUIStore();
  const authUser = useAuthStore((s) => s.user);
  const { satuans, isLoading: isSatuansLoading } = useSatuans({ onlyActive: true });

  const [showCreate, setShowCreate] = useState(false);
  const [showResetPin, setShowResetPin] = useState(false);
  const [showBulkReset, setShowBulkReset] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleEdit, setShowRoleEdit] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState<User | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const [bulkPin, setBulkPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // CSV import state
  const [isImporting, setIsImporting] = useState(false);

  // Closed registration form state
  const [registrationForms, setRegistrationForms] = useState<RegistrationFormLink[]>([]);
  const [isLoadingRegistrationForms, setIsLoadingRegistrationForms] = useState(false);
  const [isCreatingRegistrationForm, setIsCreatingRegistrationForm] = useState(false);
  const [registrationRole, setRegistrationRole] = useState<Role>('prajurit');
  const [registrationExpiryDays, setRegistrationExpiryDays] = useState(7);
  const [registrationMaxUses, setRegistrationMaxUses] = useState('');

  // Batch operations state
  const [batchOperation, setBatchOperation] = useState<'delete' | 'toggle-active' | 'role-change' | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const filteredUsers = useMemo(() => {
    if (isPagedMode) return users;

    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((u) =>
      u.nama.toLowerCase().includes(query) ||
      u.nrp.includes(search.trim()) ||
      (u.pangkat?.toLowerCase().includes(query) ?? false) ||
      (u.jabatan?.toLowerCase().includes(query) ?? false) ||
      (u.satuan?.toLowerCase().includes(query) ?? false),
    );
  }, [isPagedMode, users, search]);

  const pageStats = useMemo(() => {
    const active = filteredUsers.filter((u) => u.is_active).length;
    const inactive = filteredUsers.length - active;
    const online = filteredUsers.filter((u) => u.is_online).length;
    return {
      pageCount: filteredUsers.length,
      active,
      inactive,
      online,
    };
  }, [filteredUsers]);
  const hasFilters = searchRaw.trim().length > 0 || filterRole !== '' || filterStatus !== '';
  const selectedUsers = useMemo(
    () => filteredUsers.filter((u) => selectedUserIds.has(u.id)),
    [filteredUsers, selectedUserIds],
  );

  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [filteredUsers, currentPage]);

  const loadRegistrationForms = useCallback(async () => {
    if (!isRoleAdmin(authUser?.role) || !authUser?.id) {
      setRegistrationForms([]);
      return;
    }

    setIsLoadingRegistrationForms(true);
    try {
      await ensureSessionContext(authUser.id, authUser.role);
      const { data, error } = await supabase.rpc('list_registration_form_links');
      if (error) throw error;
      setRegistrationForms((data as RegistrationFormLink[]) ?? []);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal memuat form pendaftaran tertutup', 'error');
    } finally {
      setIsLoadingRegistrationForms(false);
    }
  }, [authUser?.id, authUser?.role, showNotification]);

  useEffect(() => {
    void loadRegistrationForms();
  }, [loadRegistrationForms]);

  const createRegistrationFormLink = async () => {
    if (!isRoleAdmin(authUser?.role) || !authUser?.id) {
      showNotification('Hanya admin yang bisa membuat link pendaftaran', 'error');
      return;
    }

    setIsCreatingRegistrationForm(true);
    try {
      await ensureSessionContext(authUser.id, authUser.role);

      const maxUses = registrationMaxUses.trim() ? Number.parseInt(registrationMaxUses.trim(), 10) : null;
      if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses <= 0)) {
        throw new Error('Maksimal penggunaan harus angka lebih dari 0');
      }

      const { data, error } = await supabase
        .rpc('create_registration_form_link', {
          p_role: registrationRole,
          p_expires_in_days: registrationExpiryDays,
          p_max_uses: maxUses,
        })
        .single();

      if (error) throw error;

      const created = data as RegistrationFormLink;
      const link = `${window.location.origin}${window.location.pathname}#/register/${created.token}`;

      setRegistrationForms((prev) => [created, ...prev]);
      showNotification('Link pendaftaran berhasil dibuat', 'success');

      try {
        await navigator.clipboard.writeText(link);
        showNotification('Link pendaftaran otomatis disalin ke clipboard', 'success');
      } catch {
        showNotification('Link berhasil dibuat. Salin manual dari daftar form di bawah.', 'warning');
      }
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membuat link pendaftaran', 'error');
    } finally {
      setIsCreatingRegistrationForm(false);
    }
  };

  const toggleRegistrationFormActive = async (form: RegistrationFormLink) => {
    if (!isRoleAdmin(authUser?.role) || !authUser?.id) {
      showNotification('Hanya admin yang bisa mengubah status form', 'error');
      return;
    }

    try {
      await ensureSessionContext(authUser.id, authUser.role);
      const nextStatus = !form.is_active;
      const { error } = await supabase.rpc('set_registration_form_active', {
        p_form_id: form.id,
        p_is_active: nextStatus,
      });
      if (error) throw error;

      setRegistrationForms((prev) => prev.map((item) => (item.id === form.id ? { ...item, is_active: nextStatus } : item)));
      showNotification(`Form pendaftaran ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengubah status form pendaftaran', 'error');
    }
  };

  const copyRegistrationLink = async (token: string) => {
    const link = `${window.location.origin}${window.location.pathname}#/register/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      showNotification('Link pendaftaran disalin ke clipboard', 'success');
    } catch {
      showNotification('Gagal menyalin link. Salin manual dari tabel.', 'error');
    }
  };

  const handleBulkResetPin = async () => {
    if (selectedUserIds.size === 0) {
      showNotification('Pilih minimal satu personel', 'error');
      return;
    }

    const pinError = validatePin(bulkPin);
    if (pinError) {
      showNotification(pinError.message, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('bulk_reset_pins', {
        p_user_ids: Array.from(selectedUserIds),
        p_new_pin: bulkPin,
      });
      if (error) throw error;
      const count = data as number;
      showNotification(`PIN ${count} personel berhasil direset`, 'success');
      setShowBulkReset(false);
      setBulkPin('');
      setSelectedUserIds(new Set());
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal reset PIN massal', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await toggleUserActive(u.id, !u.is_active);
      showNotification(`Akun ${u.nama} ${!u.is_active ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch {
      showNotification('Gagal mengubah status akun', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (authUser?.id === selectedUser.id) {
      showNotification('Tidak dapat menghapus akun sendiri', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await deleteUser(selectedUser.id);
      showNotification(`Data anggota ${selectedUser.nama} berhasil dihapus`, 'success');
      setShowDelete(false);
      setSelectedUser(null);
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedUser.id);
        return next;
      });
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menghapus anggota', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const buildImportRowsResult = async (file: File): Promise<ImportRowsResult> => {
    const parsedRows = isTextImportFile(file)
      ? await parseTextImportFile(file)
      : parseCSV(await decodeImportFile(file));
    const rows = parsedRows.map(normalizeImportRow);
    if (rows.length === 0) {
      throw new Error('File tidak berisi data yang bisa diproses');
    }

    const validRows: Record<string, string>[] = [];
    let missingRequiredRows = 0;
    let duplicateRows = 0;
    const seenNrp = new Set<string>();

    for (const row of rows) {
      const normalizedRow = {
        nrp: normalizeNrp(row.nrp ?? ''),
        nama: (row.nama ?? '').trim(),
        pangkat: (row.pangkat ?? '').trim(),
        satuan: (row.satuan ?? '').trim(),
        role: (row.role ?? '').trim(),
        level_komando: (row.level_komando ?? '').trim(),
        jabatan: (row.jabatan ?? '').trim(),
        pin: (row.pin ?? '').trim(),
      };

      if (!normalizedRow.nrp || !normalizedRow.nama || !normalizedRow.satuan) {
        missingRequiredRows += 1;
        continue;
      }

      if (seenNrp.has(normalizedRow.nrp)) {
        duplicateRows += 1;
        continue;
      }

      seenNrp.add(normalizedRow.nrp);
      validRows.push(normalizedRow);
    }

    if (validRows.length === 0) {
      throw new Error('Tidak ada baris valid. Pastikan kolom NRP, Nama, dan Satuan terisi. Kolom Role opsional (default prajurit).');
    }

    return {
      totalRows: rows.length,
      rows: validRows,
      skippedRows: missingRequiredRows + duplicateRows,
      missingRequiredRows,
      duplicateRows,
    };
  };

  const readImportRowsFromFile = async (file: File): Promise<ImportRowsResult> => buildImportRowsResult(file);

  const handlePreviewImportFile = async (file: File) => {
    const result = await buildImportRowsResult(file);
    return {
      totalRows: result.totalRows,
      validRows: result.rows.length,
      skippedRows: result.skippedRows,
      missingRequiredRows: result.missingRequiredRows,
      duplicateRows: result.duplicateRows,
    };
  };

  const handleImportFile = async (file: File) => {
    if (!isRoleAdmin(authUser?.role)) {
      throw new Error('Import CSV hanya untuk Super Admin');
    }

    const parsedResult = await readImportRowsFromFile(file);
    const rows = parsedResult.rows;

    if (parsedResult.skippedRows > 0) {
      showNotification(`${parsedResult.skippedRows} baris dilewati (data wajib kosong/duplikat NRP).`, 'warning');
    }

    if (rows.length === 0) {
      throw new Error('File CSV kosong atau format tidak valid');
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`Maksimal ${MAX_IMPORT_ROWS} data per import`);
    }

    setIsImporting(true);
    try {
      const authUser = useAuthStore.getState().user;
      if (!authUser) {
        throw new Error('Anda harus login terlebih dahulu');
      }

      // Ensure session context is set before RPC call
      await ensureSessionContext(authUser.id, authUser.role);

      const batches = [] as Record<string, string>[][];
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
        batches.push(rows.slice(i, i + IMPORT_CHUNK_SIZE));
      }

      let totalSuccess = 0;
      let totalFailed = 0;
      const allErrors: { nrp: string; error: string }[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex];
        const payload = batch.map((r) => ({
          nrp: r.nrp ?? '',
          pin: DEFAULT_IMPORT_PIN,
          nama: r.nama ?? '',
          role: normalizeImportedRole(r.role),
          satuan: r.satuan ?? '',
          pangkat: r.pangkat ?? '',
          jabatan: r.jabatan ?? '',
        }));

        try {
          const { data, error } = await supabase.rpc('import_users_csv', { p_users: payload });
          if (error) throw error;

          const result = data as { success: number; failed: number; errors: { nrp: string; error: string }[] };
          totalSuccess += result.success;
          totalFailed += result.failed;
          if (result.errors?.length) {
            allErrors.push(...result.errors);
          }
        } catch (batchError) {
          // Fallback: if one bad row breaks the whole batch, retry per-row so valid rows still import.
          const batchMessage = getErrorMessage(batchError, 'Gagal memproses batch import');
          if (import.meta.env.DEV) {
            console.warn(`[CSV Import] Batch ${batchIndex + 1}/${batches.length} gagal, fallback ke per-baris:`, batchError);
          }

          for (const row of batch) {
            const singlePayload = [{
              nrp: row.nrp ?? '',
              pin: DEFAULT_IMPORT_PIN,
              nama: row.nama ?? '',
              role: normalizeImportedRole(row.role),
              satuan: row.satuan ?? '',
              pangkat: row.pangkat ?? '',
              jabatan: row.jabatan ?? '',
            }];

            try {
              const { data, error } = await supabase.rpc('import_users_csv', { p_users: singlePayload });
              if (error) throw error;

              const singleResult = data as { success: number; failed: number; errors: { nrp: string; error: string }[] };
              totalSuccess += singleResult.success;
              totalFailed += singleResult.failed;

              if (singleResult.errors?.length) {
                allErrors.push(...singleResult.errors);
              }
            } catch (rowError) {
              totalFailed += 1;
              allErrors.push({
                nrp: row.nrp ?? '-',
                error: `Batch ${batchIndex + 1}/${batches.length}: ${getErrorMessage(rowError, batchMessage)}`,
              });
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const aggregated = { success: totalSuccess, failed: totalFailed, errors: allErrors };
      if (aggregated.success > 0) {
        showNotification(`${aggregated.success} personel berhasil diimpor. PIN awal: ${DEFAULT_IMPORT_PIN}`, 'success');
        setPage(1);
        notifyDataChanged('users');
      }

      if (aggregated.failed > 0 && aggregated.errors.length > 0) {
        const errorMsgs = aggregated.errors.slice(0, 3).map((e) => `${e.nrp}: ${e.error}`).join('; ');
        if (aggregated.success > 0) {
          showNotification(`Gagal: ${errorMsgs}${aggregated.errors.length > 3 ? '...' : ''}`, 'warning');
        } else {
          throw new Error(`Import gagal: ${errorMsgs}${aggregated.errors.length > 3 ? '...' : ''}`);
        }
      } else if (aggregated.failed > 0) {
        if (aggregated.success > 0) {
          showNotification(`${aggregated.failed} data gagal diimpor`, 'warning');
        } else {
          throw new Error('Semua data gagal diimpor');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengimpor data';
      showNotification(message, 'error');
      console.error('CSV Import error:', err);
      throw err;
    } finally {
      setIsImporting(false);
    }
  };

  const openRoleEdit = (user: User) => {
    setRoleEditUser(user);
    setShowRoleEdit(true);
  };

  const handleRoleUpdate = async (userId: string, role: Role, levelKomando?: CommandLevel) => {
    if (!userId) return;

    // Validate role edit form
    const errors = validateRoleEditForm({
      role,
      level_komando: levelKomando,
    });

    if (errors.length > 0) {
      showNotification(getFirstErrorMessage(errors) || 'Validasi gagal', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateUser(userId, {
        role,
        level_komando: isRoleKomandan(role) ? levelKomando : undefined,
      });
      showNotification(`Role ${roleEditUser?.nama ?? 'personel'} berhasil diubah`, 'success');
      setShowRoleEdit(false);
      setRoleEditUser(null);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengubah role', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const exportFilteredCSV = () => {
    if (filteredUsers.length === 0) {
      showNotification('Tidak ada data untuk diekspor', 'error');
      return;
    }
    const header = 'nrp,nama,pangkat,jabatan,satuan,role,status';
    const rows = filteredUsers.map((u) =>
      [
        u.nrp,
        `"${u.nama.replace(/"/g, '""')}"`,
        u.pangkat ?? '',
        u.jabatan ?? '',
        `"${u.satuan.replace(/"/g, '""')}"`,
        u.role,
        u.is_active ? 'aktif' : 'nonaktif',
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personel_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`${filteredUsers.length} personel berhasil diekspor`, 'success');
  };

  const handleUnlockUser = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await updateUser(selectedUser.id, { login_attempts: 0, locked_until: undefined });
      showNotification(`Akun ${selectedUser.nama} berhasil dibuka`, 'success');
      setShowUnlock(false);
      setSelectedUser(null);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membuka akun', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Batch operations handlers
  const handleBatchDelete = async () => {
    if (selectedUserIds.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedList = users.filter((u) => selectedUserIds.has(u.id));
      
      // Filter out current user (can't delete self)
      const toDelete = selectedList.filter((u) => u.id !== authUser?.id);
      
      if (toDelete.length === 0) {
        showNotification('Tidak ada personel yang bisa dihapus', 'error');
        return;
      }

      let deleted = 0;
      for (const user of toDelete) {
        try {
          await deleteUser(user.id);
          deleted++;
        } catch (e) {
          if (import.meta.env.DEV) console.warn(`Failed to delete ${user.nama}:`, e);
        }
      }

      showNotification(`${deleted} personel berhasil dihapus`, 'success');
      setSelectedUserIds(new Set());
      setBatchOperation(null);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menghapus personel', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchToggleActive = async (action: 'activate' | 'deactivate' | 'toggle') => {
    if (selectedUserIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      const selectedList = users.filter((u) => selectedUserIds.has(u.id));
      let updated = 0;

      for (const user of selectedList) {
        let newStatus: boolean;
        if (action === 'toggle') {
          newStatus = !user.is_active;
        } else {
          newStatus = action === 'activate';
        }

        try {
          await updateUser(user.id, { is_active: newStatus });
          updated++;
        } catch (e) {
          if (import.meta.env.DEV) console.warn(`Failed to update ${user.nama}:`, e);
        }
      }

      const actionLabel = action === 'activate' ? 'diaktifkan' : action === 'deactivate' ? 'dinonaktifkan' : 'diubah statusnya';
      showNotification(`${updated} personel berhasil ${actionLabel}`, 'success');
      setSelectedUserIds(new Set());
      setBatchOperation(null);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengubah status personel', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchRoleChange = async (role: Role, levelKomando?: CommandLevel) => {
    if (selectedUserIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      const selectedList = users.filter((u) => selectedUserIds.has(u.id));
      let updated = 0;

      for (const user of selectedList) {
        try {
          await updateUser(user.id, {
            role,
            level_komando: isRoleKomandan(role) ? levelKomando : undefined,
          });
          updated++;
        } catch (e) {
          if (import.meta.env.DEV) console.warn(`Failed to update ${user.nama}:`, e);
        }
      }

      showNotification(`Role ${updated} personel berhasil diubah ke ${role}`, 'success');
      setSelectedUserIds(new Set());
      setBatchOperation(null);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal mengubah role personel', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleOpenDetail = async (u: User) => {
    // Fetch full detail (including extended fields) before opening modal
    try {
      const full = await getUserById(u.id);
      setDetailUser(full);
    } catch {
      // Fallback to list data if RPC unavailable
      setDetailUser(u);
    }
    setShowDetail(true);
  };

  const handleSaveDetail = async (id: string, updates: Partial<User>) => {
    await updateUser(id, updates);
    // Best-effort detail refresh; the update is already committed.
    try {
      const refreshed = await getUserById(id);
      setDetailUser(refreshed);
    } catch {
      setDetailUser((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
    }
  };

  return (
    <DashboardLayout title="Manajemen Personel">
      <div className="space-y-5 animate-fade-up">
        <PageHeader
          title="Manajemen Personel"
          subtitle="Kelola akun, role, status aktif, reset PIN personel, dan impor data massal."
          breadcrumbs={[
            { label: 'Admin', href: '#/admin' },
            { label: 'Manajemen Personel' },
          ]}
          meta={
            <>
              <span>{totalItems} personel terdaftar</span>
              <span>{pageStats.pageCount} data tampil</span>
              <span>Mode tampil: {isPagedMode ? `Bertahap (${PAGE_SIZE}/halaman)` : 'Semua user'}</span>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card border border-surface/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Total Terdaftar</p>
                <p className="mt-2 text-2xl font-bold text-text-primary">{totalItems}</p>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary">
                All
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">Total personel di sistem</p>
          </div>
          <div className="app-card border border-surface/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Aktif (Tampil)</p>
                <p className="mt-2 text-2xl font-bold text-success">{pageStats.active}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-text-muted">Akun siap digunakan</p>
          </div>
          <div className="app-card border border-surface/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Nonaktif (Tampil)</p>
                <p className="mt-2 text-2xl font-bold text-accent-red">{pageStats.inactive}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-accent-red" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-text-muted">Perlu review status</p>
          </div>
          <div className="app-card border border-surface/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Online (Realtime)</p>
                <p className="mt-2 text-2xl font-bold text-primary">{pageStats.online}</p>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary">
                Live
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">Terlihat sedang aktif</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-accent-red/30 bg-gradient-to-r from-accent-red/10 to-rose-500/5 p-4 text-sm text-accent-red">
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-accent-red/15">
              <span className="text-base font-bold">!</span>
            </span>
            {error}
          </div>
        )}

        {/* Header actions */}
        <div className="app-card space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="form-grid-2col gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="relative sm:col-span-2 lg:col-span-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text"
                placeholder="Cari nama atau NRP..."
                value={searchRaw}
                onChange={(e) => { setSearchRaw(e.target.value); setPage(1); }}
                className="form-control form-input-responsive w-full bg-bg-card pl-9"
              />
            </div>
              <select
                value={filterRole}
                onChange={(e) => { setFilterRole(e.target.value as Role | ''); setPage(1); }}
                className="form-control form-input-responsive w-full bg-bg-card"
              >
                <option value="">Semua Role</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value as 'active' | 'inactive' | ''); setPage(1); }}
                className="form-control form-input-responsive w-full bg-bg-card"
              >
                <option value="">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <div className="col-span-2 grid grid-cols-2 gap-1 rounded-lg border border-surface/70 bg-surface/25 p-1 sm:col-span-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setDisplayMode('all'); setPage(1); }}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    !isPagedMode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => { setDisplayMode('paged'); setPage(1); }}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    isPagedMode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Bertahap
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={exportFilteredCSV} className="w-full sm:w-auto">
              <span className="flex items-center gap-1.5">
                <ICONS.Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </span>
            </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)} className="w-full sm:w-auto">
              <span className="flex items-center gap-1.5">
                <ICONS.File className="h-3.5 w-3.5" aria-hidden="true" />
                Import CSV
              </span>
            </Button>
              <Button size="sm" onClick={() => setShowCreate(true)} className="w-full sm:w-auto">+ Tambah</Button>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchRaw('');
                    setFilterRole('');
                    setFilterStatus('');
                    setPage(1);
                  }}
                  className="w-full sm:w-auto"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-2 xl:grid-cols-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              Filter role: {filterRole ? `${getRoleDisplayLabel(filterRole)} (${getRoleCode(filterRole)})` : 'Semua'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1">
              Filter status: {filterStatus === 'active' ? 'Aktif' : filterStatus === 'inactive' ? 'Nonaktif' : 'Semua'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-surface/60 bg-surface/20 px-2.5 py-1 sm:col-span-2 xl:col-span-1">
              Query: {searchRaw.trim() || 'Tidak ada'}
            </span>
          </div>
        </div>

        {/* Bulk selection toolbar */}
        {selectedUserIds.size > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-blue-500/5 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-xs font-bold">{selectedUserIds.size}</span>
                <span>personel dipilih</span>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary/90">
                  dari {filteredUsers.length} data saat ini
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button size="sm" variant="secondary" onClick={() => setShowBulkReset(true)} className="w-full sm:w-auto">
                  <ICONS.Key className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset PIN
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setBatchOperation('toggle-active')} className="w-full sm:w-auto">
                  <ICONS.ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Toggle Status
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setBatchOperation('role-change')} className="w-full sm:w-auto">
                  <ICONS.Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  Ubah Role
                </Button>
                {isRoleAdmin(authUser?.role) && (
                  <Button size="sm" variant="danger" onClick={() => setBatchOperation('delete')} className="w-full sm:w-auto">
                    <ICONS.Trash className="h-3.5 w-3.5" aria-hidden="true" />
                    Hapus
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds(new Set())} className="w-full sm:w-auto">
                  Batal
                </Button>
              </div>
            </div>
          </div>
        )}

        {isRoleAdmin(authUser?.role) && (
          <div className="app-card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Form Pendaftaran Tertutup</h3>
              <p className="mt-1 text-sm text-text-muted">
                Hanya admin yang dapat membuat link pendaftaran berdasarkan role, lalu mengaktifkan/nonaktifkan form tersebut.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Role Pendaftaran</label>
                <select
                  value={registrationRole}
                  onChange={(e) => setRegistrationRole(e.target.value as Role)}
                  className="form-control w-full bg-bg-card"
                >
                  {ROLE_OPTIONS.filter((opt) => opt.value !== ('admin_satuan' as any)).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Masa Berlaku (hari)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={registrationExpiryDays}
                  onChange={(e) => setRegistrationExpiryDays(Math.max(1, Math.min(365, Number.parseInt(e.target.value || '1', 10))))}
                  className="form-control w-full bg-bg-card"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Maks Penggunaan (opsional)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Kosong = tak terbatas"
                  value={registrationMaxUses}
                  onChange={(e) => setRegistrationMaxUses(e.target.value.replace(/[^\d]/g, ''))}
                  className="form-control w-full bg-bg-card"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={createRegistrationFormLink} isLoading={isCreatingRegistrationForm} className="w-full">
                  Buat Link Pendaftaran
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-surface/70">
              <table className="w-full text-sm">
                <thead className="bg-surface/30 text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Kuota</th>
                    <th className="px-3 py-2">Kedaluwarsa</th>
                    <th className="px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRegistrationForms ? (
                    <tr>
                      <td className="px-3 py-3 text-text-muted" colSpan={5}>Memuat form pendaftaran...</td>
                    </tr>
                  ) : registrationForms.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-text-muted" colSpan={5}>Belum ada form pendaftaran yang dibuat.</td>
                    </tr>
                  ) : (
                    registrationForms.map((form) => (
                      <tr key={form.id} className="border-t border-surface/50">
                        <td className="px-3 py-3 font-medium text-text-primary">{getRoleDisplayLabel(form.role)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${form.is_active ? 'bg-success/15 text-success' : 'bg-accent-red/15 text-accent-red'}`}>
                            {form.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-text-secondary">
                          {form.used_count}/{form.max_uses ?? '∞'}
                        </td>
                        <td className="px-3 py-3 text-text-secondary">
                          {form.expires_at ? new Date(form.expires_at).toLocaleString('id-ID') : 'Tanpa batas'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => copyRegistrationLink(form.token)}>
                              Salin Link
                            </Button>
                            <Button
                              size="sm"
                              variant={form.is_active ? 'ghost' : 'secondary'}
                              onClick={() => toggleRegistrationFormActive(form)}
                            >
                              {form.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <>
          <Table
            columns={[
              {
                key: 'select',
                className: 'w-10 whitespace-nowrap',
                header: (
                  <input
                    type="checkbox"
                      checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-surface accent-primary cursor-pointer"
                      title="Pilih semua data yang tampil"
                  />
                ),
                render: (u) => (
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    onChange={() => toggleSelectUser(u.id)}
                    className="h-4 w-4 rounded border-surface accent-primary cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
              {
                key: 'nrp',
                header: 'NRP',
                className: 'whitespace-nowrap',
                render: (u) => <span className="font-mono text-sm">{u.nrp}</span>,
              },
              { key: 'nama', header: 'Nama', className: 'min-w-[180px]' },
              {
                key: 'pangkat',
                header: 'Pangkat',
                className: 'hidden md:table-cell',
                render: (u) => u.pangkat ?? '—',
              },
              {
                key: 'jabatan',
                header: 'Jabatan',
                className: 'hidden lg:table-cell',
                render: (u) => u.jabatan ?? '—',
              },
              {
                key: 'satuan',
                header: 'Satuan',
                className: 'hidden xl:table-cell',
              },
              {
                key: 'role',
                header: 'Role',
                className: 'hidden md:table-cell',
                render: (u) => <RoleBadge role={u.role} />,
              },
              {
                key: 'is_online', header: 'Status', className: 'whitespace-nowrap', render: (u) => {
                  const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                  return (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${u.is_online ? 'bg-success' : 'bg-text-muted'}`} />
                        <span className="text-xs text-text-muted">{u.is_online ? 'Online' : 'Offline'}</span>
                      </div>
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-red">
                          <ICONS.Lock className="h-2.5 w-2.5" aria-hidden="true" />
                          Terkunci
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface/50 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                          Nonaktif
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'actions', header: 'Aksi', className: 'whitespace-nowrap', render: (u) => (
                  <UserTableActions
                    user={u}
                    currentUserId={authUser?.id}
                    onDetail={() => handleOpenDetail(u)}
                    onResetPin={() => { setSelectedUser(u); setShowResetPin(true); }}
                    onRoleEdit={() => openRoleEdit(u)}
                    onToggleActive={() => handleToggleActive(u)}
                    onUnlock={() => { setSelectedUser(u); setShowUnlock(true); }}
                    onDelete={() => { setSelectedUser(u); setShowDelete(true); }}
                  />
                ),
              },
            ]}
            data={filteredUsers}
            keyExtractor={(u) => u.id}
            isLoading={false}
            minTableWidthClass="min-w-[540px]"
            caption="Tabel manajemen personel berdasarkan filter role, status, dan pencarian"
            emptyMessage="Tidak ada personel ditemukan"
          />
          {isPagedMode && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              compactOnMobile
              onPageChange={setPage}
            />
          )}
          </>
        )}
      </div>

      <CreateUserModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        isSaving={isSaving}
        satuans={satuans}
        isSatuansLoading={isSatuansLoading}
        onSave={async (data) => {
          setIsSaving(true);
          try {
            await createUser({ ...data, is_active: true });
            showNotification('Personel berhasil ditambahkan', 'success');
            setPage(1);
            setShowCreate(false);
          } finally {
            setIsSaving(false);
          }
        }}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => showNotification(msg, 'success')}
      />

      <ResetPinModal
        isOpen={showResetPin}
        onClose={() => setShowResetPin(false)}
        isSaving={isSaving}
        user={selectedUser}
        onSave={async (userId, pin) => {
          setIsSaving(true);
          try {
            await resetUserPin(userId, pin);
          } finally {
            setIsSaving(false);
          }
        }}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => {
          showNotification(msg, 'success');
          setShowResetPin(false);
          setSelectedUser(null);
        }}
      />

      <BulkResetPinModal
        isOpen={showBulkReset}
        onClose={() => setShowBulkReset(false)}
        isSaving={isSaving}
        selectedUsers={selectedUsers}
        onSave={handleBulkResetPin}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => {
          showNotification(msg, 'success');
          setShowBulkReset(false);
          setSelectedUserIds(new Set());
        }}
      />

      <ImportPersonelModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        isSaving={isImporting}
        onImport={handleImportFile}
        onPreview={handlePreviewImportFile}
        onError={(msg) => showNotification(msg, 'error')}
      />

      <RoleEditModal
        isOpen={showRoleEdit}
        onClose={() => setShowRoleEdit(false)}
        isSaving={isSaving}
        user={roleEditUser}
        onSave={handleRoleUpdate}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => {
          showNotification(msg, 'success');
          setShowRoleEdit(false);
          setRoleEditUser(null);
        }}
      />

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setDetailUser(null); }}
        user={detailUser}
        viewerRole="admin_satuan"
        mode="edit"
        onSave={handleSaveDetail}
      />

      <DeleteUserModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        isSaving={isSaving}
        user={selectedUser}
        isCurrentUser={authUser?.id === selectedUser?.id}
        onDelete={handleDeleteUser}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => {
          showNotification(msg, 'success');
          setShowDelete(false);
          setSelectedUser(null);
        }}
      />

      <UnlockUserModal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
        isSaving={isSaving}
        user={selectedUser}
        onUnlock={handleUnlockUser}
        onError={(msg) => showNotification(msg, 'error')}
        onSuccess={(msg) => {
          showNotification(msg, 'success');
          setShowUnlock(false);
          setSelectedUser(null);
        }}
      />

      {/* Batch Operation Modals */}
      <BatchOperationModals
        isOpen={!!batchOperation}
        operationType={batchOperation}
        selectedUsers={selectedUsers}
        isSaving={isBatchProcessing}
        onDelete={handleBatchDelete}
        onToggleActive={handleBatchToggleActive}
        onRoleChange={handleBatchRoleChange}
        onClose={() => setBatchOperation(null)}
      />
    </DashboardLayout>
  );
}
