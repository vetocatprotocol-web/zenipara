# INSTRUKSI REFACTOR — Karyo OS
> Untuk: GitHub Copilot Chat / Codespace  
> Baca seluruh file ini sebelum mulai. Kerjakan per-fase secara berurutan.

---

## Konteks Proyek

Aplikasi manajemen satuan militer (React + TypeScript + Supabase).  
Stack: Vite · React 19 · Zustand · Tailwind CSS 4 · Supabase (RPC-only pattern) · Cloudflare Pages.

---

## Target Akhir

### Hierarki Role (5 role)

```
super_admin
  └── admin_satuan      (scoped ke 1 satuan)
        └── komandan    (scoped ke 1 satuan)
              └── prajurit (scoped ke 1 satuan)
              └── guard    (scoped ke 1 satuan)
```

| Role | Akses |
|------|-------|
| `super_admin` | Semua satuan, tambah/nonaktifkan satuan, kelola admin_satuan, settings global |
| `admin_satuan` | Hanya satuan miliknya: kelola user, branding, feature flags, laporan |
| `komandan` | Hanya satuan miliknya: tasks, personnel, gate pass approval, laporan |
| `prajurit` | Hanya data pribadi di satuan miliknya: gate pass, absen, tugas, profil |
| `guard` | Hanya satuan miliknya: scan gate pass, catatan disiplin |

**Aturan penting:** Setiap user punya `satuan_id` (UUID FK ke tabel `satuans`). Semua query dan RLS di-scope berdasarkan `satuan_id` tersebut — tidak ada user lintas satuan kecuali `super_admin`.

---

## FASE 1 — Restrukturisasi Folder

### Target struktur `src/`

```
src/
├── app/
│   ├── router.tsx           # semua route (pindah dari src/router/)
│   ├── App.tsx
│   └── main.tsx
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx    # satu halaman login untuk semua role
│   │   ├── ForceChangePinPage.tsx
│   │   ├── RegisterByLinkPage.tsx
│   │   └── authStore.ts     # pindah dari src/store/
│   ├── super-admin/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── SatuanManagement.tsx  # CRUD satuan + assign admin
│   │   │   ├── GlobalSettings.tsx
│   │   │   └── AuditLog.tsx
│   │   └── superAdminStore.ts
│   ├── admin/               # admin_satuan (scoped)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── SatuanBranding.tsx   # logo, nama, warna satuan
│   │   │   ├── GatePassMonitor.tsx
│   │   │   ├── Logistics.tsx
│   │   │   ├── Announcements.tsx
│   │   │   ├── Attendance.tsx
│   │   │   ├── Apel.tsx
│   │   │   ├── Kegiatan.tsx
│   │   │   ├── ShiftSchedule.tsx
│   │   │   └── Analytics.tsx
│   │   └── adminStore.ts
│   ├── komandan/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TaskManagement.tsx
│   │   │   ├── Personnel.tsx
│   │   │   ├── GatePassApproval.tsx
│   │   │   ├── LaporanOps.tsx
│   │   │   ├── Sprint.tsx
│   │   │   └── Reports.tsx
│   │   └── komandanStore.ts
│   ├── prajurit/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── GatePass.tsx
│   │   │   ├── Attendance.tsx
│   │   │   ├── MyTasks.tsx
│   │   │   ├── LeaveRequest.tsx
│   │   │   ├── Messages.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Apel.tsx
│   │   │   ├── Kegiatan.tsx
│   │   │   └── ScanPosJaga.tsx
│   │   └── prajuritStore.ts
│   ├── guard/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   └── DisciplineNotes.tsx
│   │   └── guardStore.ts
│   └── shared/              # komponen/hooks yang dipakai >1 role
│       ├── components/      # pindah dari src/components/common/ & src/components/ui/
│       ├── hooks/           # pindah dari src/hooks/
│       └── lib/             # pindah dari src/lib/
├── store/
│   ├── uiStore.ts
│   └── featureStore.ts
└── types/
    └── index.ts             # tambah role baru, update SatuanBranding
```

### Yang harus dipindahkan

- `src/router/index.tsx` → `src/app/router.tsx`
- `src/store/authStore.ts` → `src/features/auth/authStore.ts`
- `src/store/adminDashboardStore.ts` → `src/features/admin/adminStore.ts`
- `src/store/komandanDashboardStore.ts` → `src/features/komandan/komandanStore.ts`
- `src/components/common/*` + `src/components/ui/*` → `src/features/shared/components/`
- `src/hooks/*` → `src/features/shared/hooks/`
- `src/lib/*` → `src/features/shared/lib/`
- `src/pages/admin/*` → `src/features/admin/pages/`
- `src/pages/komandan/*` → `src/features/komandan/pages/`
- `src/pages/prajurit/*` → `src/features/prajurit/pages/`
- `src/pages/guard/*` → `src/features/guard/pages/`
- Hapus folder: `src/pages/`, `src/components/`, `src/hooks/`, `src/router/`

---

## FASE 2 — Update Role System

### 2a. Update `src/types/index.ts`

```typescript
// Ganti Role lama
export type Role = 'super_admin' | 'admin_satuan' | 'komandan' | 'prajurit' | 'guard';

// Tambah tipe branding satuan
export interface SatuanBranding {
  logo_url?: string;
  warna_primer?: string;   // hex color
  nama_pendek?: string;    // singkatan untuk header
}

// Update Satuan
export interface Satuan {
  id: string;
  nama: string;
  kode_satuan: string;
  branding?: SatuanBranding;
  is_active: boolean;
  created_by?: string;   // super_admin user id
  created_at: string;
  updated_at: string;
}
```

### 2b. Update `src/features/shared/lib/rolePermissions.ts`

Ganti `KNOWN_ROLES` dan semua mapping:

```typescript
export const KNOWN_ROLES = ['super_admin', 'admin_satuan', 'komandan', 'prajurit', 'guard'] as const;

// Route paths baru
export const ROLE_ROUTE_PATHS = {
  super_admin: {
    dashboard:       '/super-admin/dashboard',
    satuans:         '/super-admin/satuans',
    settings:        '/super-admin/settings',
    audit:           '/super-admin/audit',
  },
  admin_satuan: {
    dashboard:       '/admin/dashboard',
    users:           '/admin/users',
    branding:        '/admin/branding',
    gatePassMonitor: '/admin/gatepass-monitor',
    logistics:       '/admin/logistics',
    announcements:   '/admin/announcements',
    attendance:      '/admin/attendance',
    analytics:       '/admin/analytics',
    apel:            '/admin/apel',
    kegiatan:        '/admin/kegiatan',
    schedule:        '/admin/schedule',
  },
  komandan: {
    dashboard:        '/komandan/dashboard',
    tasks:            '/komandan/tasks',
    personnel:        '/komandan/personnel',
    gatePassApproval: '/komandan/gatepass-approval',
    laporanOps:       '/komandan/laporan-ops',
    sprint:           '/komandan/sprint',
    reports:          '/komandan/reports',
  },
  prajurit: {
    dashboard:  '/prajurit/dashboard',
    gatePass:   '/prajurit/gatepass',
    attendance: '/prajurit/attendance',
    tasks:      '/prajurit/tasks',
    leave:      '/prajurit/leave',
    messages:   '/prajurit/messages',
    profile:    '/prajurit/profile',
    apel:       '/prajurit/apel',
    kegiatan:   '/prajurit/kegiatan',
    scanPos:    '/prajurit/scan-pos',
  },
  guard: {
    dashboard:   '/guard/dashboard',
    discipline:  '/guard/discipline',
  },
} as const;
```

### 2c. Update `ProtectedRoute.tsx`

Tambahkan pengecekan `satuan_id`:

```typescript
// Redirect jika role cocok tapi satuan tidak terdaftar (selain super_admin)
if (userRole !== 'super_admin' && !userSatuanId) {
  return <Navigate to="/error" state={{ code: '403', message: 'Akun belum terdaftar di satuan manapun.' }} replace />;
}
```

---

## FASE 3 — Alur Login Multi-Satuan (Satu Halaman)

### Alur

```
User input NRP + PIN
       ↓
RPC: verify_user_pin(nrp, pin)
       ↓
  Returns: { user_id, role, satuan_id, force_change_pin }
       ↓
  role === 'super_admin' → /super-admin/dashboard
  role === 'admin_satuan' → /admin/dashboard       (scoped satuan_id)
  role === 'komandan'     → /komandan/dashboard    (scoped satuan_id)
  role === 'prajurit'     → /prajurit/dashboard    (scoped satuan_id)
  role === 'guard'        → /guard/dashboard       (scoped satuan_id)
```

**Tidak ada halaman login terpisah per satuan.** URL tetap satu: `/login`.

### Update `verify_user_pin` RPC (Supabase)

RPC sudah ada — tambahkan `satuan_id` ke return value:

```sql
-- Di migration baru: add_satuan_id_to_verify_user_pin.sql
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_nrp TEXT, p_pin TEXT)
RETURNS TABLE (
  user_id         UUID,
  user_role       TEXT,
  force_change_pin BOOLEAN,
  satuan_id       UUID    -- TAMBAH INI
) ...
```

### Update `KaryoSession` di types

```typescript
export interface KaryoSession {
  user_id: string;
  role: Role;
  satuan_id: string | null;   // null hanya untuk super_admin
  expires_at: string;
}
```

---

## FASE 4 — Multi-Satuan Scoping

### Prinsip

Setiap query/RPC dari `admin_satuan`, `komandan`, `prajurit`, `guard` harus menyertakan `satuan_id` dari session. Super admin boleh mengirim `satuan_id = null` untuk query lintas satuan.

### Update header fetch di `supabase.ts`

```typescript
// Tambah header satuan_id
headers.set('x-karyo-satuan-id', session.satuan_id ?? '');
```

### Update `set_session_context` RPC

```sql
-- Tambah parameter p_satuan_id
CREATE OR REPLACE FUNCTION public.set_session_context(
  p_user_id  UUID,
  p_role     TEXT,
  p_satuan_id UUID DEFAULT NULL  -- TAMBAH INI
) ...
-- Simpan ke session config
PERFORM set_config('karyo.satuan_id', COALESCE(p_satuan_id::TEXT, ''), true);
```

### Helper function di DB

```sql
CREATE OR REPLACE FUNCTION public.current_karyo_satuan_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('karyo.satuan_id', true), '')::UUID
$$;
```

### Pola RLS per tabel (contoh untuk `tasks`)

```sql
-- Admin satuan hanya lihat tasks satuannya
CREATE POLICY "tasks_scoped_by_satuan" ON public.tasks
  FOR ALL TO anon
  USING (
    current_karyo_role() = 'super_admin'
    OR satuan_id = current_karyo_satuan_id()
  );
```

---

## FASE 5 — Branding Per Satuan

### Tabel baru (migration)

```sql
-- Tambahkan kolom branding ke satuans (jika belum ada)
ALTER TABLE public.satuans
  ADD COLUMN IF NOT EXISTS warna_primer  TEXT DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS nama_pendek   TEXT,
  ADD COLUMN IF NOT EXISTS login_bg_url  TEXT;
```

### Cara pakai di frontend

Buat hook `useSatuanBranding()` di `src/features/shared/hooks/`:

```typescript
// Load branding satuan dari store setelah login
// Terapkan CSS variable ke :root
document.documentElement.style.setProperty('--color-primary', branding.warna_primer);
```

`admin_satuan` punya halaman `/admin/branding` untuk edit logo, warna, dan nama pendek satuannya.

---

## FASE 6 — Deployment Cloudflare Pages

### `wrangler.toml` (buat di root)

```toml
name = "karyo-os"
compatibility_date = "2024-01-01"

[env.production]
# Env vars di-set via Cloudflare Dashboard, bukan di sini
```

### `public/_redirects` (buat file baru)

```
/*    /index.html   200
```

Ini wajib agar React Router (HashRouter atau BrowserRouter) bisa handle refresh.

### Jika ganti ke BrowserRouter (opsional tapi disarankan)

Ganti `createHashRouter` → `createBrowserRouter` di `src/app/router.tsx`.  
`_redirects` di atas sudah menangani SPA routing.

### GitHub Actions untuk deploy ke Cloudflare Pages

Buat `.github/workflows/deploy-cf-pages.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: pages deploy dist --project-name=karyo-os
```

### Secrets yang dibutuhkan di GitHub

| Secret | Dari mana |
|--------|-----------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `CF_API_TOKEN` | Cloudflare → My Profile → API Tokens |
| `CF_ACCOUNT_ID` | Cloudflare Dashboard → kanan bawah |

---

## FASE 7 — Cleanup Wajib

### Hapus file/folder yang tidak lagi dipakai

```bash
# Setelah semua fase selesai dan build berhasil:
rm -rf src/pages/
rm -rf src/components/
rm -rf src/hooks/
rm -rf src/router/
rm src/store/adminDashboardStore.ts
rm src/store/komandanDashboardStore.ts
rm src/store/posJagaStore.ts  # pindah ke features/guard/
rm .env.production             # WAJIB — credentials tidak boleh di repo
```

### Tambahkan ke `.gitignore`

```
.env.production
.env.local
.env.*.local
```

### Hapus role yang tidak dipakai lagi

Role `staf` dihapus dari sistem. Semua halaman `/staf/*` dan store `staf` dihapus.  
Fungsionalitas staf (leave review, laporan ops) dialihkan ke `admin_satuan`.

---

## Urutan Pengerjaan yang Disarankan

1. **Buat branch baru** `refactor/repo-restructure` — jangan di `main`.
2. Kerjakan Fase 1 (pindah file) → pastikan build tidak rusak.
3. Kerjakan Fase 2 (update types & role).
4. Kerjakan Fase 3 (alur login) → test manual login semua role.
5. Kerjakan Fase 4 (scoping multi-satuan di DB) → 1 migration baru.
6. Kerjakan Fase 5 (branding).
7. Kerjakan Fase 6 (Cloudflare deployment config).
8. Kerjakan Fase 7 (cleanup).
9. Merge ke `main` setelah semua test hijau.

---

## Catatan untuk Copilot

- Jangan hapus file lama sampai import di file baru sudah benar dan `npm run build` sukses.
- Setiap kali pindah file, update semua path import yang mengacu ke file tersebut.
- Gunakan `npm run type-check` setelah setiap fase untuk verifikasi.
- Jangan menyentuh file migration yang sudah ada — buat migration baru saja.
- Untuk setiap RPC yang ditambahkan, ikuti pola yang ada di `src/features/shared/lib/api/`.
