-- ============================================================
-- KARYO OS — Ensure demo users are login-ready
--
-- Goals:
-- 1) Keep role constraint aligned with app roles (includes `staf`).
-- 2) Guarantee demo users exist with known credentials.
-- 3) Ensure demo users can login immediately (no forced PIN rotation).
-- ============================================================

-- Normalize role values before reapplying constraint.
UPDATE public.users
SET role = public.canonicalize_role(role)
WHERE role IS NOT NULL
  AND role <> public.canonicalize_role(role)
  AND public.canonicalize_role(role) IN ('admin', 'komandan', 'staf', 'guard', 'prajurit');

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'komandan', 'prajurit', 'guard', 'staf'));

INSERT INTO public.users (
  nrp,
  pin_hash,
  nama,
  role,
  level_komando,
  satuan,
  pangkat,
  jabatan,
  is_active,
  force_change_pin,
  login_attempts,
  locked_until,
  is_online
)
VALUES
  (
    '1000001',
    extensions.crypt('123456', extensions.gen_salt('bf', 10)),
    'Admin Karyo',
    'admin',
    NULL,
    'Batalyon 1',
    'Letnan Kolonel',
    'Komandan Batalyon',
    TRUE,
    FALSE,
    0,
    NULL,
    FALSE
  ),
  (
    '2000001',
    extensions.crypt('123456', extensions.gen_salt('bf', 10)),
    'Budi Santoso',
    'komandan',
    'KOMPI'::command_level,
    'Batalyon 1',
    'Mayor',
    'Komandan Kompi A',
    TRUE,
    FALSE,
    0,
    NULL,
    FALSE
  ),
  (
    '3000001',
    extensions.crypt('123456', extensions.gen_salt('bf', 10)),
    'Agus Pratama',
    'prajurit',
    NULL,
    'Batalyon 1',
    'Sersan Dua',
    'Anggota Regu 1',
    TRUE,
    FALSE,
    0,
    NULL,
    FALSE
  ),
  (
    '4000001',
    extensions.crypt('123456', extensions.gen_salt('bf', 10)),
    'Deni Ramadhan',
    'guard',
    NULL,
    'Batalyon 1',
    'Sersan Satu',
    'Pos Jaga Utama',
    TRUE,
    FALSE,
    0,
    NULL,
    FALSE
  ),
  (
    '5000001',
    extensions.crypt('123456', extensions.gen_salt('bf', 10)),
    'Siti Rahma',
    'staf',
    NULL,
    'Batalyon 1',
    'Pembina',
    'Staf Administrasi',
    TRUE,
    FALSE,
    0,
    NULL,
    FALSE
  )
ON CONFLICT (nrp) DO UPDATE
SET
  pin_hash = EXCLUDED.pin_hash,
  nama = EXCLUDED.nama,
  role = EXCLUDED.role,
  level_komando = EXCLUDED.level_komando,
  satuan = EXCLUDED.satuan,
  pangkat = EXCLUDED.pangkat,
  jabatan = EXCLUDED.jabatan,
  is_active = TRUE,
  force_change_pin = FALSE,
  login_attempts = 0,
  locked_until = NULL,
  is_online = FALSE,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';