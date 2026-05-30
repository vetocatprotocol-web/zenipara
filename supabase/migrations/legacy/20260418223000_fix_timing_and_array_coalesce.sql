-- ============================================================
-- KARYO OS — Security: Fix two issues found in review of
-- migrations 20260418221000 and 20260418222000.
--
-- Fix 1 — Timing attack in authenticated_scan_pos_jaga:
--   When the user is not found, the function previously returned
--   immediately without computing bcrypt, making it measurably
--   faster than the "wrong PIN" path and allowing user enumeration
--   via timing.  Now a dummy bcrypt computation is always
--   performed before raising the exception, normalising response
--   time regardless of whether the NRP exists.
--
-- Fix 2 — Empty-array overwrite in api_update_announcement:
--   COALESCE(ARRAY(SELECT jsonb_array_elements_text(NULL)), col)
--   returns {} (empty array) instead of the existing column value
--   because ARRAY() of zero rows is an empty array, not NULL.
--   Replaced with a CASE expression that only updates target_role
--   when the key is explicitly present in the JSONB payload.
-- ============================================================

-- ── Fix 1: authenticated_scan_pos_jaga ─────────────────────────
CREATE OR REPLACE FUNCTION public.authenticated_scan_pos_jaga(
  p_nrp       TEXT,
  p_pin       TEXT,
  p_pos_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- A static valid bcrypt hash used solely to normalise timing when
  -- the NRP is not found so that response time does not reveal
  -- whether the NRP exists in the database.
  v_dummy_hash CONSTANT TEXT :=
    '$2a$10$invalidhashfortimingnullhashXXXXXXXXXXXXXXXXXXXXXX';
  v_user       public.users%ROWTYPE;
  v_pos        public.pos_jaga%ROWTYPE;
  v_gate_pass  public.gate_pass%ROWTYPE;
  v_message    TEXT;
  v_new_status TEXT;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Step 1: look up the user
  SELECT * INTO v_user
  FROM public.users
  WHERE nrp = p_nrp AND is_active = TRUE;

  IF NOT FOUND THEN
    -- Always compute bcrypt to normalise response time and prevent
    -- user enumeration via timing side-channel.
    PERFORM extensions.crypt(p_pin, v_dummy_hash);
    RAISE EXCEPTION 'NRP atau PIN salah';
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    -- Still compute bcrypt so the locked path is timing-consistent.
    PERFORM extensions.crypt(p_pin, v_user.pin_hash);
    RAISE EXCEPTION 'Akun terkunci sementara. Coba lagi nanti.';
  END IF;

  -- Verify PIN via bcrypt (constant-time by design of bcrypt)
  IF v_user.pin_hash <> extensions.crypt(p_pin, v_user.pin_hash) THEN
    PERFORM public.increment_login_attempts(p_nrp);
    RAISE EXCEPTION 'NRP atau PIN salah';
  END IF;

  -- PIN verified — reset failed attempts
  UPDATE public.users
  SET login_attempts = 0, locked_until = NULL
  WHERE id = v_user.id;

  -- Step 2: verify pos jaga
  SELECT * INTO v_pos
  FROM public.pos_jaga
  WHERE qr_token = p_pos_token AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR pos jaga tidak valid atau tidak aktif';
  END IF;

  -- Step 3: find active gate pass for this prajurit
  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE user_id = v_user.id
    AND status IN ('approved', 'checked_in', 'out')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak ada gate pass aktif untuk diproses';
  END IF;

  -- Step 4: process scan
  IF v_gate_pass.status = 'approved' THEN
    UPDATE public.gate_pass
    SET status        = 'checked_in',
        actual_keluar = NOW(),
        updated_at    = NOW()
    WHERE id = v_gate_pass.id;

    v_message    := 'Scan keluar berhasil (Checked-In)';
    v_new_status := 'checked_in';

  ELSIF v_gate_pass.status IN ('checked_in', 'out') THEN
    UPDATE public.gate_pass
    SET status         = 'completed',
        actual_kembali = NOW(),
        updated_at     = NOW()
    WHERE id = v_gate_pass.id;

    v_message    := 'Scan kembali berhasil (Completed)';
    v_new_status := 'completed';

  ELSE
    RAISE EXCEPTION 'Status gate pass tidak valid untuk scan';
  END IF;

  RETURN jsonb_build_object(
    'gate_pass_id', v_gate_pass.id,
    'pos_nama',     v_pos.nama,
    'status',       v_new_status,
    'message',      v_message,
    'user_id',      v_user.id,
    'user_role',    v_user.role
  );
END;
$$;

-- ── Fix 2: api_update_announcement ─────────────────────────────
CREATE OR REPLACE FUNCTION public.api_update_announcement(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_updates     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF NOT is_feature_enabled('announcements') THEN
    RAISE EXCEPTION 'announcements feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.announcements
  SET
    judul       = COALESCE((p_updates->>'judul')::TEXT,       judul),
    isi         = COALESCE((p_updates->>'isi')::TEXT,         isi),
    is_pinned   = COALESCE((p_updates->>'is_pinned')::BOOLEAN, is_pinned),
    -- Only update target_role when the key is explicitly supplied in the
    -- payload.  Using COALESCE with ARRAY() would overwrite to an empty
    -- array whenever the key is absent because ARRAY(SELECT ...) on zero
    -- rows returns {} (not NULL).
    target_role = CASE
                    WHEN p_updates ? 'target_role'
                    THEN ARRAY(SELECT jsonb_array_elements_text(p_updates->'target_role'))
                    ELSE target_role
                  END
  WHERE id = p_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
