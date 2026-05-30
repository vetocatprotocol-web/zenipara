-- ============================================================
-- KARYO OS — Security: Fix pin_hash exposure in API functions
--
-- Problems fixed:
-- 1) api_get_users   returned SETOF public.users → includes pin_hash
-- 2) get_user_by_id  returned SETOF public.users → includes pin_hash
-- 3) fetchUsersDirect (TypeScript) did select('*') → pin_hash in response
-- 4) api_get_users had no user_management feature-flag check
--
-- Strategy:
-- - Change RETURNS SETOF public.users to RETURNS TABLE(...) with an
--   explicit, safe column list that excludes pin_hash.
-- - Add column-level REVOKE on pin_hash as defence-in-depth for any
--   future direct SELECT queries from client roles.
-- - Add is_feature_enabled('user_management') guard to api_get_users.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Column-level protection: deny direct reads of pin_hash
--    by client DB roles.
--    (SECURITY DEFINER functions run as owner and are unaffected.)
-- ------------------------------------------------------------
REVOKE SELECT (pin_hash) ON public.users FROM anon;
REVOKE SELECT (pin_hash) ON public.users FROM authenticated;

-- ------------------------------------------------------------
-- 2. api_get_users — return explicit columns (no pin_hash)
--    Changing return type requires DROP then CREATE.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.api_get_users(BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.api_get_users(
  p_ascending      BOOLEAN DEFAULT TRUE,
  p_is_active      BOOLEAN DEFAULT NULL,
  p_order_by       TEXT    DEFAULT 'nama',
  p_role           TEXT    DEFAULT NULL,
  p_role_filter    TEXT    DEFAULT NULL,
  p_satuan_filter  TEXT    DEFAULT NULL,
  p_user_id        UUID    DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  nrp                  TEXT,
  nama                 TEXT,
  role                 TEXT,
  pangkat              TEXT,
  jabatan              TEXT,
  satuan               TEXT,
  foto_url             TEXT,
  is_active            BOOLEAN,
  is_online            BOOLEAN,
  login_attempts       INTEGER,
  locked_until         TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  tempat_lahir         TEXT,
  tanggal_lahir        DATE,
  no_telepon           TEXT,
  alamat               TEXT,
  tanggal_masuk_dinas  DATE,
  pendidikan_terakhir  TEXT,
  agama                TEXT,
  status_pernikahan    TEXT,
  golongan_darah       TEXT,
  nomor_ktp            TEXT,
  kontak_darurat_nama  TEXT,
  kontak_darurat_telp  TEXT,
  catatan_khusus       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order TEXT;
  v_dir   TEXT;
  -- safe column list shared by every branch (no pin_hash)
  v_cols  TEXT := 'id,nrp,nama,role,pangkat,jabatan,satuan,foto_url,'
               || 'is_active,is_online,login_attempts,locked_until,last_login,'
               || 'created_at,updated_at,tempat_lahir,tanggal_lahir,no_telepon,'
               || 'alamat,tanggal_masuk_dinas,pendidikan_terakhir,agama,'
               || 'status_pernikahan,golongan_darah,nomor_ktp,'
               || 'kontak_darurat_nama,kontak_darurat_telp,catatan_khusus';
BEGIN
  -- Feature flag guard
  IF NOT is_feature_enabled('user_management') THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_order := CASE WHEN p_order_by IN ('nama', 'created_at', 'nrp') THEN p_order_by ELSE 'nama' END;
  v_dir   := CASE WHEN p_ascending THEN 'ASC' ELSE 'DESC' END;

  IF p_role = 'admin' THEN
    RETURN QUERY EXECUTE format(
      'SELECT %s FROM public.users '
      'WHERE ($1 IS NULL OR role = $1) AND ($2 IS NULL OR satuan = $2) AND ($3 IS NULL OR is_active = $3) '
      'ORDER BY %I %s',
      v_cols, v_order, v_dir
    ) USING p_role_filter, p_satuan_filter, p_is_active;

  ELSIF p_role = 'komandan' THEN
    RETURN QUERY EXECUTE format(
      'SELECT %s FROM public.users '
      'WHERE satuan = (SELECT satuan FROM public.users WHERE id = $1) '
      'AND ($2 IS NULL OR role = $2) AND ($3 IS NULL OR is_active = $3) '
      'ORDER BY %I %s',
      v_cols, v_order, v_dir
    ) USING p_user_id, p_role_filter, p_is_active;

  ELSE
    -- Prajurit / guard: own row only
    RETURN QUERY EXECUTE format('SELECT %s FROM public.users WHERE id = $1', v_cols)
      USING p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_users(BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_users(BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3. get_user_by_id — return explicit columns (no pin_hash)
--    Used by authStore on login and session restore.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_by_id(UUID);

CREATE OR REPLACE FUNCTION public.get_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id                   UUID,
  nrp                  TEXT,
  nama                 TEXT,
  role                 TEXT,
  pangkat              TEXT,
  jabatan              TEXT,
  satuan               TEXT,
  foto_url             TEXT,
  is_active            BOOLEAN,
  is_online            BOOLEAN,
  login_attempts       INTEGER,
  locked_until         TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  tempat_lahir         TEXT,
  tanggal_lahir        DATE,
  no_telepon           TEXT,
  alamat               TEXT,
  tanggal_masuk_dinas  DATE,
  pendidikan_terakhir  TEXT,
  agama                TEXT,
  status_pernikahan    TEXT,
  golongan_darah       TEXT,
  nomor_ktp            TEXT,
  kontak_darurat_nama  TEXT,
  kontak_darurat_telp  TEXT,
  catatan_khusus       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id, u.nrp, u.nama, u.role, u.pangkat, u.jabatan, u.satuan, u.foto_url,
    u.is_active, u.is_online, u.login_attempts, u.locked_until, u.last_login,
    u.created_at, u.updated_at, u.tempat_lahir, u.tanggal_lahir, u.no_telepon,
    u.alamat, u.tanggal_masuk_dinas, u.pendidikan_terakhir, u.agama,
    u.status_pernikahan, u.golongan_darah, u.nomor_ktp,
    u.kontak_darurat_nama, u.kontak_darurat_telp, u.catatan_khusus
  FROM public.users u
  WHERE u.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
