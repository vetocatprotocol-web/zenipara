-- ============================================================
-- KARYO OS — Migration: Patch API Functions with Feature Flags (Part 1)
--
-- This migration patches the most critical API functions to call
-- is_feature_enabled() before returning data or allowing writes.
--
-- PATTERN:
-- - GET functions: IF NOT is_feature_enabled('feature_key') THEN RETURN; END IF;
--   (Returns empty results, UI will show empty state)
-- - INSERT/UPDATE/DELETE: IF NOT is_feature_enabled('feature_key') THEN RAISE EXCEPTION; END IF;
--   (Throws error, frontend catch block handles it)
--
-- Depends on: 20260418150000_enforce_feature_flags_in_api.sql (is_feature_enabled helper)
-- ============================================================

-- ============================================================
-- ANNOUNCEMENTS: Patch api_get_announcements
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
  IF NOT is_feature_enabled('announcements') THEN
    RETURN;
  END IF;

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

-- ============================================================
-- ANNOUNCEMENTS: Patch api_insert_announcement
-- ============================================================
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
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.announcements (judul, isi, created_by, target_role, target_satuan, is_pinned)
  VALUES (p_judul, p_isi, COALESCE(p_created_by, p_caller_id), p_target_role, p_target_satuan, p_is_pinned);
END;
$$;

-- ============================================================
-- ANNOUNCEMENTS: Patch api_update_announcement
-- ============================================================
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
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

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

-- ============================================================
-- ANNOUNCEMENTS: Patch api_delete_announcement
-- ============================================================
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
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.announcements WHERE id = p_id;
END;
$$;

-- ============================================================
-- TASKS: Patch api_get_tasks
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
  IF NOT is_feature_enabled('tasks') THEN
    RETURN;
  END IF;

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

-- ============================================================
-- TASKS: Patch api_insert_task
-- ============================================================
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
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.tasks (judul, deskripsi, assigned_to, assigned_by, deadline, prioritas, satuan, status)
  VALUES (p_judul, p_deskripsi, p_assigned_to, COALESCE(p_assigned_by, p_caller_id), p_deadline, p_prioritas, p_satuan, 'pending');
END;
$$;

-- ============================================================
-- TASKS: Patch api_update_task_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_update_task_status(
  p_caller_id  UUID,
  p_caller_role TEXT,
  p_task_id    UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid task status';
  END IF;

  IF p_caller_role = 'admin' THEN
    UPDATE public.tasks SET status = p_status, updated_at = NOW() WHERE id = p_task_id;
  ELSIF p_caller_role IN ('komandan', 'prajurit') THEN
    UPDATE public.tasks
    SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id AND (assigned_to = p_caller_id OR assigned_by = p_caller_id);
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;
END;
$$;

-- ============================================================
-- LEAVE REQUESTS: Patch api_get_leave_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_get_leave_requests(
  p_user_id UUID,
  p_role    TEXT,
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
  IF NOT is_feature_enabled('leave_requests') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    lr.id, lr.user_id, lr.jenis_izin, lr.tanggal_mulai, lr.tanggal_selesai,
    lr.alasan, lr.status, lr.reviewed_by, lr.reviewed_at, lr.created_at,
    CASE WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan) ELSE NULL END,
    CASE WHEN rv.id IS NOT NULL THEN json_build_object('id', rv.id, 'nama', rv.nama) ELSE NULL END
  FROM public.leave_requests lr
  LEFT JOIN public.users u ON lr.user_id = u.id
  LEFT JOIN public.users rv ON lr.reviewed_by = rv.id
  WHERE
    (p_role IN ('admin', 'komandan') AND (p_target_user_id IS NULL OR lr.user_id = p_target_user_id))
    OR (p_role NOT IN ('admin', 'komandan') AND lr.user_id = p_user_id)
  ORDER BY lr.created_at DESC;
END;
$$;

-- ============================================================
-- LEAVE REQUESTS: Patch api_insert_leave_request
-- ============================================================
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
  IF NOT is_feature_enabled('leave_requests') THEN
    RAISE EXCEPTION 'leave_requests feature is disabled';
  END IF;

  IF p_caller_role NOT IN ('admin', 'prajurit') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.leave_requests (user_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, status)
  VALUES (p_user_id, p_jenis_izin, p_tanggal_mulai, p_tanggal_selesai, p_alasan, 'pending');
END;
$$;

-- ============================================================
-- LEAVE REQUESTS: Patch api_update_leave_request_status
-- ============================================================
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
  IF NOT is_feature_enabled('leave_requests') THEN
    RAISE EXCEPTION 'leave_requests feature is disabled';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid leave request status';
  END IF;

  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.leave_requests
  SET status = p_status, reviewed_by = COALESCE(p_reviewed_by, p_caller_id), reviewed_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- NOTE: More patches to follow in subsequent migrations:
-- - gate_pass functions
-- - user management functions
-- - attendance functions
-- - audit_log functions
-- - document functions
-- - logistics functions
-- - message functions
-- ============================================================
