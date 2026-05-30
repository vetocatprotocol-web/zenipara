-- ============================================================
-- KARYO OS — Migration 018: Authenticated API Functions
--
-- PROBLEM: Direct table queries rely on RLS with PostgreSQL
-- session variables (karyo.current_user_id / karyo.current_user_role).
-- Supabase uses connection pooling, so session variables set by
-- set_session_context on one HTTP request are NOT available on the
-- next HTTP request (may get a different pooled connection).
-- This causes all RLS-protected queries to return empty results
-- after login, making the app appear to be a static site.
--
-- FIX: Replace all direct table access with SECURITY DEFINER
-- functions that accept p_user_id + p_role explicitly and enforce
-- authorization inside the function — no RLS context needed.
-- ============================================================

-- ============================================================
-- USERS
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.api_update_user(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_target_id   UUID,
  p_updates     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Only admin may update any user
  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.users
  SET
    nama        = COALESCE((p_updates->>'nama')::TEXT,        nama),
    role        = COALESCE((p_updates->>'role')::TEXT,        role),
    pangkat     = COALESCE((p_updates->>'pangkat')::TEXT,     pangkat),
    jabatan     = COALESCE((p_updates->>'jabatan')::TEXT,     jabatan),
    satuan      = COALESCE((p_updates->>'satuan')::TEXT,      satuan),
    is_active   = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
    foto_url    = COALESCE((p_updates->>'foto_url')::TEXT,    foto_url),
    updated_at  = NOW()
  WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================

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
  -- All authenticated users can read announcements
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
  ORDER BY a.is_pinned DESC, a.created_at DESC;
END;
$$;

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
BEGIN
  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.announcements (judul, isi, created_by, target_role, target_satuan, is_pinned)
  VALUES (p_judul, p_isi, COALESCE(p_created_by, p_caller_id), p_target_role, p_target_satuan, p_is_pinned);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_announcement(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_updates     JSONB
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

  UPDATE public.announcements
  SET
    judul       = COALESCE((p_updates->>'judul')::TEXT,       judul),
    isi         = COALESCE((p_updates->>'isi')::TEXT,         isi),
    is_pinned   = COALESCE((p_updates->>'is_pinned')::BOOLEAN, is_pinned),
    target_role = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_updates->'target_role')),
      target_role
    )
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_announcement(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID
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

  DELETE FROM public.announcements WHERE id = p_id;
END;
$$;

-- ============================================================
-- TASKS
-- ============================================================

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
  status       TEXT,
  prioritas    INT,
  deadline     TIMESTAMPTZ,
  satuan       TEXT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  assignee     JSON,
  assigner     JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_role IN ('admin', 'komandan') THEN
    RETURN QUERY
    SELECT
      t.id, t.judul, t.deskripsi, t.assigned_to, t.assigned_by,
      t.status, t.prioritas, t.deadline, t.satuan, t.created_at, t.updated_at,
      CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'nama', a.nama, 'nrp', a.nrp, 'pangkat', a.pangkat) ELSE NULL END,
      CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'nama', b.nama, 'nrp', b.nrp) ELSE NULL END
    FROM public.tasks t
    LEFT JOIN public.users a ON t.assigned_to = a.id
    LEFT JOIN public.users b ON t.assigned_by = b.id
    WHERE (p_assigned_to IS NULL OR t.assigned_to = p_assigned_to)
      AND (p_assigned_by IS NULL OR t.assigned_by = p_assigned_by)
      AND (p_status IS NULL OR t.status = p_status)
      AND (p_satuan IS NULL OR t.satuan = p_satuan)
    ORDER BY t.created_at DESC;
  ELSE
    -- prajurit / guard: only see tasks assigned to them
    RETURN QUERY
    SELECT
      t.id, t.judul, t.deskripsi, t.assigned_to, t.assigned_by,
      t.status, t.prioritas, t.deadline, t.satuan, t.created_at, t.updated_at,
      CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'nama', a.nama, 'nrp', a.nrp, 'pangkat', a.pangkat) ELSE NULL END,
      CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'nama', b.nama, 'nrp', b.nrp) ELSE NULL END
    FROM public.tasks t
    LEFT JOIN public.users a ON t.assigned_to = a.id
    LEFT JOIN public.users b ON t.assigned_by = b.id
    WHERE t.assigned_to = p_user_id
      AND (p_status IS NULL OR t.status = p_status)
    ORDER BY t.created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_task(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_judul      TEXT,
  p_deskripsi  TEXT        DEFAULT NULL,
  p_assigned_to UUID       DEFAULT NULL,
  p_assigned_by UUID       DEFAULT NULL,
  p_deadline   TIMESTAMPTZ DEFAULT NULL,
  p_prioritas  INT         DEFAULT 2,
  p_satuan     TEXT        DEFAULT NULL
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

  INSERT INTO public.tasks (judul, deskripsi, assigned_to, assigned_by, deadline, prioritas, satuan, status)
  VALUES (p_judul, p_deskripsi, p_assigned_to, COALESCE(p_assigned_by, p_caller_id), p_deadline, p_prioritas, p_satuan, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_task_status(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_task_id    UUID,
  p_status     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- prajurit can only update tasks assigned to them
  IF p_caller_role IN ('prajurit', 'guard') THEN
    UPDATE public.tasks SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id AND assigned_to = p_caller_id;
  ELSE
    UPDATE public.tasks SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_task_report(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_task_id    UUID,
  p_isi_laporan TEXT,
  p_file_url   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.task_reports (task_id, user_id, isi_laporan, file_url)
  VALUES (p_task_id, p_caller_id, p_isi_laporan, p_file_url);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_latest_task_report(
  p_user_id UUID,
  p_role    TEXT,
  p_task_id UUID
)
RETURNS SETOF public.task_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.task_reports
  WHERE task_id = p_task_id
  ORDER BY submitted_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_attendance(
  p_user_id        UUID,
  p_role           TEXT,
  p_target_user_id UUID    DEFAULT NULL,
  p_limit          INTEGER DEFAULT 30
)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  tanggal     DATE,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  status      TEXT,
  keterangan  TEXT,
  created_at  TIMESTAMPTZ,
  "user"      JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target UUID;
BEGIN
  -- admin/komandan can see any user; others see only themselves
  IF p_role IN ('admin', 'komandan') THEN
    v_target := p_target_user_id;
  ELSE
    v_target := COALESCE(p_target_user_id, p_user_id);
    -- prajurit/guard can only see their own
    IF v_target != p_user_id THEN
      v_target := p_user_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.user_id, a.tanggal, a.check_in, a.check_out, a.status, a.keterangan, a.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
      ELSE NULL
    END
  FROM public.attendance a
  LEFT JOIN public.users u ON a.user_id = u.id
  WHERE (v_target IS NULL OR a.user_id = v_target)
  ORDER BY a.tanggal DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- GATE PASS
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_gate_passes(
  p_user_id        UUID,
  p_role           TEXT,
  p_target_user_id UUID    DEFAULT NULL,
  p_status_filter  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  keperluan       TEXT,
  tujuan          TEXT,
  waktu_keluar    TIMESTAMPTZ,
  waktu_kembali   TIMESTAMPTZ,
  actual_keluar   TIMESTAMPTZ,
  actual_kembali  TIMESTAMPTZ,
  status          TEXT,
  approved_by     UUID,
  qr_token        TEXT,
  created_at      TIMESTAMPTZ,
  "user"          JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_role IN ('admin', 'komandan', 'guard') THEN
    -- Can see all (or filtered) gate passes
    RETURN QUERY
    SELECT
      g.id, g.user_id, g.keperluan, g.tujuan, g.waktu_keluar, g.waktu_kembali,
      g.actual_keluar, g.actual_kembali, g.status::TEXT, g.approved_by, g.qr_token, g.created_at,
      CASE WHEN u.id IS NOT NULL
        THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan)
        ELSE NULL
      END
    FROM public.gate_pass g
    LEFT JOIN public.users u ON g.user_id = u.id
    WHERE (p_target_user_id IS NULL OR g.user_id = p_target_user_id)
      AND (p_status_filter IS NULL OR g.status::TEXT = p_status_filter)
    ORDER BY g.created_at DESC;
  ELSE
    -- prajurit: only own gate passes
    RETURN QUERY
    SELECT
      g.id, g.user_id, g.keperluan, g.tujuan, g.waktu_keluar, g.waktu_kembali,
      g.actual_keluar, g.actual_kembali, g.status::TEXT, g.approved_by, g.qr_token, g.created_at,
      NULL::JSON
    FROM public.gate_pass g
    WHERE g.user_id = p_user_id
      AND (p_status_filter IS NULL OR g.status::TEXT = p_status_filter)
    ORDER BY g.created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_gate_pass(
  p_user_id       UUID,
  p_caller_role   TEXT,
  p_keperluan     TEXT,
  p_tujuan        TEXT,
  p_waktu_keluar  TIMESTAMPTZ,
  p_waktu_kembali TIMESTAMPTZ,
  p_qr_token      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.gate_pass (user_id, keperluan, tujuan, waktu_keluar, waktu_kembali, qr_token, status)
  VALUES (p_user_id, p_keperluan, p_tujuan, p_waktu_keluar, p_waktu_kembali, p_qr_token, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_gate_pass_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_approved_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_caller_role NOT IN ('admin', 'komandan', 'guard') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.gate_pass
  SET status = p_status::gate_pass_status,
      approved_by = COALESCE(p_approved_by, approved_by)
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_leave_requests(
  p_user_id        UUID,
  p_role           TEXT,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  jenis_izin      TEXT,
  tanggal_mulai   DATE,
  tanggal_selesai DATE,
  alasan          TEXT,
  status          TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  "user"          JSON,
  reviewer        JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_role IN ('admin', 'komandan') THEN
    RETURN QUERY
    SELECT
      lr.id, lr.user_id, lr.jenis_izin, lr.tanggal_mulai, lr.tanggal_selesai,
      lr.alasan, lr.status, lr.reviewed_by, lr.reviewed_at, lr.created_at,
      CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan) ELSE NULL END,
      CASE WHEN rv.id IS NOT NULL THEN json_build_object('id', rv.id, 'nama', rv.nama) ELSE NULL END
    FROM public.leave_requests lr
    LEFT JOIN public.users u  ON lr.user_id = u.id
    LEFT JOIN public.users rv ON lr.reviewed_by = rv.id
    WHERE (p_target_user_id IS NULL OR lr.user_id = p_target_user_id)
    ORDER BY lr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      lr.id, lr.user_id, lr.jenis_izin, lr.tanggal_mulai, lr.tanggal_selesai,
      lr.alasan, lr.status, lr.reviewed_by, lr.reviewed_at, lr.created_at,
      CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan) ELSE NULL END,
      CASE WHEN rv.id IS NOT NULL THEN json_build_object('id', rv.id, 'nama', rv.nama) ELSE NULL END
    FROM public.leave_requests lr
    LEFT JOIN public.users u  ON lr.user_id = u.id
    LEFT JOIN public.users rv ON lr.reviewed_by = rv.id
    WHERE lr.user_id = p_user_id
    ORDER BY lr.created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_leave_request(
  p_user_id       UUID,
  p_caller_role   TEXT,
  p_jenis_izin    TEXT,
  p_tanggal_mulai DATE,
  p_tanggal_selesai DATE,
  p_alasan        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.leave_requests (user_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, status)
  VALUES (p_user_id, p_jenis_izin, p_tanggal_mulai, p_tanggal_selesai, p_alasan, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_leave_request_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_reviewed_by UUID
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

  UPDATE public.leave_requests
  SET status = p_status, reviewed_by = p_reviewed_by, reviewed_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_inbox(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS TABLE (
  id         UUID,
  from_user  UUID,
  to_user    UUID,
  isi        TEXT,
  is_read    BOOLEAN,
  created_at TIMESTAMPTZ,
  sender     JSON,
  receiver   JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.from_user, m.to_user, m.isi, m.is_read, m.created_at,
    CASE WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'nama', s.nama, 'nrp', s.nrp, 'pangkat', s.pangkat) ELSE NULL END,
    CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'nama', r.nama, 'nrp', r.nrp) ELSE NULL END
  FROM public.messages m
  LEFT JOIN public.users s ON m.from_user = s.id
  LEFT JOIN public.users r ON m.to_user   = r.id
  WHERE m.to_user = p_user_id
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_sent(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS TABLE (
  id         UUID,
  from_user  UUID,
  to_user    UUID,
  isi        TEXT,
  is_read    BOOLEAN,
  created_at TIMESTAMPTZ,
  sender     JSON,
  receiver   JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.from_user, m.to_user, m.isi, m.is_read, m.created_at,
    CASE WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'nama', s.nama, 'nrp', s.nrp) ELSE NULL END,
    CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'nama', r.nama, 'nrp', r.nrp, 'pangkat', r.pangkat) ELSE NULL END
  FROM public.messages m
  LEFT JOIN public.users s ON m.from_user = s.id
  LEFT JOIN public.users r ON m.to_user   = r.id
  WHERE m.from_user = p_user_id
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_message(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_from_user   UUID,
  p_to_user     UUID,
  p_isi         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.messages (from_user, to_user, isi)
  VALUES (p_from_user, p_to_user, p_isi);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_mark_message_read(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_message_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.messages SET is_read = TRUE
  WHERE id = p_message_id AND to_user = p_caller_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_mark_all_messages_read(
  p_caller_id   UUID,
  p_caller_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.messages SET is_read = TRUE
  WHERE to_user = p_caller_id AND is_read = FALSE;
END;
$$;

-- ============================================================
-- LOGISTICS REQUESTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_logistics_requests(
  p_user_id           UUID,
  p_role              TEXT,
  p_satuan_filter     TEXT DEFAULT NULL,
  p_requested_by      UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  requested_by  UUID,
  satuan        TEXT,
  nama_item     TEXT,
  jumlah        INT,
  satuan_item   TEXT,
  alasan        TEXT,
  status        TEXT,
  admin_note    TEXT,
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,
  requester     JSON,
  reviewer      JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_role = 'admin' THEN
    RETURN QUERY
    SELECT
      lr.id, lr.requested_by, lr.satuan, lr.nama_item, lr.jumlah, lr.satuan_item,
      lr.alasan, lr.status, lr.admin_note, lr.reviewed_by, lr.reviewed_at,
      lr.created_at, lr.updated_at,
      CASE WHEN req.id IS NOT NULL THEN json_build_object('id', req.id, 'nama', req.nama, 'nrp', req.nrp, 'pangkat', req.pangkat, 'satuan', req.satuan) ELSE NULL END,
      CASE WHEN rv.id IS NOT NULL  THEN json_build_object('id', rv.id, 'nama', rv.nama) ELSE NULL END
    FROM public.logistics_requests lr
    LEFT JOIN public.users req ON lr.requested_by = req.id
    LEFT JOIN public.users rv  ON lr.reviewed_by  = rv.id
    WHERE (p_satuan_filter IS NULL OR lr.satuan = p_satuan_filter)
      AND (p_requested_by IS NULL OR lr.requested_by = p_requested_by)
    ORDER BY lr.created_at DESC;
  ELSE
    -- komandan and others: see their own requests
    RETURN QUERY
    SELECT
      lr.id, lr.requested_by, lr.satuan, lr.nama_item, lr.jumlah, lr.satuan_item,
      lr.alasan, lr.status, lr.admin_note, lr.reviewed_by, lr.reviewed_at,
      lr.created_at, lr.updated_at,
      CASE WHEN req.id IS NOT NULL THEN json_build_object('id', req.id, 'nama', req.nama, 'nrp', req.nrp, 'pangkat', req.pangkat, 'satuan', req.satuan) ELSE NULL END,
      CASE WHEN rv.id IS NOT NULL  THEN json_build_object('id', rv.id, 'nama', rv.nama) ELSE NULL END
    FROM public.logistics_requests lr
    LEFT JOIN public.users req ON lr.requested_by = req.id
    LEFT JOIN public.users rv  ON lr.reviewed_by  = rv.id
    WHERE lr.requested_by = p_user_id
    ORDER BY lr.created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_logistics_request(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_satuan      TEXT,
  p_nama_item   TEXT,
  p_jumlah      INT,
  p_satuan_item TEXT DEFAULT NULL,
  p_alasan      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.logistics_requests (requested_by, satuan, nama_item, jumlah, satuan_item, alasan, status)
  VALUES (p_caller_id, p_satuan, p_nama_item, p_jumlah, p_satuan_item, p_alasan, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_logistics_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_admin_note  TEXT DEFAULT NULL
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

  UPDATE public.logistics_requests
  SET status = p_status, admin_note = p_admin_note, reviewed_by = p_caller_id, reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_audit_logs(
  p_user_id        UUID,
  p_role           TEXT,
  p_filter_user_id UUID    DEFAULT NULL,
  p_action_filter  TEXT    DEFAULT NULL,
  p_limit          INTEGER DEFAULT 100
)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  action      TEXT,
  resource    TEXT,
  resource_id TEXT,
  detail      JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ,
  "user"      JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    al.id, al.user_id, al.action, al.resource, al.resource_id,
    al.detail, al.ip_address, al.user_agent, al.created_at,
    CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'role', u.role) ELSE NULL END
  FROM public.audit_logs al
  LEFT JOIN public.users u ON al.user_id = u.id
  WHERE (p_filter_user_id IS NULL OR al.user_id = p_filter_user_id)
    AND (p_action_filter IS NULL OR al.action = p_action_filter)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_get_documents(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS TABLE (
  id          UUID,
  nama        TEXT,
  kategori    TEXT,
  file_url    TEXT,
  file_size   INT,
  satuan      TEXT,
  uploaded_by UUID,
  created_at  TIMESTAMPTZ,
  uploader    JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.nama, d.kategori, d.file_url, d.file_size, d.satuan, d.uploaded_by, d.created_at,
    CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp) ELSE NULL END
  FROM public.documents d
  LEFT JOIN public.users u ON d.uploaded_by = u.id
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_document(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_nama        TEXT,
  p_kategori    TEXT    DEFAULT NULL,
  p_file_url    TEXT    DEFAULT NULL,
  p_satuan      TEXT    DEFAULT NULL,
  p_file_size   INTEGER DEFAULT NULL
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

  INSERT INTO public.documents (nama, kategori, file_url, satuan, file_size, uploaded_by)
  VALUES (p_nama, p_kategori, p_file_url, p_satuan, p_file_size, p_caller_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_document(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID
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

  DELETE FROM public.documents WHERE id = p_id;
END;
$$;

-- ============================================================
-- GRANT EXECUTE to anon role for all new functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.api_get_users(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_user(UUID, TEXT, UUID, JSONB) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_announcements(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_announcement(UUID, TEXT, TEXT, TEXT, UUID, TEXT[], TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_announcement(UUID, TEXT, UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.api_delete_announcement(UUID, TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_tasks(UUID, TEXT, UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_task(UUID, TEXT, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, INT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_task_status(UUID, TEXT, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_task_report(UUID, TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_latest_task_report(UUID, TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_attendance(UUID, TEXT, UUID, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_gate_passes(UUID, TEXT, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_gate_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_gate_pass_status(UUID, TEXT, UUID, TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_leave_requests(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_leave_request(UUID, TEXT, TEXT, DATE, DATE, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_leave_request_status(UUID, TEXT, UUID, TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_inbox(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_sent(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_message(UUID, TEXT, UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_mark_message_read(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.api_mark_all_messages_read(UUID, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_logistics_requests(UUID, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_logistics_request(UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_update_logistics_status(UUID, TEXT, UUID, TEXT, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_audit_logs(UUID, TEXT, UUID, TEXT, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION public.api_get_documents(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.api_insert_document(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.api_delete_document(UUID, TEXT, UUID) TO anon;
