# ZENIPARA — Instruksi Migrasi Arsitektur 7 Role Eksplisit
## Untuk GitHub Copilot Chat di Codespace
> Paste setiap fase ke Copilot Chat secara berurutan. Selesaikan dan verifikasi satu fase sebelum lanjut ke fase berikutnya.

---

## KONTEKS SISTEM (Baca dulu sebelum mulai)

**Stack:** React 18 + TypeScript + Vite + Zustand + Supabase (custom PIN auth, bukan Supabase Auth)

**Auth Pattern:** Custom session via `set_session_context` RPC → `karyo.current_user_id` & `karyo.current_user_role` di PostgreSQL session config. Semua akses DB lewat key `anon`. RLS di-enforce via helper functions `current_karyo_role_db()`, `current_karyo_satuan_id()`, dll.

**Struktur folder utama:**
```
src/
  app/               → router.tsx, ProtectedRoute.tsx
  features/
    auth/            → authStore.ts, LoginPage.tsx
    super-admin/     → pages/
    admin/           → pages/  (admin_satuan)
    komandan/        → pages/
    staff/           → pages/  (staff_satuan)
    prajurit/        → pages/
    shared/          → lib/rolePermissions.ts, types/index.ts
  types/index.ts
supabase/migrations/ → SQL migrations
```

**Role yang ADA sekarang (5 role):**
```
super_admin | admin_satuan | komandan | staff_satuan | prajurit
```
`komandan` dibedakan scope-nya via `level_komando: BATALION | KOMPI | PELETON`
`staff_satuan` dibedakan bidangnya via `jabatan` string → `getBidangFromJabatan()` → s1|s3|s4

**Target arsitektur (7 role eksplisit):**
```
Level 1: super_admin      → Pasi Intel / lintas satuan
Level 2: command_level    → Danyon & Wadanyon (read-only, otorisasi dokumen)
Level 3: staff_ops        → Pasi Ops  (S-3, kalatlap, penugasan)
         staff_pers       → Pasi Pers (S-1, personel, cuti)
         staff_log        → Pasi Log  (S-4, logistik, almatzi)
Level 4: unit_leader      → Danki / Dankizipur (kelola kompi)
Level 5: field_officer    → Danton (laporan harian, absensi peleton)
Level 6: anggota          → Prajurit biasa
```

---

---

# FASE 1 — TYPE SYSTEM & ROLE CONSTANTS

> **Tujuan:** Update semua type TypeScript dan konstanta role tanpa menyentuh UI atau DB dulu. Ini fondasi untuk semua fase berikutnya.

## Prompt untuk Copilot:

```
Saya sedang migrasi role system di Zenipara dari 5 role menjadi 7 role eksplisit.
Tolong lakukan perubahan berikut secara lengkap dan presisi:

## 1. Update `src/types/index.ts`

Ganti type Role yang ada:
```ts
export type Role = 'super_admin' | 'admin_satuan' | 'komandan' | 'staff_satuan' | 'prajurit';
```

Menjadi:
```ts
export type Role =
  | 'super_admin'     // Level 1: Pasi Intel — kontrol penuh lintas satuan
  | 'command_level'   // Level 2: Danyon & Wadanyon — read-only, otorisasi
  | 'staff_ops'       // Level 3a: Pasi Ops — kalatlap, penugasan, laporan
  | 'staff_pers'      // Level 3b: Pasi Pers — personel, cuti, absensi
  | 'staff_log'       // Level 3c: Pasi Log — logistik, almatzi, maintenance
  | 'unit_leader'     // Level 4: Danki — kelola & approve data kompinya
  | 'field_officer'   // Level 5: Danton — laporan harian, absensi peleton
  | 'anggota';        // Level 6: Prajurit — profil, cuti, jadwal pribadi
```

Hapus type `CommandLevel` karena sudah tidak dipakai. Tambahkan type baru:
```ts
export type StaffRole = 'staff_ops' | 'staff_pers' | 'staff_log';
export type CommandRole = 'command_level' | 'unit_leader';
export type FieldRole = 'field_officer' | 'anggota';
```

Update interface `User`: ganti field `level_komando?: CommandLevel` menjadi tidak ada (hapus). Tambahkan field:
```ts
kompi_id?: string;    // untuk unit_leader, field_officer, anggota
peleton_id?: string;  // untuk field_officer, anggota
```

Update interface `KaryoSession`:
```ts
export interface KaryoSession {
  user_id: string;
  role: Role;
  satuan_id: string | null;
  kompi_id: string | null;
  peleton_id: string | null;
  expires_at: string;
}
```

## 2. Update `src/features/shared/lib/rolePermissions.ts`

Ganti seluruh isi KNOWN_ROLES, ROLE_CODE_MAP, ROLE_ACCESS_MAP, ROLE_ALIASES, dan semua fungsi helper dengan versi baru berikut:

```ts
export const KNOWN_ROLES = [
  'super_admin',
  'command_level',
  'staff_ops',
  'staff_pers',
  'staff_log',
  'unit_leader',
  'field_officer',
  'anggota',
] as const;

export type KnownRole = typeof KNOWN_ROLES[number];

export const ROLE_CODE_MAP: Record<KnownRole, string> = {
  super_admin:   'SAD',
  command_level: 'CMD',
  staff_ops:     'S3',
  staff_pers:    'S1',
  staff_log:     'S4',
  unit_leader:   'DKI',
  field_officer: 'DTN',
  anggota:       'PJT',
};

export const ROLE_LABEL_MAP: Record<KnownRole, string> = {
  super_admin:   'Super Admin (Pasi Intel)',
  command_level: 'Command Level (Danyon/Wadan)',
  staff_ops:     'Staff Ops — S-3 (Pasi Ops)',
  staff_pers:    'Staff Pers — S-1 (Pasi Pers)',
  staff_log:     'Staff Log — S-4 (Pasi Log)',
  unit_leader:   'Unit Leader (Danki)',
  field_officer: 'Field Officer (Danton)',
  anggota:       'Anggota',
};

export const ROLE_ACCESS_MAP: Record<KnownRole, string> = {
  super_admin:   'Akses penuh lintas semua satuan, audit log, enkripsi',
  command_level: 'Read-only seluruh batalyon, otorisasi dokumen penting',
  staff_ops:     'Write kalatlap, penugasan lapangan, laporan operasi',
  staff_pers:    'Write data personel, kelola cuti, absensi satuan',
  staff_log:     'Write inventaris almatzi, maintenance, bon logistik',
  unit_leader:   'Kelola dan approve data kompi sendiri',
  field_officer: 'Isi laporan harian, absensi peleton sendiri',
  anggota:       'Read profil pribadi, ajukan cuti/izin, lihat jadwal',
};

// Alias untuk backward compat dengan data DB lama
const ROLE_ALIASES: Record<string, KnownRole> = {
  'super_admin': 'super_admin',
  'admin_satuan': 'super_admin',  // migrasi lama
  'admin': 'super_admin',
  'command_level': 'command_level',
  'komandan': 'command_level',    // migrasi lama
  'staff_ops': 'staff_ops',
  'staff_pers': 'staff_pers',
  'staff_log': 'staff_log',
  'staff_satuan': 'staff_ops',    // migrasi lama — default ke ops
  'staf': 'staff_ops',
  'unit_leader': 'unit_leader',
  'field_officer': 'field_officer',
  'anggota': 'anggota',
  'prajurit': 'anggota',          // migrasi lama
};
```

Tambahkan fungsi-fungsi helper berikut (ganti semua yang lama):

```ts
export function normalizeRole(role: string | null | undefined): KnownRole | null {
  if (!role) return null;
  const trimmed = role.trim().toLowerCase();
  if (KNOWN_ROLES.includes(trimmed as KnownRole)) return trimmed as KnownRole;
  return ROLE_ALIASES[trimmed] ?? null;
}

export function isKnownRole(role: string | null | undefined): role is KnownRole {
  return normalizeRole(role) !== null;
}

export function getRoleDisplayLabel(role: string | null | undefined): string {
  const n = normalizeRole(role);
  return n ? ROLE_LABEL_MAP[n] : '—';
}

export function getRoleCode(role: string | null | undefined): string {
  const n = normalizeRole(role);
  return n ? ROLE_CODE_MAP[n] : '—';
}

// Grup checker functions
export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function isCommandLevel(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'command_level';
}

export function isStaffOps(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'staff_ops';
}

export function isStaffPers(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'staff_pers';
}

export function isStaffLog(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'staff_log';
}

export function isAnyStaff(role: string | null | undefined): boolean {
  const n = normalizeRole(role);
  return n === 'staff_ops' || n === 'staff_pers' || n === 'staff_log';
}

export function isUnitLeader(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'unit_leader';
}

export function isFieldOfficer(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'field_officer';
}

export function isAnggota(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'anggota';
}

// Write permission check per modul
export type WriteModule = 'attendance' | 'leave' | 'tasks' | 'logistics' | 'kalatlap' | 'penugasan' | 'laporan_kemajuan' | 'inventaris' | 'maintenance' | 'bon_logistik' | 'documents' | 'audit';

export function canWrite(user: User | null, module: WriteModule): boolean {
  if (!user) return false;
  const r = normalizeRole(user.role);
  if (!r) return false;
  if (r === 'super_admin') return true;
  const map: Record<WriteModule, KnownRole[]> = {
    attendance:        ['staff_pers', 'field_officer'],
    leave:             ['staff_pers', 'unit_leader', 'command_level'],
    tasks:             ['staff_ops', 'unit_leader'],
    logistics:         ['staff_log'],
    kalatlap:          ['staff_ops'],
    penugasan:         ['unit_leader'],
    laporan_kemajuan:  ['field_officer'],
    inventaris:        ['staff_log'],
    maintenance:       ['staff_log'],
    bon_logistik:      ['unit_leader', 'staff_log'],
    documents:         ['super_admin', 'command_level', 'staff_ops', 'staff_pers', 'staff_log'],
    audit:             ['super_admin'],
  };
  return map[module]?.includes(r) ?? false;
}
```

Update ROLE_ROUTE_PATHS dengan struktur baru:
```ts
export const ROLE_ROUTE_PATHS = {
  super_admin:   { dashboard: '/super-admin/dashboard', satuans: '/super-admin/satuans', settings: '/super-admin/settings', audit: '/super-admin/audit' },
  command_level: { dashboard: '/command/dashboard', personnel: '/command/personnel', reports: '/command/reports', documents: '/command/documents' },
  staff_ops:     { dashboard: '/staff-ops/dashboard', kalatlap: '/staff-ops/kalatlap', penugasan: '/staff-ops/penugasan', laporan: '/staff-ops/laporan' },
  staff_pers:    { dashboard: '/staff-pers/dashboard', personnel: '/staff-pers/personnel', leave: '/staff-pers/leave', attendance: '/staff-pers/attendance' },
  staff_log:     { dashboard: '/staff-log/dashboard', inventaris: '/staff-log/inventaris', maintenance: '/staff-log/maintenance', bon: '/staff-log/bon' },
  unit_leader:   { dashboard: '/unit-leader/dashboard', tasks: '/unit-leader/tasks', personnel: '/unit-leader/personnel', leave: '/unit-leader/leave', gatepass: '/unit-leader/gatepass' },
  field_officer: { dashboard: '/field-officer/dashboard', absensi: '/field-officer/absensi', laporan: '/field-officer/laporan', tasks: '/field-officer/tasks' },
  anggota:       { dashboard: '/anggota/dashboard', profile: '/anggota/profile', leave: '/anggota/leave', gatepass: '/anggota/gatepass', jadwal: '/anggota/jadwal' },
} as const;

export const ROUTE_ROLE_GROUPS = {
  superAdminOnly:  ['super_admin'],
  commandOnly:     ['command_level'],
  staffOpsOnly:    ['staff_ops'],
  staffPersOnly:   ['staff_pers'],
  staffLogOnly:    ['staff_log'],
  allStaff:        ['staff_ops', 'staff_pers', 'staff_log'],
  unitLeaderOnly:  ['unit_leader'],
  fieldOfficerOnly:['field_officer'],
  anggotaOnly:     ['anggota'],
  satuanScoped:    ['command_level', 'staff_ops', 'staff_pers', 'staff_log', 'unit_leader', 'field_officer', 'anggota'],
  allRoles:        ['super_admin', 'command_level', 'staff_ops', 'staff_pers', 'staff_log', 'unit_leader', 'field_officer', 'anggota'],
} as const;
```

## 3. Fix semua TypeScript error

Setelah perubahan di atas, jalankan `npx tsc --noEmit` dan fix semua error yang muncul. Fokus pada:
- Semua tempat yang menggunakan `isRoleAdmin()`, `isRoleKomandan()`, `isRolePrajurit()`, `isRoleStaff()` → ganti dengan fungsi baru
- Semua tempat yang menggunakan `level_komando` → hapus atau ganti dengan `kompi_id`/`peleton_id`
- Semua tempat yang memeriksa `role === 'prajurit'` → ganti ke `isAnggota(role)`

Jangan ubah file SQL/migration dan jangan ubah UI pages dulu. Hanya types dan rolePermissions.
```

**Verifikasi Fase 1:**
```bash
npx tsc --noEmit
# Target: 0 error
```

---

---

# FASE 2 — DATABASE MIGRATION (SQL)

> **Tujuan:** Buat migration SQL baru yang menambahkan 7 role eksplisit, tabel baru untuk modul yang belum ada, dan kolom tambahan di tabel existing. TIDAK menghapus data lama.

## Prompt untuk Copilot:

```
Buat file SQL migration baru di `supabase/migrations/20260601_002_explicit_roles_and_new_modules.sql`.

Ini adalah migration lanjutan dari sistem Zenipara yang sudah punya tabel:
users, tasks, attendance, leave_requests, announcements, messages, logistics_items,
logistics_requests, gate_pass, shift_schedules, documents, discipline_notes, audit_logs,
satuans, kegiatan, laporan_ops, sprint, apel_sessions, apel_attendance, pos_jaga

Auth pattern: custom PIN, bukan Supabase Auth. Semua policy pakai:
- `public.current_karyo_user_id()` → UUID user aktif
- `public.current_karyo_role_db()` → role dari tabel users
- `public.current_karyo_satuan_id()` → satuan_id dari tabel users

Tulis migration berikut dalam satu file, dengan BEGIN/COMMIT:

## BAGIAN A: Update Enum/Constraint Role

-- 1. Tambah nilai role baru ke CHECK constraint di users (atau ubah enum jika pakai pg enum)
-- Cek dulu apakah role di users adalah TEXT atau ENUM. Jika TEXT, update CHECK constraint.
-- Jika ENUM, tambah nilai baru dengan ALTER TYPE.
-- Role baru: 'command_level', 'staff_ops', 'staff_pers', 'staff_log', 'unit_leader', 'field_officer', 'anggota'
-- Role lama yang harus tetap valid selama transisi: 'super_admin', 'admin_satuan', 'komandan', 'staff_satuan', 'prajurit', 'admin', 'staf', 'guard'

## BAGIAN B: Tambah Kolom Baru di Tabel users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kompi_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS peleton_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_kompi_id ON public.users(kompi_id);
CREATE INDEX IF NOT EXISTS idx_users_peleton_id ON public.users(peleton_id);

## BAGIAN C: Migrasi Role Lama ke Role Baru

-- Migrasikan data role lama ke role baru secara aman
UPDATE public.users SET role = 'anggota'       WHERE role IN ('prajurit');
UPDATE public.users SET role = 'command_level' WHERE role IN ('komandan') AND level_komando = 'BATALION';
UPDATE public.users SET role = 'unit_leader'   WHERE role IN ('komandan') AND level_komando = 'KOMPI';
UPDATE public.users SET role = 'field_officer' WHERE role IN ('komandan') AND level_komando = 'PELETON';

-- staff_satuan: default ke staff_ops, nanti admin bisa update per orang
UPDATE public.users SET role = 'staff_pers'
  WHERE role IN ('staff_satuan', 'staf')
    AND (jabatan ILIKE '%S-1%' OR jabatan ILIKE '%PERS%' OR jabatan ILIKE '%Pasi Pers%');

UPDATE public.users SET role = 'staff_log'
  WHERE role IN ('staff_satuan', 'staf')
    AND (jabatan ILIKE '%S-4%' OR jabatan ILIKE '%LOG%' OR jabatan ILIKE '%Pasi Log%');

UPDATE public.users SET role = 'staff_ops'
  WHERE role IN ('staff_satuan', 'staf')
    AND (jabatan ILIKE '%S-3%' OR jabatan ILIKE '%OPS%' OR jabatan ILIKE '%Pasi Ops%');

-- Sisa staff_satuan/staf yang belum termapping → default staff_ops
UPDATE public.users SET role = 'staff_ops'
  WHERE role IN ('staff_satuan', 'staf');

-- admin_satuan → tetap super_admin (mereka adalah Pasi Intel)
UPDATE public.users SET role = 'super_admin'
  WHERE role IN ('admin_satuan', 'admin');

-- guard → field_officer (paling mendekati tugas jaga)
UPDATE public.users SET role = 'field_officer'
  WHERE role = 'guard';

## BAGIAN D: Update Helper Functions di DB

-- Update current_karyo_staff_bidang() agar tidak lagi dipakai (deprecated)
-- Buat helper baru yang lebih eksplisit:

CREATE OR REPLACE FUNCTION public.current_karyo_is_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.role = p_role
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_is_any_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.role IN ('staff_ops', 'staff_pers', 'staff_log')
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_kompi_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.kompi_id
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_peleton_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.peleton_id
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id()
    AND u.is_active = TRUE
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_karyo_is_role(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_is_any_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_kompi_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_karyo_peleton_id() TO anon, authenticated;

## BAGIAN E: Tabel Baru — Modul S-2 Operasi

CREATE TABLE IF NOT EXISTS public.kalatlap (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan_id      UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  judul          VARCHAR(255) NOT NULL,
  jenis_latihan  TEXT NOT NULL CHECK (jenis_latihan IN ('konstruksi', 'ranjau', 'jembatan', 'tempur', 'administrasi', 'lainnya')),
  tanggal_mulai  DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  lokasi         VARCHAR(255),
  keterangan     TEXT,
  dibuat_oleh    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  klasifikasi    TEXT NOT NULL DEFAULT 'terbuka' CHECK (klasifikasi IN ('terbuka', 'terbatas', 'rahasia')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.penugasan_lapangan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan_id           UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  kompi_id            UUID REFERENCES public.satuans(id) ON DELETE SET NULL,
  kalatlap_id         UUID REFERENCES public.kalatlap(id) ON DELETE SET NULL,
  judul_tugas         VARCHAR(255) NOT NULL,
  deskripsi           TEXT,
  peleton_ids         UUID[],
  tanggal_mulai       DATE NOT NULL,
  tanggal_selesai     DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'selesai', 'dibatalkan')),
  dibuat_oleh_danki   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laporan_kemajuan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  penugasan_id        UUID NOT NULL REFERENCES public.penugasan_lapangan(id) ON DELETE CASCADE,
  satuan_id           UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  peleton_id          UUID REFERENCES public.satuans(id) ON DELETE SET NULL,
  danton_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  persentase_selesai  INTEGER NOT NULL DEFAULT 0 CHECK (persentase_selesai BETWEEN 0 AND 100),
  deskripsi_kemajuan  TEXT NOT NULL,
  foto_urls           TEXT[],
  kendala             TEXT,
  tanggal_laporan     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

## BAGIAN F: Tabel Baru — Modul S-4 Logistik Lanjutan

CREATE TABLE IF NOT EXISTS public.inventaris_almatzi (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan_id         UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  kode_barang       VARCHAR(50),
  nama_barang       VARCHAR(255) NOT NULL,
  kategori          TEXT NOT NULL CHECK (kategori IN ('senjata', 'amunisi', 'alat_berat', 'kendaraan', 'bahan_bakar', 'perlengkapan')),
  jumlah_total      INTEGER NOT NULL DEFAULT 0,
  jumlah_siap_pakai INTEGER NOT NULL DEFAULT 0,
  jumlah_rusak      INTEGER NOT NULL DEFAULT 0,
  satuan_ukur       VARCHAR(50) NOT NULL DEFAULT 'unit',
  nomor_seri        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jadwal_maintenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventaris_id       UUID NOT NULL REFERENCES public.inventaris_almatzi(id) ON DELETE CASCADE,
  satuan_id           UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  jenis_maintenance   TEXT NOT NULL CHECK (jenis_maintenance IN ('servis', 'ganti_oli', 'kalibrasi', 'inspeksi')),
  tanggal_terakhir    DATE,
  tanggal_berikutnya  DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'selesai', 'terlambat')),
  teknisi             VARCHAR(255),
  catatan             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bon_logistik (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan_id             UUID NOT NULL REFERENCES public.satuans(id) ON DELETE CASCADE,
  kompi_id              UUID REFERENCES public.satuans(id) ON DELETE SET NULL,
  diminta_oleh          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  inventaris_id         UUID REFERENCES public.inventaris_almatzi(id) ON DELETE SET NULL,
  nama_item             VARCHAR(255) NOT NULL,
  jumlah_diminta        INTEGER NOT NULL,
  keperluan             TEXT NOT NULL,
  tanggal_dibutuhkan    DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'diserahkan')),
  disetujui_oleh        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  catatan               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

## BAGIAN G: Upgrade Tabel Existing

-- documents: tambah klasifikasi dan akses kontrol
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS klasifikasi TEXT NOT NULL DEFAULT 'biasa'
    CHECK (klasifikasi IN ('biasa', 'terbatas', 'rahasia', 'sangat_rahasia')),
  ADD COLUMN IF NOT EXISTS min_role_akses TEXT DEFAULT 'anggota',
  ADD COLUMN IF NOT EXISTS can_download BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS watermark_text TEXT;

-- leave_requests: tambah approval chain 4 level
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS approved_by_danton UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_danki UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_pasi_pers UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_danyon UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS status_chain TEXT NOT NULL DEFAULT 'draft'
    CHECK (status_chain IN ('draft', 'diajukan', 'disetujui_danton', 'disetujui_danki', 'disetujui_pasi_pers', 'disetujui_danyon', 'ditolak'));

## BAGIAN H: RLS untuk Tabel Baru

-- Semua tabel baru: enable RLS dulu
ALTER TABLE public.kalatlap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penugasan_lapangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_kemajuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaris_almatzi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bon_logistik ENABLE ROW LEVEL SECURITY;

-- kalatlap: super_admin semua; command_level & semua satuan baca; staff_ops write
CREATE POLICY "kalatlap_super_admin" ON public.kalatlap FOR ALL TO anon
  USING (public.current_karyo_is_role('super_admin'));

CREATE POLICY "kalatlap_read_satuan" ON public.kalatlap FOR SELECT TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_role_db() IN ('command_level','staff_ops','staff_pers','staff_log','unit_leader','field_officer','anggota')
  );

CREATE POLICY "kalatlap_write_staff_ops" ON public.kalatlap FOR INSERT TO anon
  WITH CHECK (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_is_role('staff_ops')
  );

CREATE POLICY "kalatlap_update_staff_ops" ON public.kalatlap FOR UPDATE TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_is_role('staff_ops')
  );

-- penugasan_lapangan: unit_leader write, satuan read
CREATE POLICY "penugasan_super_admin" ON public.penugasan_lapangan FOR ALL TO anon
  USING (public.current_karyo_is_role('super_admin'));

CREATE POLICY "penugasan_read_satuan" ON public.penugasan_lapangan FOR SELECT TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_role_db() IN ('command_level','staff_ops','staff_pers','staff_log','unit_leader','field_officer')
  );

CREATE POLICY "penugasan_write_unit_leader" ON public.penugasan_lapangan FOR INSERT TO anon
  WITH CHECK (
    satuan_id = public.current_karyo_satuan_id()
    AND kompi_id = public.current_karyo_kompi_id()
    AND public.current_karyo_is_role('unit_leader')
  );

-- laporan_kemajuan: field_officer write (peleton sendiri)
CREATE POLICY "lapkem_super_admin" ON public.laporan_kemajuan FOR ALL TO anon
  USING (public.current_karyo_is_role('super_admin'));

CREATE POLICY "lapkem_read_satuan" ON public.laporan_kemajuan FOR SELECT TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_role_db() IN ('command_level','staff_ops','unit_leader','field_officer')
  );

CREATE POLICY "lapkem_write_field_officer" ON public.laporan_kemajuan FOR INSERT TO anon
  WITH CHECK (
    satuan_id = public.current_karyo_satuan_id()
    AND danton_id = public.current_karyo_user_id()
    AND public.current_karyo_is_role('field_officer')
  );

-- inventaris_almatzi: staff_log write, satuan read
CREATE POLICY "inventaris_super_admin" ON public.inventaris_almatzi FOR ALL TO anon
  USING (public.current_karyo_is_role('super_admin'));

CREATE POLICY "inventaris_read_satuan" ON public.inventaris_almatzi FOR SELECT TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_role_db() IN ('command_level','staff_ops','staff_pers','staff_log','unit_leader','field_officer')
  );

CREATE POLICY "inventaris_write_staff_log" ON public.inventaris_almatzi FOR ALL TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_is_role('staff_log')
  );

-- bon_logistik: unit_leader insert, staff_log update/approve
CREATE POLICY "bon_super_admin" ON public.bon_logistik FOR ALL TO anon
  USING (public.current_karyo_is_role('super_admin'));

CREATE POLICY "bon_read" ON public.bon_logistik FOR SELECT TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_role_db() IN ('command_level','staff_log','unit_leader')
  );

CREATE POLICY "bon_insert_unit_leader" ON public.bon_logistik FOR INSERT TO anon
  WITH CHECK (
    satuan_id = public.current_karyo_satuan_id()
    AND diminta_oleh = public.current_karyo_user_id()
    AND public.current_karyo_is_role('unit_leader')
  );

CREATE POLICY "bon_approve_staff_log" ON public.bon_logistik FOR UPDATE TO anon
  USING (
    satuan_id = public.current_karyo_satuan_id()
    AND public.current_karyo_is_role('staff_log')
  );

-- Indexes untuk semua tabel baru
CREATE INDEX IF NOT EXISTS idx_kalatlap_satuan_id ON public.kalatlap(satuan_id);
CREATE INDEX IF NOT EXISTS idx_penugasan_satuan_id ON public.penugasan_lapangan(satuan_id);
CREATE INDEX IF NOT EXISTS idx_penugasan_kompi_id ON public.penugasan_lapangan(kompi_id);
CREATE INDEX IF NOT EXISTS idx_lapkem_penugasan_id ON public.laporan_kemajuan(penugasan_id);
CREATE INDEX IF NOT EXISTS idx_lapkem_satuan_id ON public.laporan_kemajuan(satuan_id);
CREATE INDEX IF NOT EXISTS idx_inventaris_satuan_id ON public.inventaris_almatzi(satuan_id);
CREATE INDEX IF NOT EXISTS idx_jadmaint_inventaris_id ON public.jadwal_maintenance(inventaris_id);
CREATE INDEX IF NOT EXISTS idx_bon_satuan_id ON public.bon_logistik(satuan_id);

NOTIFY pgrst, 'reload schema';
```

**Verifikasi Fase 2:**
```bash
# Apply ke Supabase local jika ada, atau jalankan manual di Supabase SQL Editor
# Cek tidak ada error
supabase db push
# atau: paste manual ke Supabase Dashboard > SQL Editor
```

---

---

# FASE 3 — ROUTING & PROTECTED ROUTE

> **Tujuan:** Update router.tsx dan ProtectedRoute.tsx untuk mendukung 8 role (7 role + super_admin). Buat folder pages baru untuk role yang belum ada.

## Prompt untuk Copilot:

```
Update sistem routing Zenipara untuk mendukung 8 role eksplisit baru.
Jangan hapus file yang sudah ada — kita akan reuse dan extend.

## 1. Update `src/app/ProtectedRoute.tsx`

Ganti type import dari `Role` di types/index.ts (sudah diupdate di Fase 1).
Update logika allowedRoles agar compatible dengan role baru.
Tambahkan guard khusus untuk role yang butuh satuan_id:
- semua role KECUALI super_admin wajib punya satuan_id

Logic yang perlu diubah: `!isRoleSuperAdmin(userRole)` → `userRole !== 'super_admin'`

## 2. Update `src/app/router.tsx`

Tambahkan lazy imports untuk halaman-halaman baru:

```ts
// ── Command Level (Danyon/Wadan) ────────────────────────────
const CommandDashboard   = lazy(() => import('@/features/command/pages/CommandDashboard'));
const CommandPersonnel   = lazy(() => import('@/features/command/pages/CommandPersonnel'));
const CommandReports     = lazy(() => import('@/features/command/pages/CommandReports'));
const CommandDocuments   = lazy(() => import('@/features/command/pages/CommandDocuments'));

// ── Staff Ops (Pasi Ops / S-3) ──────────────────────────────
const StaffOpsDashboard  = lazy(() => import('@/features/staff-ops/pages/StaffOpsDashboard'));
const Kalatlap           = lazy(() => import('@/features/staff-ops/pages/Kalatlap'));
const PenugasanLapangan  = lazy(() => import('@/features/staff-ops/pages/PenugasanLapangan'));
const LaporanOpsStaff    = lazy(() => import('@/features/staff-ops/pages/LaporanOps'));

// ── Staff Pers (Pasi Pers / S-1) ────────────────────────────
const StaffPersDashboard = lazy(() => import('@/features/staff-pers/pages/StaffPersDashboard'));
const StaffPersPersonnel = lazy(() => import('@/features/staff-pers/pages/Personnel'));
const StaffPersLeave     = lazy(() => import('@/features/staff-pers/pages/LeaveManagement'));
const StaffPersAttendance= lazy(() => import('@/features/staff-pers/pages/AttendanceManagement'));

// ── Staff Log (Pasi Log / S-4) ──────────────────────────────
const StaffLogDashboard  = lazy(() => import('@/features/staff-log/pages/StaffLogDashboard'));
const Inventaris         = lazy(() => import('@/features/staff-log/pages/Inventaris'));
const Maintenance        = lazy(() => import('@/features/staff-log/pages/Maintenance'));
const BonLogistik        = lazy(() => import('@/features/staff-log/pages/BonLogistik'));

// ── Unit Leader (Danki) ─────────────────────────────────────
const UnitLeaderDashboard= lazy(() => import('@/features/unit-leader/pages/UnitLeaderDashboard'));
const UnitLeaderTasks    = lazy(() => import('@/features/unit-leader/pages/TaskManagement'));
const UnitLeaderPersonnel= lazy(() => import('@/features/unit-leader/pages/Personnel'));
const UnitLeaderLeave    = lazy(() => import('@/features/unit-leader/pages/LeaveApproval'));
const UnitLeaderGatepass = lazy(() => import('@/features/unit-leader/pages/GatePassApproval'));

// ── Field Officer (Danton) ──────────────────────────────────
const FieldOfficerDashboard= lazy(() => import('@/features/field-officer/pages/FieldOfficerDashboard'));
const FieldOfficerAbsensi  = lazy(() => import('@/features/field-officer/pages/Absensi'));
const LaporanKemajuan      = lazy(() => import('@/features/field-officer/pages/LaporanKemajuan'));
const FieldOfficerTasks    = lazy(() => import('@/features/field-officer/pages/MyTasks'));

// ── Anggota ─────────────────────────────────────────────────
const AnggotaDashboard   = lazy(() => import('@/features/anggota/pages/AnggotaDashboard'));
const AnggotaProfile     = lazy(() => import('@/features/anggota/pages/Profile'));
const AnggotaLeave       = lazy(() => import('@/features/anggota/pages/LeaveRequest'));
const AnggotaGatepass    = lazy(() => import('@/features/anggota/pages/GatePassPage'));
const AnggotaJadwal      = lazy(() => import('@/features/anggota/pages/Jadwal'));
```

Tambahkan route blocks baru ke dalam `createHashRouter([...])`, SETELAH blok yang sudah ada:

```ts
// ── Command Level ────────────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.commandOnly} />,
  children: [
    { path: R.command_level.dashboard,  element: wrap(<CommandDashboard />) },
    { path: R.command_level.personnel,  element: wrap(<CommandPersonnel />) },
    { path: R.command_level.reports,    element: wrap(<CommandReports />) },
    { path: R.command_level.documents,  element: wrap(<CommandDocuments />) },
  ],
},

// ── Staff Ops ────────────────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.staffOpsOnly} />,
  children: [
    { path: R.staff_ops.dashboard,  element: wrap(<StaffOpsDashboard />) },
    { path: R.staff_ops.kalatlap,   element: wrap(<Kalatlap />) },
    { path: R.staff_ops.penugasan,  element: wrap(<PenugasanLapangan />) },
    { path: R.staff_ops.laporan,    element: wrap(<LaporanOpsStaff />) },
  ],
},

// ── Staff Pers ───────────────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.staffPersOnly} />,
  children: [
    { path: R.staff_pers.dashboard,   element: wrap(<StaffPersDashboard />) },
    { path: R.staff_pers.personnel,   element: wrap(<StaffPersPersonnel />) },
    { path: R.staff_pers.leave,       element: wrap(<StaffPersLeave />) },
    { path: R.staff_pers.attendance,  element: wrap(<StaffPersAttendance />) },
  ],
},

// ── Staff Log ────────────────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.staffLogOnly} />,
  children: [
    { path: R.staff_log.dashboard,    element: wrap(<StaffLogDashboard />) },
    { path: R.staff_log.inventaris,   element: wrap(<Inventaris />) },
    { path: R.staff_log.maintenance,  element: wrap(<Maintenance />) },
    { path: R.staff_log.bon,          element: wrap(<BonLogistik />) },
  ],
},

// ── Unit Leader (Danki) ──────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.unitLeaderOnly} />,
  children: [
    { path: R.unit_leader.dashboard,  element: wrap(<UnitLeaderDashboard />) },
    { path: R.unit_leader.tasks,      element: wrap(<UnitLeaderTasks />) },
    { path: R.unit_leader.personnel,  element: wrap(<UnitLeaderPersonnel />) },
    { path: R.unit_leader.leave,      element: wrap(<UnitLeaderLeave />) },
    { path: R.unit_leader.gatepass,   element: wrap(<UnitLeaderGatepass />) },
  ],
},

// ── Field Officer (Danton) ───────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.fieldOfficerOnly} />,
  children: [
    { path: R.field_officer.dashboard,  element: wrap(<FieldOfficerDashboard />) },
    { path: R.field_officer.absensi,    element: wrap(<FieldOfficerAbsensi />) },
    { path: R.field_officer.laporan,    element: wrap(<LaporanKemajuan />) },
    { path: R.field_officer.tasks,      element: wrap(<FieldOfficerTasks />) },
  ],
},

// ── Anggota ──────────────────────────────────────────────────
{
  element: <ProtectedRoute allowedRoles={G.anggotaOnly} />,
  children: [
    { path: R.anggota.dashboard,  element: wrap(<AnggotaDashboard />) },
    { path: R.anggota.profile,    element: wrap(<AnggotaProfile />) },
    { path: R.anggota.leave,      element: wrap(<AnggotaLeave />) },
    { path: R.anggota.gatepass,   element: wrap(<AnggotaGatepass />) },
    { path: R.anggota.jadwal,     element: wrap(<AnggotaJadwal />) },
  ],
},
```

## 3. Buat Placeholder Pages

Buat file placeholder untuk SEMUA halaman baru yang di-import di router tapi belum ada.
Struktur folder baru yang perlu dibuat:

```
src/features/
  command/pages/
    CommandDashboard.tsx
    CommandPersonnel.tsx
    CommandReports.tsx
    CommandDocuments.tsx
  staff-ops/pages/
    StaffOpsDashboard.tsx
    Kalatlap.tsx
    PenugasanLapangan.tsx
    LaporanOps.tsx
  staff-pers/pages/
    StaffPersDashboard.tsx
    Personnel.tsx
    LeaveManagement.tsx
    AttendanceManagement.tsx
  staff-log/pages/
    StaffLogDashboard.tsx
    Inventaris.tsx
    Maintenance.tsx
    BonLogistik.tsx
  unit-leader/pages/
    UnitLeaderDashboard.tsx
    TaskManagement.tsx
    Personnel.tsx
    LeaveApproval.tsx
    GatePassApproval.tsx
  field-officer/pages/
    FieldOfficerDashboard.tsx
    Absensi.tsx
    LaporanKemajuan.tsx
    MyTasks.tsx
  anggota/pages/
    AnggotaDashboard.tsx
    Profile.tsx
    LeaveRequest.tsx
    GatePassPage.tsx
    Jadwal.tsx
```

Untuk SETIAP placeholder, isinya cukup:
```tsx
// src/features/[feature]/pages/[PageName].tsx
export default function [PageName]() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">[PageName] — Coming Soon</h1>
      <p className="text-gray-500 mt-2">Halaman ini sedang dalam pengembangan.</p>
    </div>
  );
}
```

Sesuaikan nama komponen dan judul dengan nama file.

Setelah selesai, jalankan `npx tsc --noEmit` dan pastikan 0 error.
```

**Verifikasi Fase 3:**
```bash
npx tsc --noEmit
npm run dev
# Login dengan masing-masing role dan verifikasi redirect ke dashboard yang benar
```

---

---

# FASE 4 — AUTH STORE & SESSION UPDATE

> **Tujuan:** Update authStore.ts agar menyimpan dan me-restore `kompi_id` dan `peleton_id` dalam session, dan update `set_session_context` RPC agar menerima parameter baru.

## Prompt untuk Copilot:

```
Update auth system Zenipara untuk mendukung session context yang menyimpan kompi_id dan peleton_id.

## 1. Update SQL — tambah migration baru

Buat file `supabase/migrations/20260601_003_update_session_context.sql`:

```sql
BEGIN;

-- Update set_session_context untuk terima kompi_id dan peleton_id
CREATE OR REPLACE FUNCTION public.set_session_context(
  p_user_id   UUID,
  p_role      TEXT,
  p_satuan_id UUID DEFAULT NULL,
  p_kompi_id  UUID DEFAULT NULL,
  p_peleton_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('karyo.current_user_id',   p_user_id::TEXT,                        TRUE);
  PERFORM set_config('karyo.current_user_role',  p_role,                                 TRUE);
  PERFORM set_config('karyo.current_satuan_id',  COALESCE(p_satuan_id::TEXT, ''),        TRUE);
  PERFORM set_config('karyo.current_kompi_id',   COALESCE(p_kompi_id::TEXT, ''),         TRUE);
  PERFORM set_config('karyo.current_peleton_id', COALESCE(p_peleton_id::TEXT, ''),       TRUE);
END;
$$;

-- Update verify_user_pin untuk return kompi_id dan peleton_id
-- (cek nama function yang ada di migration 003_server_functions.sql, sesuaikan)
-- Tambah kolom ke return type jika function pakai RETURNS TABLE atau RETURNS SETOF

-- Update current_karyo_satuan_id jika belum pakai session config
CREATE OR REPLACE FUNCTION public.current_karyo_satuan_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT NULLIF(current_setting('karyo.current_satuan_id', TRUE), '')::UUID;
$$;

COMMIT;
```

## 2. Update `src/features/auth/authStore.ts`

Cari fungsi `login` di authStore. Setelah berhasil verify PIN dan dapat data user, tambahkan call ke `set_session_context` dengan parameter baru:

```ts
// Setelah verify_user_pin berhasil, tambahkan kompi_id dan peleton_id:
await supabase.rpc('set_session_context', {
  p_user_id:    userData.id,
  p_role:       userData.role,
  p_satuan_id:  userData.satuan_id ?? null,
  p_kompi_id:   userData.kompi_id ?? null,
  p_peleton_id: userData.peleton_id ?? null,
});
```

Update interface `KaryoSession` yang disimpan di sessionStorage:
```ts
const session: KaryoSession = {
  user_id:     userData.id,
  role:        userData.role,
  satuan_id:   userData.satuan_id ?? null,
  kompi_id:    userData.kompi_id ?? null,
  peleton_id:  userData.peleton_id ?? null,
  expires_at:  expiresAt.toISOString(),
};
```

Update fungsi `restoreSession`: saat restore, pastikan `set_session_context` juga dipanggil ulang dengan kompi_id dan peleton_id dari session yang tersimpan.

## 3. Update `getRoleDefaultPath` di rolePermissions.ts

```ts
const ROLE_DEFAULT_PATH_MAP: Record<KnownRole, string> = {
  super_admin:   '/super-admin/dashboard',
  command_level: '/command/dashboard',
  staff_ops:     '/staff-ops/dashboard',
  staff_pers:    '/staff-pers/dashboard',
  staff_log:     '/staff-log/dashboard',
  unit_leader:   '/unit-leader/dashboard',
  field_officer: '/field-officer/dashboard',
  anggota:       '/anggota/dashboard',
};

export function getRoleDefaultPath(role: string | null | undefined): string | null {
  const n = normalizeRole(role);
  return n ? ROLE_DEFAULT_PATH_MAP[n] : null;
}

export function getRoleFallbackPaths(role: string | null | undefined): string[] {
  const n = normalizeRole(role);
  if (!n) return [];
  return [ROLE_DEFAULT_PATH_MAP[n]];
}
```

## 4. Update UserManagement (admin page) — tambah field kompi_id & peleton_id

Di `src/features/admin/pages/UserManagement.tsx` dan modal `CreateUserModal.tsx` / `RoleEditModal.tsx`:
- Tambahkan dropdown untuk memilih `kompi_id` (dari list satuans tingkat `company`)
- Tambahkan dropdown untuk memilih `peleton_id` (dari list satuans tingkat `squad`)
- Tampilkan field kompi/peleton hanya jika role yang dipilih adalah `unit_leader`, `field_officer`, atau `anggota`
- Tampilkan badge role label yang baru (pakai `getRoleDisplayLabel()` yang sudah diupdate)

## 5. Update RPC `create_user_with_pin` dan `api_update_user`

Di file migration baru `supabase/migrations/20260601_004_update_user_rpcs.sql`, update kedua function untuk menerima dan menyimpan `p_kompi_id` dan `p_peleton_id`:

```sql
-- Tambahkan parameter baru ke create_user_with_pin:
-- p_kompi_id UUID DEFAULT NULL
-- p_peleton_id UUID DEFAULT NULL
-- Dan INSERT ke kolom kompi_id, peleton_id

-- Tambahkan ke api_update_user p_updates JSONB handling:
-- kompi_id := (p_updates->>'kompi_id')::UUID
-- peleton_id := (p_updates->>'peleton_id')::UUID
-- UPDATE SET kompi_id = ..., peleton_id = ...
```

Setelah selesai: `npx tsc --noEmit` harus 0 error.
```

**Verifikasi Fase 4:**
```bash
npx tsc --noEmit
npm run dev
# Login sebagai unit_leader → cek kompi_id tersimpan di session
# Login sebagai field_officer → cek peleton_id tersimpan di session
```

---

---

# FASE 5 — DASHBOARD PAGES & API LAYER

> **Tujuan:** Implementasikan halaman dashboard fungsional untuk 3 role terpenting (command_level, unit_leader, field_officer) dan buat API layer untuk modul baru (kalatlap, penugasan, laporan kemajuan, inventaris).

## Prompt untuk Copilot:

```
Implementasikan dashboard dan API layer untuk role-role baru di Zenipara.
Ikuti pola yang sudah ada di codebase (Zustand store, hooks, API lib).

## 1. Buat API functions di `src/features/shared/lib/api/`

Buat file baru `kalatlap.ts`:
```ts
// Mengikuti pola di kegiatan.ts atau laporan_ops.ts yang sudah ada
// Fungsi: fetchKalatlap, createKalatlap, updateKalatlap, deleteKalatlap
// Semua pakai supabase.from('kalatlap') dengan filter satuan_id dari session
// Error handling pakai handleError() dari shared/lib/handleError.ts
```

Buat file baru `penugasan.ts`:
```ts
// fetchPenugasan (filter by kompi_id untuk unit_leader)
// createPenugasan (hanya unit_leader)
// updatePenugasanStatus
```

Buat file baru `laporanKemajuan.ts`:
```ts
// fetchLaporanKemajuan (filter by penugasan_id)
// createLaporanKemajuan (hanya field_officer, danton_id = current user)
// Upload foto ke Supabase Storage bucket 'laporan-kemajuan'
```

Buat file baru `inventaris.ts`:
```ts
// fetchInventaris
// createInventaris, updateInventaris (hanya staff_log)
// fetchJadwalMaintenance
// updateMaintenanceStatus
// fetchBonLogistik
// createBonLogistik (unit_leader), approveBonLogistik (staff_log)
```

## 2. Buat hooks di `src/features/shared/hooks/`

Buat `useKalatlap.ts`, `usePenugasan.ts`, `useLaporanKemajuan.ts`, `useInventaris.ts`.
Ikuti pola `useKegiatan.ts` atau `useTasks.ts` yang sudah ada (useState, useEffect, loading/error state).

## 3. Implementasi Dashboard `CommandDashboard.tsx`

File: `src/features/command/pages/CommandDashboard.tsx`

Tampilkan (semua data read-only, dari satuan sendiri):
- Metric cards: Total Personel, Hadir Hari Ini, Gate Pass Aktif, Tugas Pending
- Grafik kesiapan tempur (bar chart sederhana: Hadir vs Absen per hari 7 hari terakhir)
- List 5 laporan operasi terbaru
- List dokumen yang butuh otorisasi Danyon (filter `klasifikasi = 'rahasia'`)

Pakai komponen yang sudah ada: `StatCard`, `BarChart`, `MetricCard` dari `shared/components/ui/`.
Data dari hook `useUsers`, `useAttendance`, `useGatePass` yang sudah ada.
Tampilkan badge "READ ONLY" di header dashboard.

## 4. Implementasi Dashboard `UnitLeaderDashboard.tsx`

File: `src/features/unit-leader/pages/UnitLeaderDashboard.tsx`

Tampilkan (data difilter by kompi_id):
- Metric cards: Personel Kompi, Hadir Hari Ini, Penugasan Aktif, Gate Pass Pending Approve
- Quick actions: Buat Penugasan Baru, Approve Gate Pass, Lihat Laporan Kemajuan
- List penugasan aktif dengan persentase dari laporan_kemajuan terbaru
- List cuti pending yang butuh approval Danki

Data dari hook `usePenugasan`, `useGatePass` (filtered by kompi_id).

## 5. Implementasi Dashboard `FieldOfficerDashboard.tsx`

File: `src/features/field-officer/pages/FieldOfficerDashboard.tsx`

Tampilkan (data difilter by peleton_id):
- Metric cards: Personel Peleton, Hadir Hari Ini, Penugasan Peleton Aktif
- Quick actions: Isi Absensi Peleton, Submit Laporan Kemajuan
- Absensi hari ini (list nama + status hadir/alpa)
- Form submit laporan kemajuan (pilih penugasan, isi persentase, deskripsi, upload foto)

## 6. Implementasi halaman `Kalatlap.tsx` (Staff Ops)

File: `src/features/staff-ops/pages/Kalatlap.tsx`

UI:
- Tampilan kalender bulanan dengan event kalatlap
- Tombol "Buat Kalatlap Baru" (form modal: judul, jenis_latihan dropdown, tanggal, lokasi, klasifikasi)
- List kalatlap dengan filter bulan & jenis
- Badge klasifikasi berwarna (terbuka=hijau, terbatas=kuning, rahasia=merah)
- Dari setiap kalatlap bisa membuat penugasan_lapangan

## 7. Update `LoginPage.tsx`

Setelah login sukses, pastikan redirect ke `getRoleDefaultPath(user.role)` yang baru.
Tampilkan nama role yang baru di error message jika login gagal (pakai `getRoleDisplayLabel()`).

## 8. Update Sidebar/Navigation untuk setiap role baru

Di `src/features/shared/components/layout/Sidebar.tsx` atau `BottomTabBar.tsx`:
Tambahkan nav items untuk setiap role baru mengikuti pola yang sudah ada.

Untuk `command_level`:
- Dashboard, Data Personel, Laporan, Dokumen

Untuk `staff_ops`:
- Dashboard, Kalatlap, Penugasan Lapangan, Laporan Ops

Untuk `staff_pers`:
- Dashboard, Data Personel, Kelola Cuti, Absensi

Untuk `staff_log`:
- Dashboard, Inventaris Almatzi, Jadwal Maintenance, Bon Logistik

Untuk `unit_leader`:
- Dashboard, Tugas Kompi, Personel, Approve Cuti, Gate Pass

Untuk `field_officer`:
- Dashboard, Absensi Peleton, Laporan Kemajuan, Tugas Saya

Untuk `anggota`:
- Dashboard, Profil, Ajukan Cuti, Gate Pass, Jadwal

## 9. Update UserManagement — tampilkan badge role baru

Di tabel user management (`UserManagement.tsx`), ganti tampilan role dari string mentah ke:
```tsx
<span className={`badge badge-${getRoleCode(user.role)}`}>
  {getRoleDisplayLabel(user.role)}
</span>
```

Tambahkan filter dropdown untuk filter by role baru di halaman user management.

## 10. Jalankan test suite

```bash
npx tsc --noEmit
npm run test -- --run
npm run dev
```

Fix semua error yang muncul. Untuk test yang fail karena perubahan role names,
update mock data di test files: ganti 'prajurit' → 'anggota', 'admin' → 'super_admin', dll.
```

**Verifikasi Fase 5 (Final):**
```bash
# 1. TypeScript clean
npx tsc --noEmit

# 2. Unit tests
npm run test -- --run

# 3. Build production
npm run build

# 4. Manual test semua role:
# Login sebagai super_admin → /super-admin/dashboard
# Login sebagai command_level → /command/dashboard (read-only badge visible)
# Login sebagai staff_ops → /staff-ops/dashboard → bisa buat Kalatlap
# Login sebagai staff_pers → /staff-pers/dashboard → bisa kelola cuti
# Login sebagai staff_log → /staff-log/dashboard → bisa lihat inventaris
# Login sebagai unit_leader → /unit-leader/dashboard → bisa buat penugasan
# Login sebagai field_officer → /field-officer/dashboard → bisa submit laporan kemajuan
# Login sebagai anggota → /anggota/dashboard → read-only + bisa ajukan cuti
```

---

## 📋 RINGKASAN PERUBAHAN PER FASE

| Fase | Scope | File Utama yang Diubah |
|------|-------|----------------------|
| 1 | Types & Constants | `src/types/index.ts`, `src/features/shared/lib/rolePermissions.ts` |
| 2 | Database | `supabase/migrations/20260601_002_*.sql` |
| 3 | Routing | `src/app/router.tsx`, `src/app/ProtectedRoute.tsx`, +35 placeholder pages |
| 4 | Auth & Session | `src/features/auth/authStore.ts`, `supabase/migrations/20260601_003_*.sql` |
| 5 | UI & API | Semua dashboard pages baru, API lib baru, Sidebar update |

## ⚠️ PENTING — Jangan Lupa Setelah Semua Fase Selesai

1. **Update seed data** di `supabase/migrations/legacy/20260419120000_seed_test_data.sql` — tambahkan user demo untuk setiap role baru
2. **Update e2e tests** di folder `e2e/` — ganti role lama di test fixtures
3. **Update FEATURES.md dan README.md** — dokumentasikan role baru
4. **Update `create_user_with_pin` RPC** — pastikan validasi role sudah include semua 8 role baru
5. **Test import CSV** di `ImportPersonelModal.tsx` — pastikan kolom `role` di CSV bisa map ke role baru
