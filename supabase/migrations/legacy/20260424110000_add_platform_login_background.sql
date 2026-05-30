ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS platform_login_background_url text;

CREATE OR REPLACE FUNCTION public.get_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_row public.platform_settings%ROWTYPE;
BEGIN
  SELECT *
    INTO v_row
  FROM public.platform_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.platform_settings (id, platform_name, platform_tagline)
    VALUES (1, 'KARYO OS', 'Command and Battalion Tracking')
    ON CONFLICT (id) DO NOTHING;

    SELECT *
      INTO v_row
    FROM public.platform_settings
    WHERE id = 1;
  END IF;

  RETURN jsonb_build_object(
    'platform_name', v_row.platform_name,
    'platform_tagline', v_row.platform_tagline,
    'platform_logo_url', v_row.platform_logo_url,
    'platform_login_background_url', v_row.platform_login_background_url,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_platform_settings(
  p_platform_name text,
  p_platform_logo_url text,
  p_platform_tagline text DEFAULT NULL,
  p_platform_login_background_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_name text;
  v_logo text;
  v_tagline text;
  v_login_background text;
BEGIN
  v_user_id := public.current_karyo_user_id();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin can update platform settings';
  END IF;

  v_name := nullif(btrim(p_platform_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Platform name cannot be empty';
  END IF;

  v_tagline := nullif(btrim(p_platform_tagline), '');
  IF v_tagline IS NULL THEN
    v_tagline := 'Command and Battalion Tracking';
  END IF;

  v_logo := nullif(btrim(p_platform_logo_url), '');
  v_login_background := nullif(btrim(p_platform_login_background_url), '');

  INSERT INTO public.platform_settings (
    id,
    platform_name,
    platform_tagline,
    platform_logo_url,
    platform_login_background_url,
    updated_at,
    updated_by
  )
  VALUES (1, v_name, v_tagline, v_logo, v_login_background, now(), v_user_id)
  ON CONFLICT (id)
  DO UPDATE
    SET platform_name = EXCLUDED.platform_name,
        platform_tagline = EXCLUDED.platform_tagline,
        platform_logo_url = EXCLUDED.platform_logo_url,
        platform_login_background_url = EXCLUDED.platform_login_background_url,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;

  RETURN public.get_platform_settings();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_platform_settings(text, text, text, text) TO anon;
