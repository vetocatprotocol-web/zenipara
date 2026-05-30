-- ============================================================
-- KARYO OS — Migration 20260417060000
-- Reorder api_get_users signature to match PostgREST schema cache
-- lookup and avoid stale-function-signature errors.
-- ============================================================

DROP FUNCTION IF EXISTS public.api_get_users(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN
);

CREATE OR REPLACE FUNCTION public.api_get_users(
  p_ascending      BOOLEAN DEFAULT TRUE,
  p_is_active      BOOLEAN DEFAULT NULL,
  p_order_by       TEXT    DEFAULT 'nama',
  p_role           TEXT    DEFAULT NULL,
  p_role_filter    TEXT    DEFAULT NULL,
  p_satuan_filter  TEXT    DEFAULT NULL,
  p_user_id        UUID    DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order TEXT;
  v_dir   TEXT;
BEGIN
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_order := CASE WHEN p_order_by IN ('nama', 'created_at', 'nrp') THEN p_order_by ELSE 'nama' END;
  v_dir   := CASE WHEN p_ascending THEN 'ASC' ELSE 'DESC' END;

  IF p_role = 'admin' THEN
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.users WHERE ($1 IS NULL OR role = $1) AND ($2 IS NULL OR satuan = $2) AND ($3 IS NULL OR is_active = $3) ORDER BY %I %s',
      v_order, v_dir
    ) USING p_role_filter, p_satuan_filter, p_is_active;

  ELSIF p_role = 'komandan' THEN
    RETURN QUERY EXECUTE format(
      'SELECT u.* FROM public.users u WHERE u.satuan = (SELECT satuan FROM public.users WHERE id = $1) AND ($2 IS NULL OR u.role = $2) AND ($3 IS NULL OR u.is_active = $3) ORDER BY u.%I %s',
      v_order, v_dir
    ) USING p_user_id, p_role_filter, p_is_active;

  ELSE
    RETURN QUERY SELECT * FROM public.users WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_users(
  BOOLEAN,
  BOOLEAN,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO anon;