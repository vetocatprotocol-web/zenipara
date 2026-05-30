-- ============================================================
-- FIX: api_get_users sort direction honors p_ascending
-- Regression source: v15 optimization migration used fixed ASC
-- ============================================================

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
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Admin: can see all users, optionally filter by role/satuan
  IF p_role = 'admin' THEN
    IF p_ascending THEN
      RETURN QUERY
      SELECT u.* FROM public.users u
      WHERE (p_role_filter IS NULL OR u.role = p_role_filter)
        AND (p_satuan_filter IS NULL OR u.satuan = p_satuan_filter)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
      ORDER BY CASE p_order_by
        WHEN 'nrp' THEN u.nrp
        WHEN 'created_at' THEN CAST(u.created_at AS TEXT)
        ELSE u.nama
      END ASC;
    ELSE
      RETURN QUERY
      SELECT u.* FROM public.users u
      WHERE (p_role_filter IS NULL OR u.role = p_role_filter)
        AND (p_satuan_filter IS NULL OR u.satuan = p_satuan_filter)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
      ORDER BY CASE p_order_by
        WHEN 'nrp' THEN u.nrp
        WHEN 'created_at' THEN CAST(u.created_at AS TEXT)
        ELSE u.nama
      END DESC;
    END IF;

  -- Komandan: can see users in their satuan
  ELSIF p_role = 'komandan' THEN
    IF p_ascending THEN
      RETURN QUERY
      SELECT u.* FROM public.users u
      WHERE u.satuan = (SELECT satuan FROM public.users WHERE id = p_user_id)
        AND (p_role_filter IS NULL OR u.role = p_role_filter)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
      ORDER BY CASE p_order_by
        WHEN 'nrp' THEN u.nrp
        WHEN 'created_at' THEN CAST(u.created_at AS TEXT)
        ELSE u.nama
      END ASC;
    ELSE
      RETURN QUERY
      SELECT u.* FROM public.users u
      WHERE u.satuan = (SELECT satuan FROM public.users WHERE id = p_user_id)
        AND (p_role_filter IS NULL OR u.role = p_role_filter)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
      ORDER BY CASE p_order_by
        WHEN 'nrp' THEN u.nrp
        WHEN 'created_at' THEN CAST(u.created_at AS TEXT)
        ELSE u.nama
      END DESC;
    END IF;

  -- Others: can only see themselves
  ELSE
    RETURN QUERY
    SELECT u.* FROM public.users u
    WHERE u.id = p_user_id;
  END IF;
END;
$$;
