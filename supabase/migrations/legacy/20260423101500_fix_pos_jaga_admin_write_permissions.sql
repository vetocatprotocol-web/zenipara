-- Restore admin write access for Pos Jaga CRUD while preserving role-chain access.
-- Regression source: migration 20260420173000 changed write checks to komandan/staf-S3 only,
-- but Pos Jaga management UI remains under admin routes.

CREATE OR REPLACE FUNCTION public.api_insert_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'admin'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.pos_jaga (nama, qr_token, is_active)
  VALUES (p_nama, gen_random_uuid()::TEXT, TRUE)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_set_pos_jaga_active(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'admin'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET is_active = p_is_active
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_delete_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'admin'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.pos_jaga
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rename_pos_jaga(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_nama TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'admin'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET nama = p_nama
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_rotate_pos_jaga_qr(
  p_caller_id UUID,
  p_caller_role TEXT,
  p_id UUID,
  p_qr_token TEXT
)
RETURNS public.pos_jaga
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_row public.pos_jaga%ROWTYPE;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  v_role := public.current_karyo_role_db();
  IF NOT (
    v_role = 'admin'
    OR v_role = 'komandan'
    OR (v_role = 'staf' AND public.current_karyo_is_staf_bidang('S3'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.pos_jaga
  SET qr_token = p_qr_token
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
