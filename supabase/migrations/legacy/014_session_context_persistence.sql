-- ============================================================
-- KARYO OS — Migration 014: Persist session context across requests
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
  -- Use is_local = FALSE so settings survive for the connection/session.
  PERFORM set_config('karyo.current_user_id', p_user_id::TEXT, FALSE);
  PERFORM set_config('karyo.current_user_role', p_role, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_session_context(UUID, TEXT) TO anon;