-- ============================================================
-- KARYO OS — Migration 022: Harden request context from headers
--
-- Root cause:
-- PostgREST uses pooled connections. If request context is not reset
-- on every request, stale values from previous requests can leak and
-- produce inconsistent RLS behavior.
--
-- Fix:
-- 1) Read user context from both header access patterns:
--    - request.header.x-karyo-user-*
--    - request.headers JSON object
-- 2) Always set (or clear) karyo.current_user_id/current_user_role
--    every request.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_request_context_from_headers()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_role TEXT;
  v_headers JSONB;
BEGIN
  v_user_id := NULLIF(current_setting('request.header.x-karyo-user-id', TRUE), '');
  v_role := NULLIF(current_setting('request.header.x-karyo-user-role', TRUE), '');

  IF v_user_id IS NULL OR v_role IS NULL THEN
    BEGIN
      v_headers := NULLIF(current_setting('request.headers', TRUE), '')::JSONB;
    EXCEPTION WHEN others THEN
      v_headers := NULL;
    END;

    IF v_user_id IS NULL AND v_headers IS NOT NULL THEN
      v_user_id := NULLIF(v_headers->>'x-karyo-user-id', '');
      IF v_user_id IS NULL THEN
        v_user_id := NULLIF(v_headers->>'X-Karyo-User-Id', '');
      END IF;
    END IF;

    IF v_role IS NULL AND v_headers IS NOT NULL THEN
      v_role := NULLIF(v_headers->>'x-karyo-user-role', '');
      IF v_role IS NULL THEN
        v_role := NULLIF(v_headers->>'X-Karyo-User-Role', '');
      END IF;
    END IF;
  END IF;

  PERFORM set_config('karyo.current_user_id', COALESCE(v_user_id, ''), TRUE);
  PERFORM set_config('karyo.current_user_role', COALESCE(v_role, ''), TRUE);
END;
$$;
