-- ============================================================
-- KARYO OS — Phase 2: Multi-Satuan RPC dual support
--
-- Update the most frequently used SECURITY DEFINER RPCs to prefer
-- `satuan_id` while keeping legacy `satuan` text as fallback.
-- ============================================================

-- ============================================================
-- Generic helpers for filtering
-- ============================================================
CREATE OR REPLACE FUNCTION public.matches_current_satuan(
  p_satuan_id UUID DEFAULT NULL,
  p_satuan_text TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_satuan_id UUID := public.current_karyo_satuan_id();
  v_current_satuan_text TEXT := public.current_karyo_satuan();
BEGIN
  IF public.current_karyo_role() = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_current_satuan_id IS NOT NULL AND p_satuan_id IS NOT NULL THEN
    RETURN p_satuan_id = v_current_satuan_id;
  END IF;

  IF v_current_satuan_text IS NOT NULL AND p_satuan_text IS NOT NULL THEN
    RETURN BTRIM(p_satuan_text) = BTRIM(v_current_satuan_text);
  END IF;

  RETURN p_satuan_id IS NULL AND p_satuan_text IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.matches_current_satuan(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matches_current_satuan(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.matches_current_satuan(UUID, TEXT) TO authenticated;

-- ============================================================
-- USERS RPCs
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_users(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.api_get_users(
  p_user_id   UUID,
  p_role      TEXT,
  p_role_filter    TEXT    DEFAULT NULL,
  p_satuan_filter  TEXT    DEFAULT NULL,
  p_is_active      BOOLEAN DEFAULT NULL,
  p_order_by       TEXT    DEFAULT 'nama',
  p_ascending      BOOLEAN DEFAULT TRUE
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order TEXT;
  v_dir   TEXT;
BEGIN
  v_order := CASE WHEN p_order_by IN ('nama', 'created_at', 'nrp') THEN p_order_by ELSE 'nama' END;
  v_dir   := CASE WHEN p_ascending THEN 'ASC' ELSE 'DESC' END;

  IF p_role = 'admin' THEN
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.users WHERE ($1 IS NULL OR role = $1) AND ($2 IS NULL OR satuan = $2) AND ($3 IS NULL OR is_active = $3) ORDER BY %I %s',
      v_order, v_dir
    ) USING p_role_filter, p_satuan_filter, p_is_active;

  ELSIF p_role = 'komandan' THEN
    RETURN QUERY EXECUTE format(
      'SELECT u.* FROM public.users u WHERE u.satuan = (SELECT satuan FROM public.users WHERE id = $1) AND ($2 IS NULL OR u.role = $2) AND ($3 IS NULL OR u.is_active = $3) ORDER BY u.%I %s',
      v_order, v_dir
    ) USING p_user_id, p_role_filter, p_is_active;

  ELSE
    RETURN QUERY SELECT * FROM public.users WHERE id = p_user_id;
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
      'FROM public.users '
      'WHERE ($1 IS NULL OR role = $1) '
      'AND ($2 IS NULL OR satuan = $2) '
      'AND ($3 IS NULL OR is_active = $3) '
      'AND ($4 IS NULL OR nama ILIKE (''%%'' || $4 || ''%%'') OR nrp ILIKE (''%%'' || $4 || ''%%'')) '
      'ORDER BY %I %s '
      'LIMIT $5 OFFSET $6',
      v_order,
      v_dir
    ) USING p_role_filter, p_satuan_filter, p_is_active, v_search, v_limit, v_offset;
  ELSIF p_role = 'komandan' THEN
    RETURN QUERY EXECUTE format(
      'SELECT '
      'id,nrp,nama,role,pangkat,jabatan,satuan,foto_url,is_active,is_online,login_attempts,locked_until,last_login,created_at,updated_at,tempat_lahir,tanggal_lahir,no_telepon,alamat,tanggal_masuk_dinas,pendidikan_terakhir,agama,status_pernikahan,golongan_darah,nomor_ktp,kontak_darurat_nama,kontak_darurat_telp,catatan_khusus '
      'FROM public.users '
      'WHERE '
      '((SELECT satuan_id FROM public.users WHERE id = $1) IS NOT NULL AND satuan_id = (SELECT satuan_id FROM public.users WHERE id = $1)) '
      'OR ((SELECT satuan_id FROM public.users WHERE id = $1) IS NULL AND satuan = (SELECT satuan FROM public.users WHERE id = $1)) '
      'AND ($2 IS NULL OR role = $2) '
      'AND ($3 IS NULL OR is_active = $3) '
      'AND ($4 IS NULL OR nama ILIKE (''%%'' || $4 || ''%%'') OR nrp ILIKE (''%%'' || $4 || ''%%'')) '
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

DROP FUNCTION IF EXISTS public.api_count_users_filtered(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
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
      (SELECT satuan_id FROM public.users WHERE id = p_user_id) IS NOT NULL
      AND u.satuan_id = (SELECT satuan_id FROM public.users WHERE id = p_user_id)
    )
    OR (
      (SELECT satuan_id FROM public.users WHERE id = p_user_id) IS NULL
      AND u.satuan = (SELECT satuan FROM public.users WHERE id = p_user_id)
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

-- ============================================================
-- TASKS
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_tasks(UUID, TEXT, UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.api_get_tasks(
  p_user_id    UUID,
  p_role       TEXT,
  p_assigned_to UUID   DEFAULT NULL,
  p_assigned_by UUID   DEFAULT NULL,
  p_status      TEXT   DEFAULT NULL,
  p_satuan      TEXT   DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  judul        TEXT,
  deskripsi    TEXT,
  assigned_to  UUID,
  assigned_by  UUID,
  deadline     TIMESTAMPTZ,
  status       TEXT,
  prioritas    INTEGER,
  satuan       TEXT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  assignee     JSON,
  assigner     JSON,
  report_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('task_management') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.judul,
    t.deskripsi,
    t.assigned_to,
    t.assigned_by,
    t.deadline,
    t.status,
    t.prioritas,
    t.satuan,
    t.created_at,
    t.updated_at,
    CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'nama', a.nama, 'nrp', a.nrp, 'pangkat', a.pangkat, 'satuan', a.satuan) ELSE NULL END,
    CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'nama', b.nama, 'nrp', b.nrp, 'pangkat', b.pangkat, 'satuan', b.satuan) ELSE NULL END,
    COALESCE((SELECT COUNT(*) FROM public.task_reports tr WHERE tr.task_id = t.id), 0)
  FROM public.tasks t
  LEFT JOIN public.users a ON a.id = t.assigned_to
  LEFT JOIN public.users b ON b.id = t.assigned_by
  WHERE (
      p_role = 'admin'
      OR (
        p_role = 'komandan'
        AND public.matches_current_satuan(t.satuan_id, t.satuan)
      )
      OR (
        p_role = 'prajurit'
        AND t.assigned_to = p_user_id
      )
    )
    AND (p_assigned_to IS NULL OR t.assigned_to = p_assigned_to)
    AND (p_assigned_by IS NULL OR t.assigned_by = p_assigned_by)
    AND (p_status IS NULL OR t.status = p_status)
    AND (
      p_satuan IS NULL
      OR t.satuan = p_satuan
      OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = t.satuan_id AND s.nama = p_satuan)
    )
  ORDER BY t.created_at DESC;
END;
$$;

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_announcements(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.api_get_announcements(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS TABLE (
  id           UUID,
  judul        TEXT,
  isi          TEXT,
  target_role  TEXT[],
  target_satuan TEXT,
  created_by   UUID,
  is_pinned    BOOLEAN,
  created_at   TIMESTAMPTZ,
  creator      JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.judul, a.isi, a.target_role, a.target_satuan,
    a.created_by, a.is_pinned, a.created_at,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'nama', c.nama, 'nrp', c.nrp, 'role', c.role)
      ELSE NULL
    END AS creator
  FROM public.announcements a
  LEFT JOIN public.users c ON a.created_by = c.id
  WHERE
    a.target_satuan IS NULL
    OR a.satuan_id IS NULL
    OR public.matches_current_satuan(a.satuan_id, a.target_satuan)
  ORDER BY a.is_pinned DESC, a.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.api_insert_announcement(UUID, TEXT, TEXT, TEXT, UUID, TEXT[], TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.api_insert_announcement(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_judul       TEXT,
  p_isi         TEXT,
  p_created_by  UUID        DEFAULT NULL,
  p_target_role TEXT[]      DEFAULT NULL,
  p_target_satuan TEXT      DEFAULT NULL,
  p_is_pinned   BOOLEAN     DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_satuan_id UUID := public.current_karyo_satuan_id();
BEGIN
  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.announcements (judul, isi, created_by, target_role, target_satuan, satuan_id, is_pinned)
  VALUES (
    p_judul,
    p_isi,
    COALESCE(p_created_by, p_caller_id),
    p_target_role,
    p_target_satuan,
    v_satuan_id,
    p_is_pinned
  );
END;
$$;

-- ============================================================
-- DOCUMENTS
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_documents(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.api_get_documents(
  p_user_id UUID,
  p_role TEXT
)
RETURNS TABLE (
  id UUID,
  nama TEXT,
  kategori TEXT,
  file_url TEXT,
  file_size INTEGER,
  satuan TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  uploader JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.nama,
    d.kategori,
    d.file_url,
    d.file_size,
    d.satuan,
    d.uploaded_by,
    d.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'role', u.role, 'satuan', u.satuan)
      ELSE NULL
    END
  FROM public.documents d
  LEFT JOIN public.users u ON u.id = d.uploaded_by
  WHERE d.satuan_id IS NULL OR public.matches_current_satuan(d.satuan_id, d.satuan)
  ORDER BY d.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.api_insert_document(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.api_insert_document(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama TEXT,
  p_kategori TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL,
  p_satuan TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.documents (nama, kategori, file_url, satuan, satuan_id, uploaded_by, file_size)
  VALUES (
    p_nama,
    p_kategori,
    p_file_url,
    COALESCE(p_satuan, public.current_karyo_satuan()),
    public.current_karyo_satuan_id(),
    p_caller_id,
    p_file_size
  );
END;
$$;

-- ============================================================
-- LEAVE REQUESTS / LOGISTICS / ATTENDANCE / REPORTS
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_leave_requests(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.api_get_leave_requests(
  p_user_id UUID,
  p_role TEXT,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  jenis_izin TEXT,
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  alasan TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  approved_by UUID,
  reviewer JSON,
  "user" JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.id,
    lr.user_id,
    lr.jenis_izin,
    lr.tanggal_mulai,
    lr.tanggal_selesai,
    lr.alasan,
    lr.status,
    lr.created_at,
    lr.updated_at,
    lr.approved_by,
    CASE WHEN rv.id IS NOT NULL
      THEN json_build_object('id', rv.id, 'nama', rv.nama, 'nrp', rv.nrp, 'role', rv.role)
      ELSE NULL
    END,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'role', u.role, 'satuan', u.satuan)
      ELSE NULL
    END
  FROM public.leave_requests lr
  LEFT JOIN public.users u ON u.id = lr.user_id
  LEFT JOIN public.users rv ON rv.id = lr.approved_by
  WHERE (p_target_user_id IS NULL OR lr.user_id = p_target_user_id)
    AND (lr.satuan_id IS NULL OR public.matches_current_satuan(lr.satuan_id, u.satuan));
END;
$$;

DROP FUNCTION IF EXISTS public.api_insert_leave_request(UUID, TEXT, TEXT, DATE, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.api_insert_leave_request(
  p_user_id UUID,
  p_caller_role TEXT,
  p_jenis_izin TEXT,
  p_tanggal_mulai DATE,
  p_tanggal_selesai DATE,
  p_alasan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.leave_requests (user_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, satuan_id)
  VALUES (p_user_id, p_jenis_izin::public.leave_type, p_tanggal_mulai, p_tanggal_selesai, p_alasan, public.current_karyo_satuan_id());
END;
$$;

DROP FUNCTION IF EXISTS public.api_get_logistics_requests(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.api_get_logistics_requests(
  p_user_id UUID,
  p_role TEXT,
  p_satuan_filter TEXT DEFAULT NULL,
  p_requested_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  requested_by UUID,
  satuan TEXT,
  nama_item TEXT,
  jumlah INTEGER,
  satuan_item TEXT,
  alasan TEXT,
  status TEXT,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  requester JSON,
  reviewer JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.id,
    lr.requested_by,
    lr.satuan,
    lr.nama_item,
    lr.jumlah,
    lr.satuan_item,
    lr.alasan,
    lr.status,
    lr.admin_note,
    lr.reviewed_by,
    lr.reviewed_at,
    lr.created_at,
    lr.updated_at,
    CASE WHEN r.id IS NOT NULL
      THEN json_build_object('id', r.id, 'nama', r.nama, 'nrp', r.nrp, 'role', r.role, 'satuan', r.satuan)
      ELSE NULL
    END,
    CASE WHEN v.id IS NOT NULL
      THEN json_build_object('id', v.id, 'nama', v.nama, 'nrp', v.nrp, 'role', v.role)
      ELSE NULL
    END
  FROM public.logistics_requests lr
  LEFT JOIN public.users r ON r.id = lr.requested_by
  LEFT JOIN public.users v ON v.id = lr.reviewed_by
  WHERE (p_requested_by IS NULL OR lr.requested_by = p_requested_by)
    AND (
      p_satuan_filter IS NULL
      OR lr.satuan = p_satuan_filter
      OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = lr.satuan_id AND s.nama = p_satuan_filter)
    )
    AND (lr.satuan_id IS NULL OR public.matches_current_satuan(lr.satuan_id, r.satuan));
END;
$$;

DROP FUNCTION IF EXISTS public.api_insert_logistics_request(UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.api_insert_logistics_request(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_satuan TEXT,
  p_nama_item TEXT,
  p_jumlah INT,
  p_satuan_item TEXT DEFAULT NULL,
  p_alasan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.logistics_requests (
    requested_by,
    satuan,
    nama_item,
    jumlah,
    satuan_item,
    alasan,
    satuan_id
  ) VALUES (
    p_caller_id,
    p_satuan,
    p_nama_item,
    p_jumlah,
    p_satuan_item,
    p_alasan,
    public.current_karyo_satuan_id()
  );
END;
$$;

DROP FUNCTION IF EXISTS public.api_get_attendance_report(DATE, DATE, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.api_get_attendance_report(
  p_date_from DATE,
  p_date_to DATE,
  p_status TEXT DEFAULT NULL,
  p_satuan TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  tanggal DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ,
  "user" JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    a.tanggal,
    a.check_in,
    a.check_out,
    a.status,
    a.keterangan,
    a.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan, 'role', u.role)
      ELSE NULL
    END
  FROM public.attendance a
  LEFT JOIN public.users u ON u.id = a.user_id
  WHERE a.tanggal >= p_date_from
    AND a.tanggal <= p_date_to
    AND (p_status IS NULL OR a.status = p_status)
    AND (
      p_satuan IS NULL
      OR u.satuan = p_satuan
      OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = a.satuan_id AND s.nama = p_satuan)
    )
    AND (a.satuan_id IS NULL OR public.matches_current_satuan(a.satuan_id, u.satuan))
  ORDER BY a.tanggal DESC, a.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.api_get_komandan_reports(TEXT, DATE);
CREATE OR REPLACE FUNCTION public.api_get_komandan_reports(
  p_satuan TEXT,
  p_tanggal DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_attendances JSONB := '[]'::JSONB;
  v_tasks JSONB := '[]'::JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_attendances
  FROM (
    SELECT
      a.*,
      CASE WHEN u.id IS NOT NULL
        THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
        ELSE NULL
      END AS "user"
    FROM public.attendance a
    LEFT JOIN public.users u ON u.id = a.user_id
    WHERE a.tanggal = p_tanggal
      AND (
        p_satuan IS NULL
        OR u.satuan = p_satuan
        OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = a.satuan_id AND s.nama = p_satuan)
      )
    ORDER BY a.created_at DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_tasks
  FROM (
    SELECT
      tk.*,
      CASE WHEN ass.id IS NOT NULL
        THEN json_build_object('id', ass.id, 'nama', ass.nama, 'nrp', ass.nrp)
        ELSE NULL
      END AS assignee,
      CASE WHEN asn.id IS NOT NULL
        THEN json_build_object('id', asn.id, 'nama', asn.nama)
        ELSE NULL
      END AS assigner
    FROM public.tasks tk
    LEFT JOIN public.users ass ON ass.id = tk.assigned_to
    LEFT JOIN public.users asn ON asn.id = tk.assigned_by
    WHERE (
      p_satuan IS NULL
      OR tk.satuan = p_satuan
      OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = tk.satuan_id AND s.nama = p_satuan)
    )
    ORDER BY tk.created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'attendances', v_attendances,
    'tasks', v_tasks
  );
END;
$$;

DROP FUNCTION IF EXISTS public.api_get_staf_stats(TEXT);
CREATE OR REPLACE FUNCTION public.api_get_staf_stats(
  p_satuan TEXT
)
RETURNS TABLE (
  total_personel INTEGER,
  hadir_hari_ini INTEGER,
  tugas_aktif INTEGER,
  logistik_pending INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.users WHERE is_active = TRUE AND (satuan = p_satuan OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = satuan_id AND s.nama = p_satuan))), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.attendance WHERE tanggal = CURRENT_DATE AND status = 'hadir' AND (satuan_id IS NULL OR public.matches_current_satuan(satuan_id, NULL))), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.tasks WHERE status IN ('pending', 'in_progress') AND (satuan = p_satuan OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = satuan_id AND s.nama = p_satuan))), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.logistics_requests WHERE status = 'pending' AND (satuan = p_satuan OR EXISTS (SELECT 1 FROM public.satuans s WHERE s.id = satuan_id AND s.nama = p_satuan))), 0);
END;
$$;

-- ============================================================
-- Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION public.matches_current_satuan(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.matches_current_satuan(UUID, TEXT) TO authenticated;
