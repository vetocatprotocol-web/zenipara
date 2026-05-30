-- ============================================================
-- KARYO OS — Migration 019: Set RLS context from request headers
-- This makes the current user context available on every request
-- when the frontend sends x-karyo-user-id and x-karyo-user-role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_request_context_from_headers()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_role TEXT;
BEGIN
  v_user_id := NULLIF(current_setting('request.header.x-karyo-user-id', TRUE), '');
  v_role := NULLIF(current_setting('request.header.x-karyo-user-role', TRUE), '');

  IF v_user_id IS NOT NULL THEN
    PERFORM set_config('karyo.current_user_id', v_user_id, TRUE);
  END IF;

  IF v_role IS NOT NULL THEN
    PERFORM set_config('karyo.current_user_role', v_role, TRUE);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_request_context_from_headers() TO anon;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.set_request_context_from_headers';
