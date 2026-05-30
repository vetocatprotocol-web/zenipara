-- ============================================================
-- KARYO OS — Migration 021: Fix infinite recursion in users RLS
--
-- Root cause:
-- The previous "users_komandan_read_satuan" policy queried
-- public.users inside its USING clause:
--   satuan = (SELECT satuan FROM public.users WHERE id = current_karyo_user_id())
-- That self-reference can trigger recursive policy evaluation and
-- causes PostgREST requests to fail with HTTP 500.
--
-- Fix:
-- Move the lookup into a SECURITY DEFINER helper so it bypasses RLS
-- for the lookup, then reference that helper from the policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_karyo_satuan()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_satuan TEXT;
BEGIN
  SELECT u.satuan INTO v_satuan
  FROM public.users u
  WHERE u.id = public.current_karyo_user_id();

  RETURN v_satuan;
END;
$$;

REVOKE ALL ON FUNCTION public.current_karyo_satuan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_karyo_satuan() TO anon;
GRANT EXECUTE ON FUNCTION public.current_karyo_satuan() TO authenticated;

DROP POLICY IF EXISTS "users_komandan_read_satuan" ON public.users;

CREATE POLICY "users_komandan_read_satuan"
  ON public.users FOR SELECT TO anon
  USING (
    public.current_karyo_role() = 'komandan'
    AND public.current_karyo_satuan() IS NOT NULL
    AND satuan = public.current_karyo_satuan()
  );
