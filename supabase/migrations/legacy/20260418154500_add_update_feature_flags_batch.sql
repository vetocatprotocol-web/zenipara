-- ============================================================
-- KARYO OS — Migration: Batch Update System Feature Flags
--
-- Adds an atomic admin RPC to update multiple feature flags in a single
-- transaction. This keeps the global control panel efficient and avoids
-- partial application when one flag update fails.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_feature_flags(
  p_user_id uuid,
  p_role text,
  p_feature_flags jsonb
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
DECLARE
  v_invalid_key text;
BEGIN
  IF p_user_id IS NULL OR p_feature_flags IS NULL THEN
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

  IF jsonb_typeof(p_feature_flags) <> 'object' THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  SELECT key
  INTO v_invalid_key
  FROM jsonb_each_text(p_feature_flags) AS feature_row(key, value)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.system_feature_flags f
    WHERE f.feature_key = feature_row.key
  )
  LIMIT 1;

  IF v_invalid_key IS NOT NULL THEN
    RAISE EXCEPTION 'Feature key tidak dikenali';
  END IF;

  PERFORM public.insert_audit_log(
    p_user_id,
    'UPDATE',
    'feature_flags',
    jsonb_build_object('feature_flags', p_feature_flags)::text
  );

  RETURN QUERY
  WITH updated AS (
    UPDATE public.system_feature_flags f
    SET is_enabled = COALESCE((p_feature_flags ->> f.feature_key)::boolean, f.is_enabled),
        updated_by = p_user_id,
        updated_at = now()
    WHERE p_feature_flags ? f.feature_key
    RETURNING f.feature_key, f.is_enabled, f.updated_at
  )
  SELECT feature_key, is_enabled, updated_at
  FROM updated
  ORDER BY feature_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_feature_flags(uuid, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_feature_flags(uuid, text, jsonb) TO authenticated;