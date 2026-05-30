-- ============================================================
-- KARYO OS — Closed registration forms by role
--
-- Admin capabilities:
-- - Create registration links bound to a specific role
-- - Activate/deactivate links
-- - View active/inactive links and usage
--
-- Public capabilities:
-- - Validate registration token
-- - Register new user using a valid active token
-- ============================================================

CREATE TABLE IF NOT EXISTS public.registration_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'komandan', 'staf', 'guard', 'prajurit')),
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_forms_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0)
);

CREATE INDEX IF NOT EXISTS idx_registration_forms_role ON public.registration_forms(role);
CREATE INDEX IF NOT EXISTS idx_registration_forms_active ON public.registration_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_registration_forms_expires_at ON public.registration_forms(expires_at);

ALTER TABLE public.registration_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registration_forms_admin_read ON public.registration_forms;
CREATE POLICY registration_forms_admin_read
  ON public.registration_forms
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.current_karyo_user_id()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS registration_forms_admin_write ON public.registration_forms;
CREATE POLICY registration_forms_admin_write
  ON public.registration_forms
  FOR ALL
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.current_karyo_user_id()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = public.current_karyo_user_id()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  );

-- ------------------------------------------------------------
-- Admin: create registration form link
-- ------------------------------------------------------------
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
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
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

-- ------------------------------------------------------------
-- Admin: list registration form links
-- ------------------------------------------------------------
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
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
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

-- ------------------------------------------------------------
-- Admin: activate/deactivate registration form link
-- ------------------------------------------------------------
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
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.registration_forms
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form pendaftaran tidak ditemukan';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Public: validate registration form token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_registration_form_token(
  p_token TEXT
)
RETURNS TABLE (
  form_id UUID,
  role TEXT,
  is_active BOOLEAN,
  is_valid BOOLEAN,
  invalid_reason TEXT,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  used_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_form public.registration_forms%ROWTYPE;
BEGIN
  SELECT *
  INTO v_form
  FROM public.registration_forms
  WHERE token = BTRIM(p_token);

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, FALSE, 'Link pendaftaran tidak valid', NULL::TIMESTAMPTZ, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_form.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT v_form.id, v_form.role, v_form.is_active, FALSE, 'Form pendaftaran saat ini dinonaktifkan', v_form.expires_at, v_form.max_uses, v_form.used_count;
    RETURN;
  END IF;

  IF v_form.expires_at IS NOT NULL AND v_form.expires_at < NOW() THEN
    RETURN QUERY SELECT v_form.id, v_form.role, v_form.is_active, FALSE, 'Link pendaftaran sudah kedaluwarsa', v_form.expires_at, v_form.max_uses, v_form.used_count;
    RETURN;
  END IF;

  IF v_form.max_uses IS NOT NULL AND v_form.used_count >= v_form.max_uses THEN
    RETURN QUERY SELECT v_form.id, v_form.role, v_form.is_active, FALSE, 'Kuota pendaftaran untuk link ini sudah habis', v_form.expires_at, v_form.max_uses, v_form.used_count;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_form.id, v_form.role, v_form.is_active, TRUE, NULL::TEXT, v_form.expires_at, v_form.max_uses, v_form.used_count;
END;
$$;

-- ------------------------------------------------------------
-- Public: register user via valid token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_user_via_form(
  p_token TEXT,
  p_nrp TEXT,
  p_nama TEXT,
  p_satuan TEXT,
  p_pangkat TEXT DEFAULT NULL,
  p_jabatan TEXT DEFAULT NULL,
  p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_form public.registration_forms%ROWTYPE;
  v_user_id UUID;
  v_role TEXT;
  v_pin TEXT;
  v_level_komando command_level;
BEGIN
  SELECT *
  INTO v_form
  FROM public.registration_forms
  WHERE token = BTRIM(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link pendaftaran tidak valid';
  END IF;

  IF v_form.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Form pendaftaran saat ini dinonaktifkan';
  END IF;

  IF v_form.expires_at IS NOT NULL AND v_form.expires_at < NOW() THEN
    RAISE EXCEPTION 'Link pendaftaran sudah kedaluwarsa';
  END IF;

  IF v_form.max_uses IS NOT NULL AND v_form.used_count >= v_form.max_uses THEN
    RAISE EXCEPTION 'Kuota pendaftaran untuk link ini sudah habis';
  END IF;

  IF p_nrp IS NULL OR BTRIM(p_nrp) = '' THEN
    RAISE EXCEPTION 'NRP wajib diisi';
  END IF;

  IF p_nama IS NULL OR LENGTH(BTRIM(p_nama)) < 3 THEN
    RAISE EXCEPTION 'Nama minimal 3 karakter';
  END IF;

  IF p_satuan IS NULL OR BTRIM(p_satuan) = '' THEN
    RAISE EXCEPTION 'Satuan wajib diisi';
  END IF;

  v_pin := COALESCE(NULLIF(BTRIM(p_pin), ''), '123456');
  IF v_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  v_role := public.canonicalize_role(v_form.role);
  IF v_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    RAISE EXCEPTION 'Role pada form pendaftaran tidak valid';
  END IF;

  v_level_komando := CASE WHEN v_role = 'komandan' THEN 'PELETON'::command_level ELSE NULL END;

  IF EXISTS (SELECT 1 FROM public.users WHERE nrp = BTRIM(p_nrp)) THEN
    RAISE EXCEPTION 'NRP sudah terdaftar';
  END IF;

  INSERT INTO public.users (
    nrp,
    pin_hash,
    nama,
    role,
    level_komando,
    satuan,
    pangkat,
    jabatan,
    is_active,
    force_change_pin
  )
  VALUES (
    BTRIM(p_nrp),
    extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
    BTRIM(p_nama),
    v_role,
    v_level_komando,
    BTRIM(p_satuan),
    NULLIF(BTRIM(COALESCE(p_pangkat, '')), ''),
    NULLIF(BTRIM(COALESCE(p_jabatan, '')), ''),
    TRUE,
    FALSE
  )
  RETURNING id INTO v_user_id;

  UPDATE public.registration_forms
  SET used_count = used_count + 1,
      is_active = CASE
        WHEN max_uses IS NOT NULL AND (used_count + 1) >= max_uses THEN FALSE
        ELSE is_active
      END,
      updated_at = NOW()
  WHERE id = v_form.id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_registration_form_link(TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.create_registration_form_link(TEXT, INTEGER, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_registration_form_links() TO anon;
GRANT EXECUTE ON FUNCTION public.list_registration_form_links() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_registration_form_active(UUID, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.set_registration_form_active(UUID, BOOLEAN) TO authenticated;

GRANT EXECUTE ON FUNCTION public.validate_registration_form_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_registration_form_token(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_user_via_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.register_user_via_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
