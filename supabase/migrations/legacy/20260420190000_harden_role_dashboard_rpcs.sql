-- ============================================================
-- KARYO OS — Harden dashboard RPCs for new role dashboards
-- - Enforce role-based access directly in DB identity context.
-- - Prefer satuan_id scope, fallback to legacy satuan text.
-- - Prevent client-supplied p_satuan from broadening access.
-- ============================================================

-- ------------------------------------------------------------
-- Admin dashboard: strictly admin only
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
  v_caller_role TEXT;
BEGIN
  v_caller_role := public.current_karyo_role_db();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

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

-- ------------------------------------------------------------
-- Komandan dashboard stats: enforce role + trusted scope
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Staf dashboard stats: enforce role + trusted scope
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

  IF v_role NOT IN ('staf', 'komandan', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: hanya staf/komandan/admin yang dapat melihat statistik staf';
  END IF;

  IF v_scope_satuan_id IS NULL THEN
    v_scope_satuan_text := COALESCE(v_scope_satuan_text, NULLIF(BTRIM(p_satuan), ''));
  END IF;

  IF v_scope_satuan_id IS NULL AND v_scope_satuan_text IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.users u
      WHERE u.is_active = TRUE
        AND (
          (v_scope_satuan_id IS NOT NULL AND u.satuan_id = v_scope_satuan_id)
          OR (v_scope_satuan_id IS NULL AND NULLIF(BTRIM(u.satuan), '') = v_scope_satuan_text)
        )
    ), 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.attendance a
      LEFT JOIN public.users u ON u.id = a.user_id
      WHERE a.tanggal = CURRENT_DATE
        AND a.status = 'hadir'
        AND (
          (v_scope_satuan_id IS NOT NULL AND (
            a.satuan_id = v_scope_satuan_id
            OR (a.satuan_id IS NULL AND u.satuan_id = v_scope_satuan_id)
          ))
          OR (v_scope_satuan_id IS NULL AND (
            NULLIF(BTRIM(u.satuan), '') = v_scope_satuan_text
            OR (u.satuan IS NULL AND NULLIF(BTRIM(a.keterangan), '') = v_scope_satuan_text)
          ))
        )
    ), 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.tasks t
      WHERE t.status IN ('pending', 'in_progress')
        AND (
          (v_scope_satuan_id IS NOT NULL AND t.satuan_id = v_scope_satuan_id)
          OR (v_scope_satuan_id IS NULL AND NULLIF(BTRIM(t.satuan), '') = v_scope_satuan_text)
        )
    ), 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.logistics_requests lr
      WHERE lr.status = 'pending'
        AND (
          (v_scope_satuan_id IS NOT NULL AND lr.satuan_id = v_scope_satuan_id)
          OR (v_scope_satuan_id IS NULL AND NULLIF(BTRIM(lr.satuan), '') = v_scope_satuan_text)
        )
    ), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_admin_dashboard_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_komandan_dashboard_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_staf_stats(TEXT) TO anon, authenticated;
