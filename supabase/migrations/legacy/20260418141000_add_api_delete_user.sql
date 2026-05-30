-- ============================================================
-- Add admin-only user deletion RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_delete_user(
  p_caller_id uuid,
  p_caller_role text,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target_role text;
  v_admin_count integer;
BEGIN
  IF p_caller_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  IF p_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_caller_id = p_target_id THEN
    RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri';
  END IF;

  SELECT role
    INTO v_target_role
  FROM public.users
  WHERE id = p_target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  IF v_target_role = 'admin' THEN
    SELECT COUNT(*)
      INTO v_admin_count
    FROM public.users
    WHERE role = 'admin'
      AND is_active = true;

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Admin terakhir tidak boleh dihapus';
    END IF;
  END IF;

  DELETE FROM public.users
  WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_delete_user(uuid, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.api_delete_user(uuid, text, uuid) TO authenticated;
