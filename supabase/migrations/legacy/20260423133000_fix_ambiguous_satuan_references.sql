-- ============================================================
-- Fix ambiguous `satuan` references in dashboard/user RPCs.
-- This hardens PL/pgSQL queries that previously used unqualified
-- `SELECT satuan FROM public.users ...` subqueries and can fail with:
--   column reference "satuan" is ambiguous
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
  ELSIF p_role = 'komandan' THEN
    IF p_ascending THEN
      RETURN QUERY
      SELECT u.* FROM public.users u
      WHERE u.satuan = (
        SELECT u_self.satuan
        FROM public.users u_self
        WHERE u_self.id = p_user_id
      )
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
      WHERE u.satuan = (
        SELECT u_self.satuan
        FROM public.users u_self
        WHERE u_self.id = p_user_id
      )
        AND (p_role_filter IS NULL OR u.role = p_role_filter)
        AND (p_is_active IS NULL OR u.is_active = p_is_active)
      ORDER BY CASE p_order_by
        WHEN 'nrp' THEN u.nrp
        WHEN 'created_at' THEN CAST(u.created_at AS TEXT)
        ELSE u.nama
      END DESC;
    END IF;
  ELSE
    RETURN QUERY
    SELECT u.* FROM public.users u
    WHERE u.id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_users_page(
  p_user_id       UUID,
  p_role          TEXT,
  p_role_filter   TEXT DEFAULT NULL,
  p_satuan_filter TEXT DEFAULT NULL,
  p_is_active     BOOLEAN DEFAULT NULL,
  p_order_by      TEXT DEFAULT 'nama',
  p_ascending     BOOLEAN DEFAULT TRUE,
  p_search        TEXT DEFAULT NULL,
  p_limit         INTEGER DEFAULT 50,
  p_offset        INTEGER DEFAULT 0
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
  v_dir TEXT;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_order := CASE WHEN p_order_by IN ('nama', 'created_at', 'nrp') THEN p_order_by ELSE 'nama' END;
  v_dir := CASE WHEN p_ascending THEN 'ASC' ELSE 'DESC' END;

  IF p_role = 'admin' THEN
    RETURN QUERY EXECUTE format(
      'SELECT '
      'id,nrp,nama,role,pangkat,jabatan,satuan,foto_url,is_active,is_online,login_attempts,locked_until,last_login,created_at,updated_at,tempat_lahir,tanggal_lahir,no_telepon,alamat,tanggal_masuk_dinas,pendidikan_terakhir,agama,status_pernikahan,golongan_darah,nomor_ktp,kontak_darurat_nama,kontak_darurat_telp,catatan_khusus '
      'FROM public.users u '
      'WHERE ($1 IS NULL OR u.role = $1) '
      'AND ($2 IS NULL OR u.satuan = $2) '
      'AND ($3 IS NULL OR u.is_active = $3) '
      'AND ($4 IS NULL OR u.nama ILIKE (''%%'' || $4 || ''%%'') OR u.nrp ILIKE (''%%'' || $4 || ''%%'')) '
      'ORDER BY %I %s '
      'LIMIT $5 OFFSET $6',
      v_order,
      v_dir
    ) USING p_role_filter, p_satuan_filter, p_is_active, v_search, v_limit, v_offset;
  ELSIF p_role = 'komandan' THEN
    RETURN QUERY EXECUTE format(
      'SELECT '
      'id,nrp,nama,role,pangkat,jabatan,satuan,foto_url,is_active,is_online,login_attempts,locked_until,last_login,created_at,updated_at,tempat_lahir,tanggal_lahir,no_telepon,alamat,tanggal_masuk_dinas,pendidikan_terakhir,agama,status_pernikahan,golongan_darah,nomor_ktp,kontak_darurat_nama,kontak_darurat_telp,catatan_khusus '
      'FROM public.users u '
      'WHERE '
      '('
      '  ((SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = $1) IS NOT NULL AND u.satuan_id = (SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = $1)) '
      '  OR ((SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = $1) IS NULL AND u.satuan = (SELECT u_self.satuan FROM public.users u_self WHERE u_self.id = $1)) '
      ') '
      'AND ($2 IS NULL OR u.role = $2) '
      'AND ($3 IS NULL OR u.is_active = $3) '
      'AND ($4 IS NULL OR u.nama ILIKE (''%%'' || $4 || ''%%'') OR u.nrp ILIKE (''%%'' || $4 || ''%%'')) '
      'ORDER BY %I %s '
      'LIMIT $5 OFFSET $6',
      v_order,
      v_dir
    ) USING p_user_id, p_role_filter, p_is_active, v_search, v_limit, v_offset;
  ELSE
    RETURN QUERY
    SELECT
      u.id,u.nrp,u.nama,u.role,u.pangkat,u.jabatan,u.satuan,u.foto_url,u.is_active,u.is_online,u.login_attempts,u.locked_until,u.last_login,u.created_at,u.updated_at,
      u.tempat_lahir,u.tanggal_lahir,u.no_telepon,u.alamat,u.tanggal_masuk_dinas,u.pendidikan_terakhir,u.agama,u.status_pernikahan,u.golongan_darah,
      u.nomor_ktp,u.kontak_darurat_nama,u.kontak_darurat_telp,u.catatan_khusus
    FROM public.users u
    WHERE u.id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_count_users_filtered(
  p_user_id       UUID,
  p_role          TEXT,
  p_role_filter   TEXT DEFAULT NULL,
  p_satuan_filter TEXT DEFAULT NULL,
  p_is_active     BOOLEAN DEFAULT NULL,
  p_search        TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INTEGER := 0;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RETURN 0;
  END IF;

  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_role = 'admin' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.users u
    WHERE (p_role_filter IS NULL OR u.role = p_role_filter)
      AND (
        p_satuan_filter IS NULL
        OR u.satuan = p_satuan_filter
        OR EXISTS (
          SELECT 1 FROM public.satuans s
          WHERE s.id = u.satuan_id AND s.nama = p_satuan_filter
        )
      )
      AND (p_is_active IS NULL OR u.is_active = p_is_active)
      AND (
        v_search IS NULL
        OR u.nama ILIKE ('%' || v_search || '%')
        OR u.nrp ILIKE ('%' || v_search || '%')
      );

    RETURN COALESCE(v_count, 0);
  ELSIF p_role = 'komandan' THEN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.users u
    WHERE (
      (
        (SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = p_user_id) IS NOT NULL
        AND u.satuan_id = (SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = p_user_id)
      )
      OR (
        (SELECT u_self.satuan_id FROM public.users u_self WHERE u_self.id = p_user_id) IS NULL
        AND u.satuan = (SELECT u_self.satuan FROM public.users u_self WHERE u_self.id = p_user_id)
      )
    )
      AND (p_role_filter IS NULL OR u.role = p_role_filter)
      AND (p_is_active IS NULL OR u.is_active = p_is_active)
      AND (
        v_search IS NULL
        OR u.nama ILIKE ('%' || v_search || '%')
        OR u.nrp ILIKE ('%' || v_search || '%')
      );

    RETURN COALESCE(v_count, 0);
  ELSE
    RETURN 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_komandan_dashboard_stats(
  p_satuan TEXT
)
RETURNS TABLE (
  online_count INTEGER,
  total_personel INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan_id UUID;
  v_scope_satuan_text TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, u.satuan_id, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan_id, v_scope_satuan_text
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: user inactive or missing';
  END IF;

  IF v_role NOT IN ('komandan', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: hanya komandan/admin yang dapat melihat statistik komando';
  END IF;

  IF v_scope_satuan_id IS NULL THEN
    v_scope_satuan_text := COALESCE(v_scope_satuan_text, NULLIF(BTRIM(p_satuan), ''));
  END IF;

  IF v_scope_satuan_id IS NULL AND v_scope_satuan_text IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE u.is_active = TRUE
        AND u.is_online = TRUE
        AND (
          (v_scope_satuan_id IS NOT NULL AND u.satuan_id = v_scope_satuan_id)
          OR (v_scope_satuan_id IS NULL AND NULLIF(BTRIM(u.satuan), '') = v_scope_satuan_text)
        )
    )::INTEGER AS online_count,
    COUNT(*) FILTER (
      WHERE u.is_active = TRUE
        AND (
          (v_scope_satuan_id IS NOT NULL AND u.satuan_id = v_scope_satuan_id)
          OR (v_scope_satuan_id IS NULL AND NULLIF(BTRIM(u.satuan), '') = v_scope_satuan_text)
        )
    )::INTEGER AS total_personel
  FROM public.users u;
END;
$$;
