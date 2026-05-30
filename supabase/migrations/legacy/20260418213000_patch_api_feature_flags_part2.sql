-- ============================================================
-- KARYO OS — Security: Feature flags part 2 + auth hardening
--
-- Adds is_feature_enabled() guards to all remaining API functions
-- that were skipped in part 1 (20260418151000).
--
-- Additional auth fixes bundled here:
-- a) api_insert_message: enforce from_user = caller (prevent spoofing)
-- b) api_insert_logistics_request: restrict to komandan/admin
-- c) api_insert_task_report: verify caller is task assignee or mgmt
-- d) api_get_latest_task_report: add role-based access control
-- e) server_checkin / server_checkout: verify caller owns the record
-- ============================================================

-- ============================================================
-- USER MANAGEMENT: api_update_user
-- ============================================================
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
DECLARE
  v_new_role TEXT;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate role value if being updated
  v_new_role := p_updates->>'role';
  IF v_new_role IS NOT NULL AND v_new_role NOT IN ('admin', 'komandan', 'prajurit', 'guard') THEN
    RAISE EXCEPTION 'Invalid role: %', v_new_role;
  END IF;

  UPDATE public.users
  SET
    nama       = COALESCE((p_updates->>'nama')::TEXT,        nama),
    role       = COALESCE(v_new_role,                        role),
    pangkat    = COALESCE((p_updates->>'pangkat')::TEXT,     pangkat),
    jabatan    = COALESCE((p_updates->>'jabatan')::TEXT,     jabatan),
    satuan     = COALESCE((p_updates->>'satuan')::TEXT,      satuan),
    is_active  = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
    foto_url   = COALESCE((p_updates->>'foto_url')::TEXT,    foto_url),
    updated_at = NOW()
  WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- USER MANAGEMENT: api_delete_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_delete_user(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_target_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target_role TEXT;
  v_admin_count INTEGER;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  IF p_caller_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  IF p_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_caller_id = p_target_id THEN
    RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  IF v_target_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.users WHERE role = 'admin' AND is_active = TRUE;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Admin terakhir tidak boleh dihapus';
    END IF;
  END IF;

  DELETE FROM public.users WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- ATTENDANCE: api_get_attendance
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_get_attendance(
  p_user_id        UUID,
  p_role           TEXT,
  p_target_user_id UUID    DEFAULT NULL,
  p_limit          INTEGER DEFAULT 30
)
RETURNS TABLE (
  id         UUID,
  user_id    UUID,
  tanggal    DATE,
  check_in   TIMESTAMPTZ,
  check_out  TIMESTAMPTZ,
  status     TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ,
  "user"     JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target UUID;
BEGIN
  IF NOT is_feature_enabled('attendance') THEN
    RETURN;
  END IF;

  IF p_role IN ('admin', 'komandan') THEN
    v_target := p_target_user_id;
  ELSE
    -- Prajurit/guard can only see their own attendance
    v_target := p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.user_id, a.tanggal, a.check_in, a.check_out,
    a.status, a.keterangan, a.created_at,
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
-- AUDIT LOGS: api_get_audit_logs
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
  IF NOT is_feature_enabled('audit_log') THEN
    RETURN;
  END IF;

  IF p_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    al.id, al.user_id, al.action, al.resource, al.resource_id,
    al.detail, al.ip_address, al.user_agent, al.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'role', u.role)
      ELSE NULL
    END
  FROM public.audit_logs al
  LEFT JOIN public.users u ON al.user_id = u.id
  WHERE (p_filter_user_id IS NULL OR al.user_id = p_filter_user_id)
    AND (p_action_filter IS NULL OR al.action = p_action_filter)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- DOCUMENTS: api_get_documents
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
  IF NOT is_feature_enabled('documents') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.nama, d.kategori, d.file_url, d.file_size, d.satuan, d.uploaded_by, d.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp)
      ELSE NULL
    END
  FROM public.documents d
  LEFT JOIN public.users u ON d.uploaded_by = u.id
  ORDER BY d.created_at DESC;
END;
$$;

-- ============================================================
-- DOCUMENTS: api_insert_document
-- ============================================================
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
  IF NOT is_feature_enabled('documents') THEN
    RAISE EXCEPTION 'documents feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.documents (nama, kategori, file_url, satuan, file_size, uploaded_by)
  VALUES (p_nama, p_kategori, p_file_url, p_satuan, p_file_size, p_caller_id);
END;
$$;

-- ============================================================
-- DOCUMENTS: api_delete_document
-- ============================================================
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
  IF NOT is_feature_enabled('documents') THEN
    RAISE EXCEPTION 'documents feature is disabled';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.documents WHERE id = p_id;
END;
$$;

-- ============================================================
-- LOGISTICS: api_get_logistics_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_get_logistics_requests(
  p_user_id       UUID,
  p_role          TEXT,
  p_satuan_filter TEXT DEFAULT NULL,
  p_requested_by  UUID DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  requested_by UUID,
  satuan       TEXT,
  nama_item    TEXT,
  jumlah       INT,
  satuan_item  TEXT,
  alasan       TEXT,
  status       TEXT,
  admin_note   TEXT,
  reviewed_by  UUID,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  requester    JSON,
  reviewer     JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RETURN;
  END IF;

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
    -- komandan and others: see their own requests only
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

-- ============================================================
-- LOGISTICS: api_insert_logistics_request
-- Previously had no auth check — any caller could insert.
-- Fix: restrict to komandan and admin only.
-- ============================================================
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
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;

  IF p_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.logistics_requests (requested_by, satuan, nama_item, jumlah, satuan_item, alasan, status)
  VALUES (p_caller_id, p_satuan, p_nama_item, p_jumlah, p_satuan_item, p_alasan, 'pending');
END;
$$;

-- ============================================================
-- LOGISTICS: api_update_logistics_status
-- ============================================================
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
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid logistics status';
  END IF;

  IF p_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.logistics_requests
  SET status      = p_status,
      admin_note  = p_admin_note,
      reviewed_by = p_caller_id,
      reviewed_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- MESSAGES: api_get_inbox
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
  IF NOT is_feature_enabled('messages') THEN
    RETURN;
  END IF;

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

-- ============================================================
-- MESSAGES: api_get_sent
-- ============================================================
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
  IF NOT is_feature_enabled('messages') THEN
    RETURN;
  END IF;

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

-- ============================================================
-- MESSAGES: api_insert_message
-- Previously allowed p_from_user to be any UUID (sender spoofing).
-- Fix: enforce that from_user must equal the authenticated caller.
-- ============================================================
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
  IF NOT is_feature_enabled('messages') THEN
    RAISE EXCEPTION 'messages feature is disabled';
  END IF;

  -- Prevent sender impersonation: from_user must match caller
  IF p_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_from_user <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot send message on behalf of another user';
  END IF;

  IF p_to_user IS NULL OR p_isi IS NULL OR btrim(p_isi) = '' THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  INSERT INTO public.messages (from_user, to_user, isi)
  VALUES (p_caller_id, p_to_user, p_isi);
END;
$$;

-- ============================================================
-- MESSAGES: api_mark_message_read
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_mark_message_read(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_message_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('messages') THEN
    RAISE EXCEPTION 'messages feature is disabled';
  END IF;

  -- Only mark messages where the caller is the recipient
  UPDATE public.messages
  SET is_read = TRUE
  WHERE id = p_message_id AND to_user = p_caller_id;
END;
$$;

-- ============================================================
-- MESSAGES: api_mark_all_messages_read
-- ============================================================
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
  IF NOT is_feature_enabled('messages') THEN
    RAISE EXCEPTION 'messages feature is disabled';
  END IF;

  UPDATE public.messages
  SET is_read = TRUE
  WHERE to_user = p_caller_id AND is_read = FALSE;
END;
$$;

-- ============================================================
-- TASKS: api_insert_task_report
-- Previously had no auth check — any caller could insert a report
-- for any task.
-- Fix: prajurit/guard may only report on tasks assigned to them;
-- admin and komandan may insert for any task.
-- ============================================================
CREATE OR REPLACE FUNCTION public.api_insert_task_report(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_task_id     UUID,
  p_isi_laporan TEXT,
  p_file_url    TEXT DEFAULT NULL
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
    -- Prajurit/guard may only report on tasks assigned to them
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks WHERE id = p_task_id AND assigned_to = p_caller_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: task not assigned to you';
    END IF;
  END IF;

  INSERT INTO public.task_reports (task_id, user_id, isi_laporan, file_url)
  VALUES (p_task_id, p_caller_id, p_isi_laporan, p_file_url);
END;
$$;

-- ============================================================
-- TASKS: api_get_latest_task_report
-- Previously had no auth check.
-- Fix: prajurit may only read reports for tasks assigned to them;
-- admin and komandan can read any.
-- ============================================================
DROP FUNCTION IF EXISTS public.api_get_latest_task_report(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.api_get_latest_task_report(
  p_user_id UUID,
  p_role    TEXT,
  p_task_id UUID
)
RETURNS TABLE (
  id           UUID,
  task_id      UUID,
  user_id      UUID,
  isi_laporan  TEXT,
  file_url     TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RETURN;
  END IF;

  IF p_role NOT IN ('admin', 'komandan') THEN
    -- Prajurit may only read reports for their assigned tasks
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks WHERE id = p_task_id AND assigned_to = p_user_id
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT tr.id, tr.task_id, tr.user_id, tr.isi_laporan, tr.file_url, tr.submitted_at
  FROM public.task_reports tr
  WHERE tr.task_id = p_task_id
  ORDER BY tr.submitted_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- ATTENDANCE: server_checkin
-- Previously had no caller verification — any actor who knew a
-- user's UUID could check that user in.
-- Fix: only the user themselves or an admin may call this.
-- ============================================================
CREATE OR REPLACE FUNCTION public.server_checkin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_today     DATE := CURRENT_DATE;
  v_existing  public.attendance%ROWTYPE;
  v_result    public.attendance%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Caller must be checking in themselves, or be an admin
  IF v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.attendance
  WHERE user_id = p_user_id AND tanggal = v_today;

  IF FOUND THEN
    IF v_existing.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'Sudah check-in hari ini';
    END IF;
    UPDATE public.attendance
    SET check_in = NOW(), status = 'hadir'
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.attendance (user_id, tanggal, check_in, status)
    VALUES (p_user_id, v_today, NOW(), 'hadir')
    RETURNING * INTO v_result;
  END IF;

  RETURN jsonb_build_object(
    'id',       v_result.id,
    'tanggal',  v_result.tanggal,
    'check_in', v_result.check_in,
    'status',   v_result.status
  );
END;
$$;

-- ============================================================
-- ATTENDANCE: server_checkout
-- Same fix: caller must own the attendance record or be admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.server_checkout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_today     DATE := CURRENT_DATE;
  v_existing  public.attendance%ROWTYPE;
  v_result    public.attendance%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.attendance
  WHERE user_id = p_user_id AND tanggal = v_today;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Belum check-in hari ini';
  END IF;

  IF v_existing.check_in IS NULL THEN
    RAISE EXCEPTION 'Belum check-in hari ini';
  END IF;

  IF v_existing.check_out IS NOT NULL THEN
    RAISE EXCEPTION 'Sudah check-out hari ini';
  END IF;

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE id = v_existing.id
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id',        v_result.id,
    'tanggal',   v_result.tanggal,
    'check_in',  v_result.check_in,
    'check_out', v_result.check_out,
    'status',    v_result.status
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
