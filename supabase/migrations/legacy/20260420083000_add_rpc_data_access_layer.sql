-- ============================================================
-- KARYO OS - RPC-only data access layer
-- Replaces direct browser table queries with SECURITY DEFINER RPCs.
-- ============================================================

-- ------------------------------------------------------------
-- SHIFT SCHEDULE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_shift_schedules(
  p_date DATE DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  tanggal DATE,
  shift_mulai TIME,
  shift_selesai TIME,
  jenis_shift TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  "user" JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('shift_schedule') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.tanggal,
    s.shift_mulai,
    s.shift_selesai,
    s.jenis_shift,
    s.created_by,
    s.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan)
      ELSE NULL
    END
  FROM public.shift_schedules s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE (p_date IS NULL OR s.tanggal = p_date)
    AND (p_date_from IS NULL OR s.tanggal >= p_date_from)
    AND (p_date_to IS NULL OR s.tanggal <= p_date_to)
  ORDER BY s.tanggal ASC, s.shift_mulai ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_shift_schedule(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_user_id UUID,
  p_tanggal DATE,
  p_shift_mulai TIME,
  p_shift_selesai TIME,
  p_jenis_shift TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('shift_schedule') THEN
    RAISE EXCEPTION 'shift_schedule feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.shift_schedules (
    user_id,
    tanggal,
    shift_mulai,
    shift_selesai,
    jenis_shift,
    created_by
  )
  VALUES (
    p_user_id,
    p_tanggal,
    p_shift_mulai,
    p_shift_selesai,
    p_jenis_shift::public.shift_type,
    p_caller_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_shift_schedule(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('shift_schedule') THEN
    RAISE EXCEPTION 'shift_schedule feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.shift_schedules
  WHERE id = p_id;
END;
$$;

-- ------------------------------------------------------------
-- LOGISTICS INVENTORY ITEMS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_logistics_items()
RETURNS SETOF public.logistics_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT li.*
  FROM public.logistics_items li
  ORDER BY li.nama_item ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_logistics_item(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama_item TEXT,
  p_kategori TEXT DEFAULT NULL,
  p_jumlah INT DEFAULT 0,
  p_satuan_item TEXT DEFAULT NULL,
  p_kondisi TEXT DEFAULT 'baik',
  p_lokasi TEXT DEFAULT NULL,
  p_catatan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.logistics_items (
    nama_item,
    kategori,
    jumlah,
    satuan_item,
    kondisi,
    lokasi,
    catatan
  )
  VALUES (
    p_nama_item,
    p_kategori,
    COALESCE(p_jumlah, 0),
    p_satuan_item,
    COALESCE(p_kondisi, 'baik')::public.logistics_condition,
    p_lokasi,
    p_catatan
  );
END;
$$;

-- ------------------------------------------------------------
-- DISCIPLINE NOTES
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_discipline_notes(
  p_filter_user_id UUID DEFAULT NULL,
  p_satuan_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  jenis TEXT,
  isi TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  "user" JSON,
  creator JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.jenis,
    d.isi,
    d.created_by,
    d.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan)
      ELSE NULL
    END,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'nama', c.nama)
      ELSE NULL
    END
  FROM public.discipline_notes d
  LEFT JOIN public.users u ON u.id = d.user_id
  LEFT JOIN public.users c ON c.id = d.created_by
  WHERE (p_filter_user_id IS NULL OR d.user_id = p_filter_user_id)
    AND (p_satuan_filter IS NULL OR u.satuan = p_satuan_filter)
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_discipline_note(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_user_id UUID,
  p_jenis TEXT,
  p_isi TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.discipline_notes (user_id, jenis, isi, created_by)
  VALUES (p_user_id, p_jenis::public.discipline_type, p_isi, p_caller_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_discipline_note(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.discipline_notes
  WHERE id = p_id;
END;
$$;

-- ------------------------------------------------------------
-- SEARCH
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_search_all(
  p_query TEXT,
  p_caller_role TEXT
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  subtitle TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_like TEXT;
BEGIN
  IF p_query IS NULL OR btrim(p_query) = '' THEN
    RETURN;
  END IF;

  v_like := '%' || p_query || '%';

  RETURN QUERY
  SELECT
    t.id,
    'task'::TEXT,
    t.judul,
    ('Status: ' || t.status || COALESCE(' · ' || t.satuan, ''))::TEXT,
    p_caller_role
  FROM public.tasks t
  WHERE t.judul ILIKE v_like OR COALESCE(t.deskripsi, '') ILIKE v_like
  ORDER BY t.created_at DESC
  LIMIT 5;

  IF p_caller_role IN ('admin', 'komandan') THEN
    RETURN QUERY
    SELECT
      u.id,
      'user'::TEXT,
      u.nama,
      (u.nrp || COALESCE(' · ' || u.pangkat, '') || ' · ' || u.role)::TEXT,
      p_caller_role
    FROM public.users u
    WHERE u.is_active = TRUE
      AND (u.nama ILIKE v_like OR u.nrp ILIKE v_like)
    ORDER BY u.nama ASC
    LIMIT 5;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    'announcement'::TEXT,
    a.judul,
    LEFT(a.isi, 80),
    p_caller_role
  FROM public.announcements a
  WHERE a.judul ILIKE v_like OR a.isi ILIKE v_like
  ORDER BY a.created_at DESC
  LIMIT 4;
END;
$$;

-- ------------------------------------------------------------
-- DASHBOARD
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_admin_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_thirty_days_ago DATE := CURRENT_DATE - INTERVAL '30 days';
  v_total_personel INTEGER := 0;
  v_total_online INTEGER := 0;
  v_total_tugas INTEGER := 0;
  v_tugas_aktif INTEGER := 0;
  v_pending_izin INTEGER := 0;
  v_absensi_hari_ini INTEGER := 0;
  v_absensi_masuk INTEGER := 0;
  v_pinned_pengumuman INTEGER := 0;
  v_checked_in INTEGER := 0;
  v_completed INTEGER := 0;
  v_overdue INTEGER := 0;
  v_personil_di_luar INTEGER := 0;
  v_personil_tersedia INTEGER := 0;
  v_recent_logs JSONB := '[]'::JSONB;
  v_low_stock_items JSONB := '[]'::JSONB;
  v_heatmap JSONB := '[]'::JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total_personel
  FROM public.users
  WHERE is_active = TRUE;

  SELECT COUNT(*) INTO v_total_online
  FROM public.users
  WHERE is_active = TRUE AND is_online = TRUE;

  SELECT COUNT(*) INTO v_total_tugas
  FROM public.tasks;

  SELECT COUNT(*) INTO v_tugas_aktif
  FROM public.tasks
  WHERE status IN ('pending', 'in_progress');

  SELECT COUNT(*) INTO v_pending_izin
  FROM public.leave_requests
  WHERE status = 'pending';

  SELECT COUNT(*) INTO v_absensi_hari_ini
  FROM public.attendance
  WHERE tanggal = v_today;

  SELECT COUNT(*) INTO v_absensi_masuk
  FROM public.attendance
  WHERE tanggal = v_today AND status = 'hadir';

  SELECT COUNT(*) INTO v_pinned_pengumuman
  FROM public.announcements
  WHERE is_pinned = TRUE;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_recent_logs
  FROM (
    SELECT
      al.*,
      CASE WHEN u.id IS NOT NULL
        THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'role', u.role)
        ELSE NULL
      END AS "user"
    FROM public.audit_logs al
    LEFT JOIN public.users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_low_stock_items
  FROM (
    SELECT li.*
    FROM public.logistics_items li
    WHERE li.jumlah <= 5 OR li.kondisi <> 'baik'
    ORDER BY li.jumlah ASC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_heatmap
  FROM (
    SELECT
      a.*,
      CASE WHEN u.id IS NOT NULL
        THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
        ELSE NULL
      END AS "user"
    FROM public.attendance a
    LEFT JOIN public.users u ON u.id = a.user_id
    WHERE a.tanggal >= v_thirty_days_ago
      AND a.tanggal <= v_today
    ORDER BY a.tanggal DESC
  ) t;

  SELECT COUNT(*) INTO v_checked_in
  FROM public.gate_pass
  WHERE status IN ('checked_in', 'out')
    AND (waktu_kembali IS NULL OR waktu_kembali >= NOW());

  SELECT COUNT(*) INTO v_completed
  FROM public.gate_pass
  WHERE status IN ('completed', 'returned');

  SELECT COUNT(*) INTO v_overdue
  FROM public.gate_pass
  WHERE status IN ('checked_in', 'out')
    AND waktu_kembali IS NOT NULL
    AND waktu_kembali < NOW();

  SELECT COUNT(*) INTO v_personil_di_luar
  FROM public.gate_pass
  WHERE status IN ('approved', 'checked_in', 'out');

  v_personil_tersedia := GREATEST(0, v_total_personel - v_personil_di_luar);

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'totalPersonel', v_total_personel,
      'totalOnline', v_total_online,
      'totalTugas', v_total_tugas,
      'tugasAktif', v_tugas_aktif,
      'pendingIzin', v_pending_izin,
      'absensiHariIni', v_absensi_hari_ini,
      'absensiMasuk', v_absensi_masuk,
      'pinnedPengumuman', v_pinned_pengumuman
    ),
    'recentLogs', v_recent_logs,
    'lowStockItems', v_low_stock_items,
    'heatmapAttendances', v_heatmap,
    'gatePassStats', jsonb_build_object(
      'checkedIn', v_checked_in,
      'completed', v_completed,
      'overdue', v_overdue,
      'personilTersedia', v_personil_tersedia,
      'personilDiLuar', v_personil_di_luar
    ),
    'fetchedAt', NOW()
  );
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
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.users WHERE is_online = TRUE AND satuan = p_satuan), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.users WHERE is_active = TRUE AND satuan = p_satuan), 0);
END;
$$;

-- ------------------------------------------------------------
-- STAFF / REPORTS / ATTENDANCE
-- ------------------------------------------------------------
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
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.users WHERE satuan = p_satuan AND is_active = TRUE), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.attendance WHERE tanggal = CURRENT_DATE AND status = 'hadir'), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.tasks WHERE status IN ('pending', 'in_progress')), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.logistics_requests WHERE status = 'pending'), 0);
END;
$$;

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
    AND (p_satuan IS NULL OR u.satuan = p_satuan)
  ORDER BY a.tanggal DESC, a.created_at DESC;
END;
$$;

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
      AND (p_satuan IS NULL OR u.satuan = p_satuan)
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
    WHERE (p_satuan IS NULL OR tk.satuan = p_satuan)
    ORDER BY tk.created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'attendances', v_attendances,
    'tasks', v_tasks
  );
END;
$$;

-- ------------------------------------------------------------
-- USER HELPERS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_user_personal_stats(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_date_from DATE := CURRENT_DATE - INTERVAL '30 days';
  v_total_tasks INTEGER := 0;
  v_approved_tasks INTEGER := 0;
  v_total_attendance INTEGER := 0;
  v_hadir_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_total_tasks
  FROM public.tasks
  WHERE assigned_to = p_user_id;

  SELECT COUNT(*) INTO v_approved_tasks
  FROM public.tasks
  WHERE assigned_to = p_user_id
    AND status = 'approved';

  SELECT COUNT(*) INTO v_total_attendance
  FROM public.attendance
  WHERE user_id = p_user_id
    AND tanggal >= v_date_from;

  SELECT COUNT(*) INTO v_hadir_count
  FROM public.attendance
  WHERE user_id = p_user_id
    AND tanggal >= v_date_from
    AND status = 'hadir';

  RETURN jsonb_build_object(
    'totalTasks', v_total_tasks,
    'approvedTasks', v_approved_tasks,
    'totalAttendance', v_total_attendance,
    'hadirCount', v_hadir_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_user_discipline_notes(
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  jenis TEXT,
  isi TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.jenis, d.isi, d.created_at, d.created_by
  FROM public.discipline_notes d
  WHERE d.user_id = p_user_id
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_user_avatar(
  p_user_id UUID,
  p_avatar_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.users
  SET foto_url = p_avatar_url,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_count_active_users(
  p_satuan TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.users
  WHERE is_active = TRUE
    AND (p_satuan IS NULL OR satuan = p_satuan);

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ------------------------------------------------------------
-- POS JAGA
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_pos_jaga()
RETURNS SETOF public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.pos_jaga p
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.pos_jaga (nama, qr_token, is_active)
  VALUES (p_nama, gen_random_uuid()::TEXT, TRUE)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_set_pos_jaga_active(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET is_active = p_is_active
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.pos_jaga
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rename_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET nama = p_nama
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rotate_pos_jaga_qr(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_qr_token TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET qr_token = p_qr_token
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ------------------------------------------------------------
-- BACKUP / RESTORE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_upsert_table_rows(
  p_table_name TEXT,
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cols_all TEXT;
  v_cols_update TEXT;
  v_sql TEXT;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  IF p_table_name NOT IN (
    'users',
    'announcements',
    'tasks',
    'attendance',
    'shift_schedules',
    'leave_requests',
    'logistics_requests',
    'messages'
  ) THEN
    RAISE EXCEPTION 'Table % is not allowed for restore', p_table_name;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols_all
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name;

  SELECT string_agg(format('%1$I = EXCLUDED.%1$I', column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols_update
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name
    AND column_name <> 'id';

  IF v_cols_all IS NULL THEN
    RAISE EXCEPTION 'Unknown table %', p_table_name;
  END IF;

  v_sql := format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) ON CONFLICT (id) DO UPDATE SET %3$s',
    p_table_name,
    v_cols_all,
    COALESCE(v_cols_update, 'id = EXCLUDED.id')
  );

  EXECUTE v_sql USING p_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_export_backup(
  p_caller_role TEXT,
  p_satuan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tables JSONB := '{}'::JSONB;
  v_rows JSONB;
  v_table TEXT;
  v_order_col TEXT;
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'users',
    'announcements',
    'tasks',
    'attendance',
    'shift_schedules',
    'leave_requests',
    'logistics_requests',
    'messages'
  ]
  LOOP
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = v_table
          AND column_name = 'created_at'
      ) THEN 'created_at'
      ELSE 'id'
    END
    INTO v_order_col;

    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%1$I ORDER BY %2$I) t',
      v_table,
      v_order_col
    ) INTO v_rows;

    v_tables := jsonb_set(v_tables, ARRAY[v_table], COALESCE(v_rows, '[]'::JSONB), TRUE);
  END LOOP;

  RETURN jsonb_build_object(
    'version', '1.2',
    'exported_at', NOW(),
    'satuan', COALESCE(p_satuan, '—'),
    'tables', v_tables
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_restore_backup(
  p_caller_role TEXT,
  p_tables JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_table TEXT;
BEGIN
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_tables IS NULL OR jsonb_typeof(p_tables) <> 'object' THEN
    RAISE EXCEPTION 'Invalid restore payload';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'users',
    'announcements',
    'tasks',
    'attendance',
    'shift_schedules',
    'leave_requests',
    'logistics_requests',
    'messages'
  ]
  LOOP
    PERFORM public.api_upsert_table_rows(v_table, COALESCE(p_tables -> v_table, '[]'::JSONB));
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- GRANTS
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.api_get_shift_schedules(DATE, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_insert_shift_schedule(UUID, TEXT, UUID, DATE, TIME, TIME, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_shift_schedule(UUID, TEXT, UUID) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_logistics_items() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_insert_logistics_item(UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_discipline_notes(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_insert_discipline_note(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_discipline_note(UUID, TEXT, UUID) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_search_all(TEXT, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_admin_dashboard_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_komandan_dashboard_stats(TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_staf_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_attendance_report(DATE, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_komandan_reports(TEXT, DATE) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_user_personal_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_user_discipline_notes(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_update_user_avatar(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_count_active_users(TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_get_pos_jaga() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_insert_pos_jaga(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_set_pos_jaga_active(UUID, TEXT, UUID, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_pos_jaga(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rename_pos_jaga(UUID, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rotate_pos_jaga_qr(UUID, TEXT, UUID, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_upsert_table_rows(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_export_backup(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_restore_backup(TEXT, JSONB) TO anon, authenticated;
