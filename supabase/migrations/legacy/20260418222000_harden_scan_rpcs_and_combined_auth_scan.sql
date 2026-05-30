-- ============================================================
-- KARYO OS — Security: Harden scan RPCs + combined auth scan
--
-- Problems fixed:
-- 1) server_scan_gate_pass: any anon caller who had the QR token
--    could change a gate pass status (mark as out/returned).
--    Fix: verify the caller is an active guard or admin in the DB.
--
-- 2) scan_pos_jaga: the function trusted the p_user_id parameter
--    from the client without verifying the caller is that user or
--    has authority over them.
--    Fix: if called with an active session (current_karyo_user_id
--    is not null), the session identity must equal p_user_id, OR
--    the caller must be an admin/guard.
--
-- 3) New combined RPC authenticated_scan_pos_jaga: for the kiosk
--    (ScanPosJaga) flow where a prajurit types NRP + PIN without a
--    pre-existing browser session.  The old flow called
--    verify_user_pin then scan_pos_jaga in two separate requests,
--    making it impossible to guarantee the scan is for the verified
--    user on the server side.  The new single RPC does both steps
--    atomically inside the database, removing the timing gap.
-- ============================================================

-- ── server_scan_gate_pass ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.server_scan_gate_pass(p_qr_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_gate_pass public.gate_pass%ROWTYPE;
  v_result    public.gate_pass%ROWTYPE;
  v_message   TEXT;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Require authenticated session
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Verify caller is an active guard or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role IN ('guard', 'admin')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: hanya guard/admin yang dapat melakukan scan';
  END IF;

  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR tidak valid';
  END IF;

  IF v_gate_pass.status = 'approved' AND v_gate_pass.actual_keluar IS NULL THEN
    UPDATE public.gate_pass
    SET status        = 'checked_in',
        actual_keluar = NOW(),
        updated_at    = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Keluar berhasil (Checked-In)';

  ELSIF v_gate_pass.status IN ('checked_in', 'out') AND v_gate_pass.actual_kembali IS NULL THEN
    UPDATE public.gate_pass
    SET status         = 'completed',
        actual_kembali = NOW(),
        updated_at     = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Kembali berhasil (Completed)';

  ELSIF v_gate_pass.status IN ('completed', 'returned') THEN
    RAISE EXCEPTION 'Sudah completed, tidak bisa scan lagi';
  ELSE
    RAISE EXCEPTION 'Status gate pass tidak valid untuk scan';
  END IF;

  RETURN jsonb_build_object(
    'id',            v_result.id,
    'status',        v_result.status,
    'actual_keluar', v_result.actual_keluar,
    'actual_kembali',v_result.actual_kembali,
    'message',       v_message
  );
END;
$$;

-- ── scan_pos_jaga ───────────────────────────────────────────────
-- Now verifies the caller identity when a session is present.
-- For the kiosk flow (no pre-existing session), use
-- authenticated_scan_pos_jaga below instead.
CREATE OR REPLACE FUNCTION public.scan_pos_jaga(
  p_pos_token text,
  p_user_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id  UUID;
  v_pos        public.pos_jaga%ROWTYPE;
  v_gate_pass  public.gate_pass%ROWTYPE;
  v_message    text;
  v_new_status text;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- If a session is active, the caller must be p_user_id (scanning
  -- for themselves) or an admin/guard acting on their behalf.
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id
        AND role IN ('admin', 'guard')
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized: tidak dapat scan untuk pengguna lain';
    END IF;
  END IF;

  SELECT * INTO v_pos
  FROM public.pos_jaga
  WHERE qr_token = p_pos_token AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR pos jaga tidak valid atau tidak aktif';
  END IF;

  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE user_id = p_user_id
    AND status IN ('approved', 'checked_in', 'out')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak ada gate pass aktif untuk diproses';
  END IF;

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
    'message',      v_message
  );
END;
$$;

-- ── authenticated_scan_pos_jaga ─────────────────────────────────
-- Combined atomic RPC for the kiosk/credential-based scan flow.
-- The prajurit supplies NRP + PIN + pos_token in one call.
-- Server verifies PIN, then processes the scan — no session
-- context is required from the client side.
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
  v_user       public.users%ROWTYPE;
  v_pos        public.pos_jaga%ROWTYPE;
  v_gate_pass  public.gate_pass%ROWTYPE;
  v_message    TEXT;
  v_new_status TEXT;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Step 1: authenticate the prajurit via PIN
  SELECT * INTO v_user
  FROM public.users
  WHERE nrp = p_nrp AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NRP atau PIN salah';
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RAISE EXCEPTION 'Akun terkunci sementara. Coba lagi nanti.';
  END IF;

  IF v_user.pin_hash <> extensions.crypt(p_pin, v_user.pin_hash) THEN
    -- Increment failed attempts
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

-- Grant to anon (frontend calls this without a pre-existing session)
GRANT EXECUTE ON FUNCTION public.authenticated_scan_pos_jaga(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticated_scan_pos_jaga(TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
