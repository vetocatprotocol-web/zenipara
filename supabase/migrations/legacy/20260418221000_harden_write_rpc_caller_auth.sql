-- ============================================================
-- KARYO OS — Security: Harden write RPC caller identity
--
-- Problems fixed:
-- All write API functions below accepted p_caller_id / p_caller_role
-- purely from the client without verifying against the actual
-- authenticated session.  A client who knew an admin's UUID could
-- pass it as p_caller_id and p_caller_role='admin' to bypass role
-- checks.
--
-- Fix applied uniformly:
-- 1) Read the actual session identity via current_karyo_user_id().
--    This value is set by the db_pre_request hook from the
--    x-karyo-user-id HTTP header supplied by sessionAwareFetch.
-- 2) Reject the request if the session is absent (Unauthenticated).
-- 3) Verify the caller's role and active status directly in the DB
--    instead of trusting the client-supplied p_caller_role string.
-- 4) Where the function also accepts p_caller_id, cross-check that
--    the session identity matches the claimed caller.
--
-- Functions hardened in this migration:
--   api_update_user          (admin only)
--   api_delete_user          (admin only)
--   api_update_gate_pass_status  (admin / komandan / guard)
--   api_insert_gate_pass     (self only, or admin)
--   api_insert_leave_request (self only, or admin)
--   api_update_leave_request_status (admin / komandan)
--   api_update_logistics_status     (admin only)
--   api_insert_announcement  (admin / komandan)
--   api_update_announcement  (admin only)
--   api_delete_announcement  (admin only)
--   api_insert_task          (admin / komandan)
--   api_update_task_status   (assigned prajurit, admin, or komandan)
-- ============================================================

-- ── api_update_user ─────────────────────────────────────────────
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
  v_caller_id UUID;
  v_new_role  TEXT;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify admin role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
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

-- ── api_delete_user ─────────────────────────────────────────────
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
  v_caller_id   UUID;
  v_target_role TEXT;
  v_admin_count INTEGER;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  IF p_caller_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify admin role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
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

-- ── api_insert_gate_pass ────────────────────────────────────────
-- Prajurit may only create a gate pass for themselves.
-- Admin may create for any user.
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Only allow creating a gate pass for self, unless admin
  IF v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized: tidak dapat membuat gate pass untuk orang lain';
    END IF;
  END IF;

  INSERT INTO public.gate_pass (user_id, keperluan, tujuan, waktu_keluar, waktu_kembali, qr_token, status)
  VALUES (p_user_id, p_keperluan, p_tujuan, p_waktu_keluar, p_waktu_kembali, p_qr_token, 'pending');
END;
$$;

-- ── api_update_gate_pass_status ─────────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'komandan', 'guard') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: akses ditolak';
  END IF;

  UPDATE public.gate_pass
  SET status = p_status::gate_pass_status,
      approved_by = COALESCE(p_approved_by, approved_by)
  WHERE id = p_id;
END;
$$;

-- ── api_insert_leave_request ────────────────────────────────────
-- Users may only submit leave requests for themselves.
-- Admin may submit for any user.
CREATE OR REPLACE FUNCTION public.api_insert_leave_request(
  p_user_id         UUID,
  p_caller_role     TEXT,
  p_jenis_izin      TEXT,
  p_tanggal_mulai   DATE,
  p_tanggal_selesai DATE,
  p_alasan          TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('leave_requests') THEN
    RAISE EXCEPTION 'leave_requests feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Only allow submitting for self, unless admin
  IF v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized: tidak dapat membuat izin untuk orang lain';
    END IF;
  END IF;

  IF p_jenis_izin NOT IN ('cuti', 'sakit', 'dinas_luar') THEN
    RAISE EXCEPTION 'Invalid jenis izin: %', p_jenis_izin;
  END IF;

  INSERT INTO public.leave_requests (user_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, status)
  VALUES (p_user_id, p_jenis_izin, p_tanggal_mulai, p_tanggal_selesai, p_alasan, 'pending');
END;
$$;

-- ── api_update_leave_request_status ────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('leave_requests') THEN
    RAISE EXCEPTION 'leave_requests feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'komandan') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan yang dapat memproses izin';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.leave_requests
  SET status = p_status, reviewed_by = v_caller_id, reviewed_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ── api_update_logistics_status ─────────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('logistics') THEN
    RAISE EXCEPTION 'logistics feature is disabled';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid logistics status';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify admin role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.logistics_requests
  SET status      = p_status,
      admin_note  = p_admin_note,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_id;
END;
$$;

-- ── api_insert_announcement ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.api_insert_announcement(
  p_caller_id     UUID,
  p_caller_role   TEXT,
  p_judul         TEXT,
  p_isi           TEXT,
  p_created_by    UUID    DEFAULT NULL,
  p_target_role   TEXT[]  DEFAULT NULL,
  p_target_satuan TEXT    DEFAULT NULL,
  p_is_pinned     BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'komandan') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: akses ditolak';
  END IF;

  INSERT INTO public.announcements (judul, isi, created_by, target_role, target_satuan, is_pinned)
  VALUES (p_judul, p_isi, COALESCE(p_created_by, v_caller_id), p_target_role, p_target_satuan, p_is_pinned);
END;
$$;

-- ── api_update_announcement ─────────────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify admin role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
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

-- ── api_delete_announcement ─────────────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify admin role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  DELETE FROM public.announcements WHERE id = p_id;
END;
$$;

-- ── api_insert_task ─────────────────────────────────────────────
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
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Verify role in DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'komandan') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan yang dapat membuat tugas';
  END IF;

  INSERT INTO public.tasks (judul, deskripsi, assigned_to, assigned_by, deadline, prioritas, satuan, status)
  VALUES (p_judul, p_deskripsi, p_assigned_to, COALESCE(p_assigned_by, v_caller_id), p_deadline, p_prioritas, p_satuan, 'pending');
END;
$$;

-- ── api_update_task_status ──────────────────────────────────────
-- Prajurit may only update tasks assigned to them.
-- Admin and komandan may update any task.
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
DECLARE
  v_caller_id UUID;
  v_caller_db_role TEXT;
BEGIN
  IF NOT is_feature_enabled('tasks') THEN
    RAISE EXCEPTION 'tasks feature is disabled';
  END IF;

  -- Bind to real session identity
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Cross-check claimed identity
  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Fetch actual role from DB
  SELECT role INTO v_caller_db_role
  FROM public.users
  WHERE id = v_caller_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'completed', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid task status: %', p_status;
  END IF;

  IF v_caller_db_role IN ('prajurit', 'guard') THEN
    -- Prajurit/guard can only update tasks assigned to them
    UPDATE public.tasks SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id AND assigned_to = v_caller_id;
  ELSE
    -- Admin/komandan can update any task
    UPDATE public.tasks SET status = p_status, updated_at = NOW()
    WHERE id = p_task_id;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
