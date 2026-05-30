-- ============================================================
-- KARYO OS — Force PIN change + default CSV import PIN
--
-- Flow changes:
-- 1) CSV import ignores source PIN and always sets default PIN 123456.
-- 2) Users created/reset through admin flow must change PIN on next login.
-- 3) Login returns force_change_pin so frontend can enforce redirect.
-- 4) PIN change RPCs are server-authenticated and clear force flag.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS force_change_pin BOOLEAN;

-- Keep existing accounts usable after rollout.
UPDATE public.users
SET force_change_pin = FALSE
WHERE force_change_pin IS NULL;

ALTER TABLE public.users
  ALTER COLUMN force_change_pin SET DEFAULT TRUE;

ALTER TABLE public.users
  ALTER COLUMN force_change_pin SET NOT NULL;

-- ------------------------------------------------------------
-- Login RPC now returns force_change_pin status.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_user_pin(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_nrp TEXT, p_pin TEXT)
RETURNS TABLE (user_id UUID, user_role TEXT, force_change_pin BOOLEAN)
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
    force_change_pin := v_user.force_change_pin;

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

-- ------------------------------------------------------------
-- Expose force_change_pin on auth bootstrap payload.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_by_id(UUID);
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id                   UUID,
  nrp                  TEXT,
  nama                 TEXT,
  role                 TEXT,
  pangkat              TEXT,
  jabatan              TEXT,
  satuan               TEXT,
  foto_url             TEXT,
  is_active            BOOLEAN,
  is_online            BOOLEAN,
  login_attempts       INTEGER,
  locked_until         TIMESTAMPTZ,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  force_change_pin     BOOLEAN,
  tempat_lahir         TEXT,
  tanggal_lahir        DATE,
  no_telepon           TEXT,
  alamat               TEXT,
  tanggal_masuk_dinas  DATE,
  pendidikan_terakhir  TEXT,
  agama                TEXT,
  status_pernikahan    TEXT,
  golongan_darah       TEXT,
  nomor_ktp            TEXT,
  kontak_darurat_nama  TEXT,
  kontak_darurat_telp  TEXT,
  catatan_khusus       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id, u.nrp, u.nama, u.role, u.pangkat, u.jabatan, u.satuan, u.foto_url,
    u.is_active, u.is_online, u.login_attempts, u.locked_until, u.last_login,
    u.created_at, u.updated_at, u.force_change_pin, u.tempat_lahir, u.tanggal_lahir,
    u.no_telepon, u.alamat, u.tanggal_masuk_dinas, u.pendidikan_terakhir, u.agama,
    u.status_pernikahan, u.golongan_darah, u.nomor_ktp,
    u.kontak_darurat_nama, u.kontak_darurat_telp, u.catatan_khusus
  FROM public.users u
  WHERE u.id = p_user_id;
END;
$$;

-- ------------------------------------------------------------
-- New users from admin flows should rotate initial PIN.
-- ------------------------------------------------------------
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

  INSERT INTO public.users (nrp, pin_hash, nama, role, level_komando, satuan, pangkat, jabatan, force_change_pin)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    v_role,
    v_level_komando,
    p_satuan,
    p_pangkat,
    p_jabatan,
    TRUE
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      level_komando = EXCLUDED.level_komando,
      satuan = EXCLUDED.satuan,
      pangkat = EXCLUDED.pangkat,
      jabatan = EXCLUDED.jabatan,
      force_change_pin = TRUE,
      is_active = TRUE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ------------------------------------------------------------
-- Reset PIN now forces mandatory rotation on next login.
-- ------------------------------------------------------------
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
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      force_change_pin = TRUE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

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
  v_count INTEGER;
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
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      force_change_pin = TRUE,
      updated_at = NOW()
  WHERE id = ANY(p_user_ids)
    AND is_active = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- CSV import ignores CSV PIN and uses default 123456.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_users_csv(p_users JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_item JSONB;
  v_success INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
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
        '123456',
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
        'nrp', v_item->>'nrp',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;

-- ------------------------------------------------------------
-- Harden PIN change for authenticated self-service.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_user_pin(
  p_user_id UUID,
  p_old_pin TEXT,
  p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_hash TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF p_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: hanya boleh ubah PIN sendiri';
  END IF;

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN baru harus 6 digit angka';
  END IF;

  IF p_new_pin = '123456' THEN
    RAISE EXCEPTION 'PIN baru tidak boleh menggunakan PIN default';
  END IF;

  SELECT pin_hash INTO v_hash
  FROM public.users
  WHERE id = p_user_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_hash <> extensions.crypt(p_old_pin, v_hash) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      force_change_pin = FALSE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM public.insert_audit_log(
    p_user_id,
    'PIN_CHANGED',
    'auth',
    jsonb_build_object('method', 'change_user_pin')::TEXT
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_force_change_pin(p_new_pin TEXT)
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

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN baru harus 6 digit angka';
  END IF;

  IF p_new_pin = '123456' THEN
    RAISE EXCEPTION 'PIN baru tidak boleh sama dengan PIN default';
  END IF;

  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      force_change_pin = FALSE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = v_caller_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan atau tidak aktif';
  END IF;

  PERFORM public.insert_audit_log(
    v_caller_id,
    'PIN_FORCE_CHANGED',
    'auth',
    jsonb_build_object('method', 'force_change')::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.change_user_pin(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.change_user_pin(UUID, TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_force_change_pin(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.complete_force_change_pin(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
