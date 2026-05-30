-- ============================================================
-- KARYO OS — Fix ambiguous column references in registration form RPCs
--
-- Problem:
-- RETURNS TABLE output columns (e.g. `id`) shadow unqualified column
-- names used in SQL statements inside PL/pgSQL, causing:
--   "column reference \"id\" is ambiguous"
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_registration_form_link(
  p_role TEXT,
  p_expires_in_days INTEGER DEFAULT 7,
  p_max_uses INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  token TEXT,
  is_active BOOLEAN,
  max_uses INTEGER,
  used_count INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_caller_id
      AND u.role = 'admin'
      AND u.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  v_role := public.canonicalize_role(p_role);
  IF v_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  v_token := REPLACE(gen_random_uuid()::TEXT, '-', '');

  IF p_expires_in_days IS NOT NULL AND p_expires_in_days > 0 THEN
    v_expires_at := NOW() + make_interval(days => p_expires_in_days);
  ELSE
    v_expires_at := NULL;
  END IF;

  IF p_max_uses IS NOT NULL AND p_max_uses <= 0 THEN
    RAISE EXCEPTION 'max_uses harus lebih dari 0';
  END IF;

  RETURN QUERY
  INSERT INTO public.registration_forms (
    role,
    token,
    is_active,
    max_uses,
    used_count,
    expires_at,
    created_by
  )
  VALUES (
    v_role,
    v_token,
    TRUE,
    p_max_uses,
    0,
    v_expires_at,
    v_caller_id
  )
  RETURNING
    registration_forms.id,
    registration_forms.role,
    registration_forms.token,
    registration_forms.is_active,
    registration_forms.max_uses,
    registration_forms.used_count,
    registration_forms.expires_at,
    registration_forms.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_registration_form_links()
RETURNS TABLE (
  id UUID,
  role TEXT,
  token TEXT,
  is_active BOOLEAN,
  max_uses INTEGER,
  used_count INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  created_by UUID,
  created_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_caller_id
      AND u.role = 'admin'
      AND u.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    rf.id,
    rf.role,
    rf.token,
    rf.is_active,
    rf.max_uses,
    rf.used_count,
    rf.expires_at,
    rf.created_at,
    rf.created_by,
    creator.nama AS created_by_name
  FROM public.registration_forms rf
  LEFT JOIN public.users creator ON creator.id = rf.created_by
  ORDER BY rf.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_registration_form_active(
  p_form_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_caller_id
      AND u.role = 'admin'
      AND u.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.registration_forms rf
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE rf.id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form pendaftaran tidak ditemukan';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
