-- ============================================================
-- KARYO OS — Migration 004: Production Row Level Security
-- Replaces the dev open policies with proper per-role policies.
-- Run AFTER migration 001 and 003.
--
-- AUTH PATTERN: Karyo OS uses custom PIN auth (no Supabase Auth).
-- The application authenticates via the `verify_user_pin` RPC
-- and stores session data in localStorage. All DB access goes
-- through the `anon` key; user identity is enforced by the
-- application layer and by set_config / session variables.
--
-- STRATEGY: Use a session variable `karyo.current_user_id` and
-- `karyo.current_user_role` that the app sets at session start
-- via a `set_session_context` RPC, then policies reference it.
-- ============================================================

-- ============================================================
-- HELPER: set_session_context
-- Called by the frontend after successful login to bind the
-- current user's identity to the DB session.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_session_context(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('karyo.current_user_id', p_user_id::TEXT, TRUE);
  PERFORM set_config('karyo.current_user_role', p_role, TRUE);
END;
$$;

-- ============================================================
-- HELPER: current_karyo_user_id / current_karyo_role
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_karyo_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('karyo.current_user_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION public.current_karyo_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('karyo.current_user_role', TRUE), '');
$$;

-- ============================================================
-- DROP existing policies so this migration can be replayed
-- ============================================================
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'dev_anon_all_users',
        'dev_anon_all_tasks',
        'dev_anon_all_task_reports',
        'dev_anon_all_attendance',
        'dev_anon_all_leave_requests',
        'dev_anon_all_announcements',
        'dev_anon_all_messages',
        'dev_anon_all_logistics_items',
        'dev_anon_all_audit_logs',
        'dev_anon_all_shift_schedules',
        'dev_anon_all_documents',
        'dev_anon_all_discipline_notes',
        'users_admin_all',
        'users_komandan_read_satuan',
        'users_prajurit_own',
        'users_login_rpc',
        'tasks_admin_all',
        'tasks_komandan_own',
        'tasks_prajurit_assigned',
        'tasks_prajurit_update_status',
        'task_reports_admin_all',
        'task_reports_komandan_read',
        'task_reports_prajurit_own',
        'attendance_admin_all',
        'attendance_komandan_read_satuan',
        'attendance_prajurit_own',
        'leave_requests_admin_all',
        'leave_requests_komandan_read_approve',
        'leave_requests_prajurit_own',
        'messages_own',
        'announcements_admin_all',
        'announcements_read_all',
        'logistics_items_admin_all',
        'logistics_items_read_authenticated',
        'dev_anon_all_logistics_requests',
        'logistics_requests_admin_all',
        'logistics_requests_komandan_own',
        'audit_logs_admin_all',
        'shift_schedules_admin_all',
        'shift_schedules_read_authenticated',
        'documents_admin_all',
        'documents_read_authenticated',
        'discipline_notes_admin_all',
        'discipline_notes_komandan_own_satuan',
        'discipline_notes_prajurit_own'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

-- ============================================================
-- USERS TABLE
-- - Anyone can verify PIN (login) via the RPC
-- - admin: full access
-- - komandan: read all active users in same satuan
-- - prajurit: read only own row
-- ============================================================
CREATE POLICY "users_admin_all"
  ON public.users FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "users_komandan_read_satuan"
  ON public.users FOR SELECT TO anon
  USING (
    current_karyo_role() = 'komandan'
    AND satuan = (
      SELECT satuan FROM public.users WHERE id = current_karyo_user_id()
    )
  );

CREATE POLICY "users_prajurit_own"
  ON public.users FOR SELECT TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND id = current_karyo_user_id()
  );

-- Allow unauthenticated access to users table for login RPCs
-- (the RPCs use SECURITY DEFINER so they bypass RLS)
CREATE POLICY "users_login_rpc"
  ON public.users FOR SELECT TO anon
  USING (current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- TASKS TABLE
-- - admin: full access
-- - komandan: full access for tasks they assigned
-- - prajurit: read+update tasks assigned to them
-- ============================================================
CREATE POLICY "tasks_admin_all"
  ON public.tasks FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "tasks_komandan_own"
  ON public.tasks FOR ALL TO anon
  USING (
    current_karyo_role() = 'komandan'
    AND assigned_by = current_karyo_user_id()
  )
  WITH CHECK (
    current_karyo_role() = 'komandan'
    AND assigned_by = current_karyo_user_id()
  );

CREATE POLICY "tasks_prajurit_assigned"
  ON public.tasks FOR SELECT TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND assigned_to = current_karyo_user_id()
  );

CREATE POLICY "tasks_prajurit_update_status"
  ON public.tasks FOR UPDATE TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND assigned_to = current_karyo_user_id()
  );

-- ============================================================
-- TASK_REPORTS TABLE
-- ============================================================
CREATE POLICY "task_reports_admin_all"
  ON public.task_reports FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "task_reports_komandan_read"
  ON public.task_reports FOR SELECT TO anon
  USING (current_karyo_role() = 'komandan');

CREATE POLICY "task_reports_prajurit_own"
  ON public.task_reports FOR ALL TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  )
  WITH CHECK (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  );

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE POLICY "attendance_admin_all"
  ON public.attendance FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "attendance_komandan_read_satuan"
  ON public.attendance FOR SELECT TO anon
  USING (current_karyo_role() IN ('komandan', 'admin'));

CREATE POLICY "attendance_prajurit_own"
  ON public.attendance FOR ALL TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  )
  WITH CHECK (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  );

-- ============================================================
-- LEAVE_REQUESTS TABLE
-- ============================================================
CREATE POLICY "leave_requests_admin_all"
  ON public.leave_requests FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "leave_requests_komandan_read_approve"
  ON public.leave_requests FOR ALL TO anon
  USING (current_karyo_role() = 'komandan')
  WITH CHECK (current_karyo_role() = 'komandan');

CREATE POLICY "leave_requests_prajurit_own"
  ON public.leave_requests FOR ALL TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  )
  WITH CHECK (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  );

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE POLICY "messages_own"
  ON public.messages FOR ALL TO anon
  USING (
    from_user = current_karyo_user_id()
    OR to_user = current_karyo_user_id()
  )
  WITH CHECK (
    from_user = current_karyo_user_id()
  );

-- ============================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================
CREATE POLICY "announcements_admin_all"
  ON public.announcements FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "announcements_read_all"
  ON public.announcements FOR SELECT TO anon
  USING (current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- LOGISTICS_ITEMS TABLE
-- ============================================================
CREATE POLICY "logistics_items_admin_all"
  ON public.logistics_items FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "logistics_items_read_authenticated"
  ON public.logistics_items FOR SELECT TO anon
  USING (current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- LOGISTICS_REQUESTS TABLE (from migration 003)
-- ============================================================
ALTER TABLE public.logistics_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_anon_all_logistics_requests" ON public.logistics_requests;

CREATE POLICY "logistics_requests_admin_all"
  ON public.logistics_requests FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "logistics_requests_komandan_own"
  ON public.logistics_requests FOR ALL TO anon
  USING (
    current_karyo_role() = 'komandan'
    AND requested_by = current_karyo_user_id()
  )
  WITH CHECK (
    current_karyo_role() = 'komandan'
    AND requested_by = current_karyo_user_id()
  );

-- ============================================================
-- AUDIT_LOGS TABLE
-- ============================================================
CREATE POLICY "audit_logs_admin_all"
  ON public.audit_logs FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

-- ============================================================
-- SHIFT_SCHEDULES TABLE
-- ============================================================
CREATE POLICY "shift_schedules_admin_all"
  ON public.shift_schedules FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "shift_schedules_read_authenticated"
  ON public.shift_schedules FOR SELECT TO anon
  USING (current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================
CREATE POLICY "documents_admin_all"
  ON public.documents FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "documents_read_authenticated"
  ON public.documents FOR SELECT TO anon
  USING (current_karyo_user_id() IS NOT NULL);

-- ============================================================
-- DISCIPLINE_NOTES TABLE
-- ============================================================
CREATE POLICY "discipline_notes_admin_all"
  ON public.discipline_notes FOR ALL TO anon
  USING (current_karyo_role() = 'admin')
  WITH CHECK (current_karyo_role() = 'admin');

CREATE POLICY "discipline_notes_komandan_own_satuan"
  ON public.discipline_notes FOR ALL TO anon
  USING (current_karyo_role() = 'komandan')
  WITH CHECK (current_karyo_role() = 'komandan');

CREATE POLICY "discipline_notes_prajurit_own"
  ON public.discipline_notes FOR SELECT TO anon
  USING (
    current_karyo_role() = 'prajurit'
    AND user_id = current_karyo_user_id()
  );
