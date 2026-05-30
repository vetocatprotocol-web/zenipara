-- ============================================================
-- KARYO OS — Security: Harden admin-only RPCs with DB verification
--
-- Problems fixed:
-- create_user_with_pin, reset_user_pin, import_users_csv,
-- bulk_reset_pins were all granted to `anon` with NO server-side
-- caller verification.  Any anonymous client that knew the Supabase
-- anon key could invoke them freely.
--
-- Fix:
-- Each function now reads current_karyo_user_id() (set by the
-- db_pre_request hook from the x-karyo-user-id header) and verifies
-- that ID belongs to an active admin row in the users table before
-- proceeding.  This adds a genuine DB-level authorization gate.
--
-- Additional hardening:
-- - PIN format validated server-side (must be exactly 6 digits).
-- - Role value validated server-side in create_user_with_pin.
-- - SET search_path = public, extensions added where missing.
-- ============================================================

-- ── Helper: check admin identity from DB ────────────────────────
-- Shared logic extracted as an inline check in each function to
-- avoid an extra helper function and keep functions self-contained.
-- ────────────────────────────────────────────────────────────────

-- ── create_user_with_pin ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_user_with_pin(
  p_nrp     TEXT,
  p_pin     TEXT,
  p_nama    TEXT,
  p_role    TEXT,
  p_satuan  TEXT,
  p_pangkat TEXT DEFAULT NULL,
  p_jabatan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_id        UUID;
BEGIN
  -- Require authenticated session context
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Verify caller is an active admin in the DB
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role = 'admin'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Validate role value
  IF p_role NOT IN ('admin', 'komandan', 'prajurit', 'guard') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Validate PIN format (exactly 6 digits)
  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    p_role,
    p_satuan,
    p_pangkat,
    p_jabatan
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash      = EXCLUDED.pin_hash,
      nama          = EXCLUDED.nama,
      role          = EXCLUDED.role,
      satuan        = EXCLUDED.satuan,
      pangkat       = EXCLUDED.pangkat,
      jabatan       = EXCLUDED.jabatan,
      is_active     = TRUE,
      login_attempts = 0,
      locked_until  = NULL,
      updated_at    = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── reset_user_pin ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_user_pin(
  p_user_id UUID,
  p_new_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
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

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  UPDATE public.users
  SET pin_hash      = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      login_attempts = 0,
      locked_until  = NULL,
      updated_at    = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ── bulk_reset_pins ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_reset_pins(
  p_user_ids UUID[],
  p_new_pin  TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_count     INTEGER;
BEGIN
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

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  UPDATE public.users
  SET pin_hash   = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = ANY(p_user_ids)
    AND is_active = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── import_users_csv ────────────────────────────────────────────
-- NOTE: import_users_csv internally calls create_user_with_pin.
-- After this migration create_user_with_pin also checks admin, so
-- the caller admin check here is also required (the inner call
-- inherits the same session context and will pass the same check).
CREATE OR REPLACE FUNCTION public.import_users_csv(p_users JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_item      JSONB;
  v_success   INTEGER := 0;
  v_failed    INTEGER := 0;
  v_errors    JSONB   := '[]'::JSONB;
BEGIN
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    BEGIN
      PERFORM public.create_user_with_pin(
        (v_item->>'nrp')::TEXT,
        (v_item->>'pin')::TEXT,
        (v_item->>'nama')::TEXT,
        (v_item->>'role')::TEXT,
        (v_item->>'satuan')::TEXT,
        NULLIF(v_item->>'pangkat', ''),
        NULLIF(v_item->>'jabatan', '')
      );
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'nrp',   v_item->>'nrp',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success,
    'failed',  v_failed,
    'errors',  v_errors
  );
END;
$$;

-- Grants remain the same (anon/authenticated can call, but the
-- functions now reject non-admin callers internally).
GRANT EXECUTE ON FUNCTION public.create_user_with_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_with_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.reset_user_pin(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_user_pin(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bulk_reset_pins(UUID[], TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.bulk_reset_pins(UUID[], TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.import_users_csv(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.import_users_csv(JSONB) TO authenticated;
