-- ============================================================
-- Extend audit history cleanup RPC with optional retention window
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_clear_audit_logs(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_older_than_days INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_deleted_count INTEGER;
BEGIN
  IF NOT is_feature_enabled('audit_log') THEN
    RAISE EXCEPTION 'audit_log feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_older_than_days IS NULL THEN
    DELETE FROM public.audit_logs;
  ELSE
    IF p_older_than_days <= 0 THEN
      RAISE EXCEPTION 'Rentang hari tidak valid';
    END IF;

    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - make_interval(days => p_older_than_days);
  END IF;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN COALESCE(v_deleted_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_clear_audit_logs(UUID, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.api_clear_audit_logs(UUID, TEXT, INTEGER) TO authenticated;
