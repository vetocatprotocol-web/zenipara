-- ============================================================
-- KARYO OS — Migration 010: Extended User Profile
-- Menambahkan kolom informasi detail personel pada tabel users.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tempat_lahir        TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir       DATE,
  ADD COLUMN IF NOT EXISTS no_telepon          TEXT,
  ADD COLUMN IF NOT EXISTS alamat              TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_masuk_dinas DATE,
  ADD COLUMN IF NOT EXISTS pendidikan_terakhir TEXT,
  ADD COLUMN IF NOT EXISTS agama               TEXT,
  ADD COLUMN IF NOT EXISTS status_pernikahan   TEXT
                             CHECK (status_pernikahan IN ('lajang', 'menikah', 'cerai', 'duda', 'janda')),
  ADD COLUMN IF NOT EXISTS golongan_darah      TEXT
                             CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
  ADD COLUMN IF NOT EXISTS nomor_ktp           TEXT,
  ADD COLUMN IF NOT EXISTS kontak_darurat_nama TEXT,
  ADD COLUMN IF NOT EXISTS kontak_darurat_telp TEXT,
  ADD COLUMN IF NOT EXISTS catatan_khusus      TEXT;

-- ============================================================
-- RPC: update_own_profile
-- Prajurit hanya boleh mengubah field terbatas milik diri sendiri.
-- Admin menggunakan patchUser (direct update) dengan policy admin_all.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id            UUID,
  p_no_telepon         TEXT DEFAULT NULL,
  p_alamat             TEXT DEFAULT NULL,
  p_kontak_darurat_nama TEXT DEFAULT NULL,
  p_kontak_darurat_telp TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Pastikan user hanya mengubah data miliknya sendiri
  IF p_user_id <> public.current_karyo_user_id() THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah profil pengguna lain';
  END IF;

  UPDATE public.users
  SET
    no_telepon           = COALESCE(p_no_telepon, no_telepon),
    alamat               = COALESCE(p_alamat, alamat),
    kontak_darurat_nama  = COALESCE(p_kontak_darurat_nama, kontak_darurat_nama),
    kontak_darurat_telp  = COALESCE(p_kontak_darurat_telp, kontak_darurat_telp),
    updated_at           = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- RPC: get_user_detail
-- Mengembalikan satu user dengan semua kolom profil.
-- Admin mendapat semua kolom; komandan mendapat kolom tanpa
-- nomor_ktp dan catatan_khusus; prajurit hanya data diri sendiri.
-- Fungsi ini SECURITY DEFINER sehingga bisa bypass RLS untuk
-- membaca kolom yang tidak tersedia via SELECT langsung.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_detail(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role    TEXT := public.current_karyo_role();
  v_self_id UUID := public.current_karyo_user_id();
  v_user    public.users%ROWTYPE;
  v_result  JSONB;
BEGIN
  -- Ambil data user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan';
  END IF;

  -- Validasi akses
  IF v_role = 'prajurit' AND v_user.id <> v_self_id THEN
    RAISE EXCEPTION 'Tidak diizinkan melihat profil pengguna lain';
  END IF;

  IF v_role = 'komandan' THEN
    -- Komandan hanya bisa melihat personel di satuan yang sama
    IF v_user.satuan <> (SELECT satuan FROM public.users WHERE id = v_self_id) THEN
      RAISE EXCEPTION 'Tidak diizinkan melihat personel satuan lain';
    END IF;
  END IF;

  -- Bangun JSON sesuai role
  v_result := jsonb_build_object(
    'id',                  v_user.id,
    'nrp',                 v_user.nrp,
    'nama',                v_user.nama,
    'role',                v_user.role,
    'pangkat',             v_user.pangkat,
    'jabatan',             v_user.jabatan,
    'satuan',              v_user.satuan,
    'foto_url',            v_user.foto_url,
    'is_active',           v_user.is_active,
    'is_online',           v_user.is_online,
    'login_attempts',      v_user.login_attempts,
    'locked_until',        v_user.locked_until,
    'last_login',          v_user.last_login,
    'created_at',          v_user.created_at,
    'updated_at',          v_user.updated_at,
    'tempat_lahir',        v_user.tempat_lahir,
    'tanggal_lahir',       v_user.tanggal_lahir,
    'no_telepon',          v_user.no_telepon,
    'alamat',              v_user.alamat,
    'tanggal_masuk_dinas', v_user.tanggal_masuk_dinas,
    'pendidikan_terakhir', v_user.pendidikan_terakhir,
    'agama',               v_user.agama,
    'status_pernikahan',   v_user.status_pernikahan,
    'golongan_darah',      v_user.golongan_darah,
    'kontak_darurat_nama', v_user.kontak_darurat_nama,
    'kontak_darurat_telp', v_user.kontak_darurat_telp,
    -- Field sensitif hanya untuk admin
    'nomor_ktp',           CASE WHEN v_role = 'admin' THEN v_user.nomor_ktp ELSE NULL END,
    'catatan_khusus',      CASE WHEN v_role = 'admin' THEN v_user.catatan_khusus ELSE NULL END
  );

  RETURN v_result;
END;
$$;
