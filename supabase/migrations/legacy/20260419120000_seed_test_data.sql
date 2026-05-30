-- ============================================================
-- KARYO OS — Seed Test Data for E2E Tests
-- Sample accounts for development / testing
-- All PINs are: 123456
-- ============================================================

-- Admin
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '1000001',
  crypt('123456', gen_salt('bf', 10)),
  'Admin Karyo',
  'admin',
  'Batalyon 1',
  'Letnan Kolonel',
  'Komandan Batalyon',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Komandan
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '2000001',
  crypt('123456', gen_salt('bf', 10)),
  'Budi Santoso',
  'komandan',
  'Batalyon 1',
  'Mayor',
  'Komandan Kompi A',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Prajurit 1
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '3000001',
  crypt('123456', gen_salt('bf', 10)),
  'Agus Pratama',
  'prajurit',
  'Batalyon 1',
  'Sersan Dua',
  'Anggota Regu 1',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Prajurit 2
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '3000002',
  crypt('123456', gen_salt('bf', 10)),
  'Hendra Wijaya',
  'prajurit',
  'Batalyon 1',
  'Prajurit Kepala',
  'Anggota Regu 1',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Prajurit 3
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '3000003',
  crypt('123456', gen_salt('bf', 10)),
  'Eko Susanto',
  'prajurit',
  'Batalyon 1',
  'Prajurit Dua',
  'Anggota Regu 2',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Guard
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan, is_active)
VALUES (
  '4000001',
  crypt('123456', gen_salt('bf', 10)),
  'Bambang Sugiarto',
  'guard',
  'Pos Jaga 1',
  'Kopral',
  'Petugas Pos Jaga',
  true
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
