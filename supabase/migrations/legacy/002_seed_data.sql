-- ============================================================
-- KARYO OS — Seed Data Migration
-- Sample accounts for development / testing
-- All PINs are: 123456
-- ============================================================

-- Admin
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
VALUES (
  '1000001',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Admin Karyo',
  'admin',
  'Batalyon 1',
  'Letnan Kolonel',
  'Komandan Batalyon'
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

-- Komandan
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
VALUES (
  '2000001',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Budi Santoso',
  'komandan',
  'Batalyon 1',
  'Mayor',
  'Komandan Kompi A'
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

-- Prajurit
INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
VALUES (
  '3000001',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Agus Pratama',
  'prajurit',
  'Batalyon 1',
  'Sersan Dua',
  'Anggota Regu 1'
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
VALUES (
  '3000002',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Hendra Wijaya',
  'prajurit',
  'Batalyon 1',
  'Prajurit Kepala',
  'Anggota Regu 1'
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
VALUES (
  '3000003',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Eko Susanto',
  'prajurit',
  'Batalyon 1',
  'Prajurit Dua',
  'Anggota Regu 2'
)
ON CONFLICT (nrp) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    satuan = EXCLUDED.satuan,
    pangkat = EXCLUDED.pangkat,
    jabatan = EXCLUDED.jabatan,
    updated_at = NOW();

-- Sample announcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.announcements
    WHERE judul = 'Selamat Datang di Karyo OS'
  ) THEN
    INSERT INTO public.announcements (judul, isi, target_role, is_pinned)
    VALUES (
      'Selamat Datang di Karyo OS',
      'Sistem operasional batalyon telah aktif. Semua personel wajib melakukan check-in setiap hari kerja sebelum pukul 07.30 WIB.',
      ARRAY['admin','komandan','prajurit'],
      true
    );
  END IF;
END $$;
