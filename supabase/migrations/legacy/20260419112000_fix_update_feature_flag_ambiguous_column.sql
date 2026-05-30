-- ============================================================
-- KARYO OS — Fix: update_feature_flag ambiguous column reference
--
-- Fixes runtime error:
--   column reference "feature_key" is ambiguous
--
-- Cause: RETURNS TABLE output-column names are in scope in PL/pgSQL.
-- Qualify table columns in UPDATE to avoid collisions with output vars.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_feature_flag(
  p_user_id uuid,
  p_role text,
  p_feature_key text,
  p_is_enabled boolean
)
RETURNS TABLE(
  feature_key text,
  is_enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_user_id IS NULL OR p_feature_key IS NULL THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  IF p_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = 'admin'
      AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.system_feature_flags f
    WHERE f.feature_key = p_feature_key
  ) THEN
    RAISE EXCEPTION 'Feature key tidak dikenali';
  END IF;

  UPDATE public.system_feature_flags AS f
  SET is_enabled = COALESCE(p_is_enabled, true),
      updated_by = p_user_id,
      updated_at = now()
  WHERE f.feature_key = p_feature_key;

  PERFORM public.insert_audit_log(
    p_user_id,
    'UPDATE',
    'feature_flags',
    jsonb_build_object('feature_key', p_feature_key, 'is_enabled', COALESCE(p_is_enabled, true))::text
  );

  RETURN QUERY
  SELECT f.feature_key, f.is_enabled, f.updated_at
  FROM public.system_feature_flags f
  WHERE f.feature_key = p_feature_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_feature_flag(uuid, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.update_feature_flag(uuid, text, text, boolean) TO authenticated;
