-- ============================================================
-- Persist per-user UI preferences across devices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_dark_mode boolean NOT NULL DEFAULT true,
  sidebar_open boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT true,
  display_density text NOT NULL DEFAULT 'comfortable' CHECK (display_density IN ('comfortable', 'compact')),
  dashboard_auto_refresh_enabled boolean NOT NULL DEFAULT true,
  dashboard_auto_refresh_minutes integer NOT NULL DEFAULT 3 CHECK (dashboard_auto_refresh_minutes BETWEEN 1 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_preferences FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_preferences(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.user_preferences%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = p_role
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT *
    INTO v_row
  FROM public.user_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'is_dark_mode', v_row.is_dark_mode,
    'sidebar_open', v_row.sidebar_open,
    'notifications_enabled', v_row.notifications_enabled,
    'display_density', v_row.display_density,
    'dashboard_auto_refresh_enabled', v_row.dashboard_auto_refresh_enabled,
    'dashboard_auto_refresh_minutes', v_row.dashboard_auto_refresh_minutes,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_preferences(
  p_user_id uuid,
  p_role text,
  p_is_dark_mode boolean,
  p_sidebar_open boolean,
  p_notifications_enabled boolean,
  p_display_density text,
  p_dashboard_auto_refresh_enabled boolean,
  p_dashboard_auto_refresh_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_density text;
  v_minutes integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = p_role
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_density := CASE WHEN p_display_density IN ('comfortable', 'compact') THEN p_display_density ELSE 'comfortable' END;
  v_minutes := GREATEST(1, LEAST(60, COALESCE(p_dashboard_auto_refresh_minutes, 3)));

  INSERT INTO public.user_preferences (
    user_id,
    is_dark_mode,
    sidebar_open,
    notifications_enabled,
    display_density,
    dashboard_auto_refresh_enabled,
    dashboard_auto_refresh_minutes,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_is_dark_mode, true),
    COALESCE(p_sidebar_open, true),
    COALESCE(p_notifications_enabled, true),
    v_density,
    COALESCE(p_dashboard_auto_refresh_enabled, true),
    v_minutes,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_dark_mode = EXCLUDED.is_dark_mode,
    sidebar_open = EXCLUDED.sidebar_open,
    notifications_enabled = EXCLUDED.notifications_enabled,
    display_density = EXCLUDED.display_density,
    dashboard_auto_refresh_enabled = EXCLUDED.dashboard_auto_refresh_enabled,
    dashboard_auto_refresh_minutes = EXCLUDED.dashboard_auto_refresh_minutes,
    updated_at = now();

  RETURN public.get_user_preferences(p_user_id, p_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_preferences(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_preferences(uuid, text, boolean, boolean, boolean, text, boolean, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_preferences(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_preferences(uuid, text, boolean, boolean, boolean, text, boolean, integer) TO authenticated;
