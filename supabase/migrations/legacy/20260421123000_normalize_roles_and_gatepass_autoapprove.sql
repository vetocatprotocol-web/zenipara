-- ============================================================
-- KARYO OS — Role alias normalization + commander gate pass auto-approve
--
-- Goals:
-- - Accept human-friendly role aliases from frontend/CSV imports.
-- - Restore automatic approval for gate pass submissions created by Komandan.
-- - Keep legacy RPC signatures stable for PostgREST clients.
-- ============================================================

CREATE OR REPLACE FUNCTION public.canonicalize_role(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_role IS NULL THEN
    RETURN NULL;
  END IF;

  v_role := LOWER(BTRIM(p_role));
  v_role := REGEXP_REPLACE(v_role, '[^a-z0-9]+', ' ', 'g');
  v_role := REGEXP_REPLACE(v_role, '\s+', ' ', 'g');

  CASE v_role
    WHEN 'admin', 'super admin', 'superadmin', 'admin super', 'super admin role', 'sad' THEN
      RETURN 'admin';
    WHEN 'komandan', 'kmd' THEN
      RETURN 'komandan';
    WHEN 'staf', 'staff', 'stf', 'staf operasional', 'staff operasional', 'staf ops', 'staff ops', 'staf operasional s3', 'staff operasional s3' THEN
      RETURN 'staf';
    WHEN 'guard', 'provos', 'provost', 'pjp', 'petugas jaga', 'petugas jaga provos', 'petugas jaga provost' THEN
      RETURN 'guard';
    WHEN 'prajurit', 'prj' THEN
      RETURN 'prajurit';
    ELSE
      RETURN BTRIM(p_role);
  END CASE;
END;
$$;

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
  v_id UUID;
  v_role TEXT;
  v_level_komando command_level;
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

  v_role := public.canonicalize_role(p_role);
  IF v_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  v_level_komando := CASE WHEN v_role = 'komandan' THEN 'PELETON'::command_level ELSE NULL END;

  INSERT INTO public.users (nrp, pin_hash, nama, role, level_komando, satuan, pangkat, jabatan)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    v_role,
    v_level_komando,
    p_satuan,
    p_pangkat,
    p_jabatan
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      level_komando = EXCLUDED.level_komando,
      satuan = EXCLUDED.satuan,
      pangkat = EXCLUDED.pangkat,
      jabatan = EXCLUDED.jabatan,
      is_active = TRUE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_user(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_target_id   UUID,
  p_updates     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_new_role TEXT;
  v_new_level command_level;
BEGIN
  IF NOT is_feature_enabled('user_management') THEN
    RAISE EXCEPTION 'user_management feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_caller_id IS NOT NULL AND p_caller_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_updates ? 'role' THEN
    v_new_role := public.canonicalize_role(NULLIF(p_updates->>'role', ''));
    IF v_new_role IS NOT NULL AND v_new_role NOT IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
      RAISE EXCEPTION 'Invalid role: %', p_updates->>'role';
    END IF;
  END IF;

  IF p_updates ? 'level_komando' THEN
    IF NULLIF(p_updates->>'level_komando', '') IS NULL THEN
      v_new_level := NULL;
    ELSE
      v_new_level := (p_updates->>'level_komando')::command_level;
    END IF;
  ELSE
    SELECT level_komando INTO v_new_level FROM public.users WHERE id = p_target_id;
  END IF;

  IF COALESCE(v_new_role, (SELECT role FROM public.users WHERE id = p_target_id)) = 'komandan'
     AND v_new_level IS NULL THEN
    RAISE EXCEPTION 'level_komando wajib untuk role komandan';
  END IF;

  IF COALESCE(v_new_role, (SELECT role FROM public.users WHERE id = p_target_id)) <> 'komandan' THEN
    v_new_level := NULL;
  END IF;

  UPDATE public.users
  SET nama          = COALESCE((p_updates->>'nama')::TEXT, nama),
      role          = COALESCE(v_new_role, role),
      level_komando = v_new_level,
      pangkat       = COALESCE((p_updates->>'pangkat')::TEXT, pangkat),
      jabatan       = COALESCE((p_updates->>'jabatan')::TEXT, jabatan),
      satuan        = COALESCE((p_updates->>'satuan')::TEXT, satuan),
      is_active     = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
      foto_url      = COALESCE((p_updates->>'foto_url')::TEXT, foto_url),
      updated_at    = NOW()
  WHERE id = p_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_insert_gate_pass(
  p_user_id       UUID,
  p_caller_role   TEXT,
  p_keperluan     TEXT,
  p_tujuan        TEXT,
  p_waktu_keluar  TIMESTAMPTZ,
  p_waktu_kembali TIMESTAMPTZ,
  p_qr_token      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_normalized_role TEXT;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Only allow creating gate pass for self, unless admin.
  IF v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = v_caller_id
        AND role = 'admin'
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized: tidak dapat membuat gate pass untuk orang lain';
    END IF;
  END IF;

  v_normalized_role := public.canonicalize_role(p_caller_role);

  INSERT INTO public.gate_pass (
    user_id,
    keperluan,
    tujuan,
    waktu_keluar,
    waktu_kembali,
    qr_token,
    status,
    approved_by
  )
  VALUES (
    p_user_id,
    p_keperluan,
    p_tujuan,
    p_waktu_keluar,
    p_waktu_kembali,
    p_qr_token,
    CASE WHEN v_normalized_role = 'komandan' THEN 'approved'::public.gate_pass_status ELSE 'pending'::public.gate_pass_status END,
    CASE WHEN v_normalized_role = 'komandan' THEN v_caller_id ELSE NULL END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';