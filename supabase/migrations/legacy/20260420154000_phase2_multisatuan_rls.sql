-- ============================================================
-- KARYO OS — Phase 2: Multi-Satuan RLS hardening
--
-- This migration upgrades row-level security to prefer `satuan_id`
-- while still allowing legacy rows that only have text `satuan`.
-- It is intentionally backward-compatible and avoids recursive
-- self-lookups by using SECURITY DEFINER helpers.
-- ============================================================

-- ============================================================
-- HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_karyo_satuan_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_satuan_id UUID;
BEGIN
  SELECT u.satuan_id INTO v_satuan_id
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id();

  RETURN v_satuan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_karyo_satuan_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_karyo_satuan_id() TO anon;
GRANT EXECUTE ON FUNCTION public.current_karyo_satuan_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_in_same_satuan(
  p_user_id UUID,
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

  IF p_user_id = public.current_karyo_user_id() THEN
    RETURN TRUE;
  END IF;

  IF v_current_satuan_id IS NOT NULL AND p_satuan_id IS NOT NULL THEN
    RETURN p_satuan_id = v_current_satuan_id;
  END IF;

  IF v_current_satuan_text IS NOT NULL AND p_satuan_text IS NOT NULL THEN
    RETURN BTRIM(p_satuan_text) = BTRIM(v_current_satuan_text);
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.user_in_same_satuan(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_in_same_satuan(UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.user_in_same_satuan(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- POLICY REPLACEMENT: remove legacy production policies
-- ============================================================
DROP POLICY IF EXISTS "users_komandan_read_satuan" ON public.users;
DROP POLICY IF EXISTS "tasks_komandan_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_prajurit_assigned" ON public.tasks;
DROP POLICY IF EXISTS "tasks_prajurit_update_status" ON public.tasks;
DROP POLICY IF EXISTS "attendance_komandan_read_satuan" ON public.attendance;
DROP POLICY IF EXISTS "leave_requests_komandan_read_approve" ON public.leave_requests;
DROP POLICY IF EXISTS "messages_own" ON public.messages;
DROP POLICY IF EXISTS "announcements_read_all" ON public.announcements;
DROP POLICY IF EXISTS "logistics_requests_komandan_own" ON public.logistics_requests;
DROP POLICY IF EXISTS "documents_read_authenticated" ON public.documents;
DROP POLICY IF EXISTS "discipline_notes_komandan_own_satuan" ON public.discipline_notes;

-- ============================================================
-- USERS
-- ============================================================
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
DROP POLICY IF EXISTS "users_komandan_read_satuan_v2" ON public.users;
DROP POLICY IF EXISTS "users_prajurit_own" ON public.users;
DROP POLICY IF EXISTS "users_login_rpc" ON public.users;
CREATE POLICY "users_admin_all"
  ON public.users FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "users_komandan_read_satuan_v2"
  ON public.users FOR SELECT TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND public.user_in_same_satuan(id, satuan_id, satuan)
  );

CREATE POLICY "users_prajurit_own"
  ON public.users FOR SELECT TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND id = public.current_karyo_user_id()
  );

CREATE POLICY "users_login_rpc"
  ON public.users FOR SELECT TO anon
  USING (public.current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- TASKS
-- ============================================================
DROP POLICY IF EXISTS "tasks_admin_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_komandan_own_v2" ON public.tasks;
DROP POLICY IF EXISTS "tasks_prajurit_assigned_v2" ON public.tasks;
DROP POLICY IF EXISTS "tasks_prajurit_update_status_v2" ON public.tasks;
CREATE POLICY "tasks_admin_all"
  ON public.tasks FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "tasks_komandan_own_v2"
  ON public.tasks FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND assigned_by = public.current_karyo_user_id()
    AND public.user_in_same_satuan(assigned_by, satuan_id, satuan)
  )
  WITH CHECK (
    public.current_karyo_role() = 'komandan'
    AND assigned_by = public.current_karyo_user_id()
    AND public.user_in_same_satuan(assigned_by, satuan_id, satuan)
  );

CREATE POLICY "tasks_prajurit_assigned_v2"
  ON public.tasks FOR SELECT TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND assigned_to = public.current_karyo_user_id()
    AND public.user_in_same_satuan(assigned_to, satuan_id, satuan)
  );

CREATE POLICY "tasks_prajurit_update_status_v2"
  ON public.tasks FOR UPDATE TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND assigned_to = public.current_karyo_user_id()
    AND public.user_in_same_satuan(assigned_to, satuan_id, satuan)
  )
  WITH CHECK (
    public.current_karyo_role() = 'prajurit'
    AND assigned_to = public.current_karyo_user_id()
    AND public.user_in_same_satuan(assigned_to, satuan_id, satuan)
  );

-- ============================================================
-- ATTENDANCE
-- ============================================================
DROP POLICY IF EXISTS "attendance_admin_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_komandan_read_satuan_v2" ON public.attendance;
DROP POLICY IF EXISTS "attendance_prajurit_own_v2" ON public.attendance;
CREATE POLICY "attendance_admin_all"
  ON public.attendance FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "attendance_komandan_read_satuan_v2"
  ON public.attendance FOR SELECT TO anon
  USING (
    public.current_karyo_role() IN ('komandan', 'admin')
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );

CREATE POLICY "attendance_prajurit_own_v2"
  ON public.attendance FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND user_id = public.current_karyo_user_id()
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  )
  WITH CHECK (
    public.current_karyo_role() = 'prajurit'
    AND user_id = public.current_karyo_user_id()
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
DROP POLICY IF EXISTS "leave_requests_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_komandan_read_approve_v2" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_prajurit_own_v2" ON public.leave_requests;
CREATE POLICY "leave_requests_admin_all"
  ON public.leave_requests FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "leave_requests_komandan_read_approve_v2"
  ON public.leave_requests FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  )
  WITH CHECK (
    public.current_karyo_role() = 'komandan'
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );

CREATE POLICY "leave_requests_prajurit_own_v2"
  ON public.leave_requests FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND user_id = public.current_karyo_user_id()
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  )
  WITH CHECK (
    public.current_karyo_role() = 'prajurit'
    AND user_id = public.current_karyo_user_id()
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );

-- ============================================================
-- MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "messages_own_v2" ON public.messages;
CREATE POLICY "messages_own_v2"
  ON public.messages FOR ALL TO anon
  USING (
    public.user_in_same_satuan(from_user, satuan_id, NULL)
    AND (
      from_user = public.current_karyo_user_id()
      OR to_user = public.current_karyo_user_id()
    )
  )
  WITH CHECK (
    from_user = public.current_karyo_user_id()
    AND public.user_in_same_satuan(from_user, satuan_id, NULL)
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
DROP POLICY IF EXISTS "announcements_read_satuan_v2" ON public.announcements;
CREATE POLICY "announcements_admin_all"
  ON public.announcements FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "announcements_read_satuan_v2"
  ON public.announcements FOR SELECT TO anon
  USING (
    public.current_karyo_user_id() IS NOT NULL
    AND (
      satuan_id IS NULL
      OR public.user_in_same_satuan(created_by, satuan_id, target_satuan)
      OR target_satuan IS NULL
    )
  );

-- ============================================================
-- LOGISTICS REQUESTS
-- ============================================================
DROP POLICY IF EXISTS "logistics_requests_admin_all" ON public.logistics_requests;
DROP POLICY IF EXISTS "logistics_requests_komandan_own_v2" ON public.logistics_requests;
CREATE POLICY "logistics_requests_admin_all"
  ON public.logistics_requests FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "logistics_requests_komandan_own_v2"
  ON public.logistics_requests FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND requested_by = public.current_karyo_user_id()
    AND public.user_in_same_satuan(requested_by, satuan_id, satuan)
  )
  WITH CHECK (
    public.current_karyo_role() = 'komandan'
    AND requested_by = public.current_karyo_user_id()
    AND public.user_in_same_satuan(requested_by, satuan_id, satuan)
  );

-- ============================================================
-- DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
DROP POLICY IF EXISTS "documents_read_authenticated_v2" ON public.documents;
CREATE POLICY "documents_admin_all"
  ON public.documents FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "documents_read_authenticated_v2"
  ON public.documents FOR SELECT TO anon
  USING (
    public.current_karyo_user_id() IS NOT NULL
    AND (satuan_id IS NULL OR public.user_in_same_satuan(uploaded_by, satuan_id, satuan))
  );

-- ============================================================
-- DISCIPLINE NOTES
-- ============================================================
DROP POLICY IF EXISTS "discipline_notes_admin_all" ON public.discipline_notes;
DROP POLICY IF EXISTS "discipline_notes_komandan_own_satuan_v2" ON public.discipline_notes;
DROP POLICY IF EXISTS "discipline_notes_prajurit_own_v2" ON public.discipline_notes;
CREATE POLICY "discipline_notes_admin_all"
  ON public.discipline_notes FOR ALL TO anon
  USING (public.current_karyo_role() = 'admin')
  WITH CHECK (public.current_karyo_role() = 'admin');

CREATE POLICY "discipline_notes_komandan_own_satuan_v2"
  ON public.discipline_notes FOR ALL TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  )
  WITH CHECK (
    public.current_karyo_role() = 'komandan'
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );

CREATE POLICY "discipline_notes_prajurit_own_v2"
  ON public.discipline_notes FOR SELECT TO anon
  USING (
    public.current_karyo_role() = 'prajurit'
    AND user_id = public.current_karyo_user_id()
    AND public.user_in_same_satuan(user_id, satuan_id, NULL)
  );
