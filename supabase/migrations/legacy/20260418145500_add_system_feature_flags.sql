-- ============================================================
-- Global system feature flags (admin-controlled)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_feature_flags (
  feature_key text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_feature_flags FROM anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES
  ('user_management', true),
  ('logistics', true),
  ('documents', true),
  ('announcements', true),
  ('shift_schedule', true),
  ('attendance', true),
  ('gate_pass', true),
  ('pos_jaga', true),
  ('audit_log', true),
  ('tasks', true),
  ('messages', true),
  ('leave_requests', true),
  ('reports', true)
ON CONFLICT (feature_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_feature_flags(
  p_user_id uuid,
  p_role text
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
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF p_role NOT IN ('admin', 'komandan', 'prajurit', 'guard') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = p_role
      AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT f.feature_key, f.is_enabled, f.updated_at
  FROM public.system_feature_flags f
  ORDER BY f.feature_key;
END;
$$;

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

  UPDATE public.system_feature_flags
  SET is_enabled = COALESCE(p_is_enabled, true),
      updated_by = p_user_id,
      updated_at = now()
  WHERE feature_key = p_feature_key;

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

GRANT EXECUTE ON FUNCTION public.get_feature_flags(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_feature_flags(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_feature_flag(uuid, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.update_feature_flag(uuid, text, text, boolean) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'system_feature_flags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_feature_flags;
  END IF;
END;
$$;
