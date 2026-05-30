-- ============================================================
-- KARYO OS — Migration 013: Auth RPC alignment
-- Ensures frontend auth RPC contracts match database functions.
-- ============================================================

-- Remove ambiguous overload that can break PostgREST RPC resolution.
DROP FUNCTION IF EXISTS public.get_user_by_id(TEXT);

-- Recreate canonical RPC with UUID argument.
DROP FUNCTION IF EXISTS public.get_user_by_id(UUID);
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_user_id UUID)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.users
  WHERE id = p_user_id;
END;
$$;

-- Match frontend contract: verify_user_pin returns user_id + user_role.
DROP FUNCTION IF EXISTS public.verify_user_pin(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_nrp TEXT, p_pin TEXT)
RETURNS TABLE (user_id UUID, user_role TEXT, force_change_pin BOOLEAN, satuan_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT *
  INTO v_user
  FROM public.users
  WHERE nrp = p_nrp
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RETURN;
  END IF;

  IF v_user.pin_hash = extensions.crypt(p_pin, v_user.pin_hash) THEN
    user_id := v_user.id;
    user_role := v_user.role;
    force_change_pin := COALESCE(v_user.force_change_pin, FALSE);
    satuan_id := v_user.satuan_id;

    UPDATE public.users
    SET login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = v_user.id;

    RETURN NEXT;
  END IF;

  PERFORM public.increment_login_attempts(p_nrp);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_login(
  p_user_id UUID,
  p_last_login TIMESTAMPTZ DEFAULT NULL,
  p_is_online BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.users
  SET
    last_login = COALESCE(p_last_login, last_login),
    is_online = COALESCE(p_is_online, is_online),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_resource TEXT DEFAULT NULL,
  p_detail TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    detail,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_action,
    p_resource,
    p_resource_id,
    CASE
      WHEN p_detail IS NULL OR btrim(p_detail) = '' THEN NULL
      ELSE p_detail::jsonb
    END,
    p_ip_address,
    p_user_agent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_login(UUID, TIMESTAMPTZ, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;