-- ============================================================
-- KARYO OS — Auto-adjust return time on check-out
--
-- When a prajurit checks out later than planned:
-- Automatically adjust the return time (waktu_kembali) to maintain
-- the duration. This ensures the planned duration stays consistent
-- even if checkout is delayed.
--
-- Example:
--   Planned: 14:00 — 18:00 (4 hours)
--   Actual checkout: 14:10 (10min delay)
--   Result: auto-adjust return time to 18:10 (maintain 4-hour duration)
--
-- ============================================================

CREATE OR REPLACE FUNCTION public.scan_gate_pass(
  p_caller_id text,
  p_caller_role text,
  p_qr_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_gate_pass public.gate_pass%ROWTYPE;
  v_result    public.gate_pass%ROWTYPE;
  v_message   TEXT;
  v_delay_ms  BIGINT;
  v_new_kembali TIMESTAMP;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  -- Verify caller is an active guard or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_caller_id::UUID
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
    -- CHECK-OUT: auto-adjust return time based on delay
    
    -- Calculate delay (actual - planned)
    -- If negative, actual is earlier than planned (no adjustment)
    -- If positive, adjust return time by the same delay
    v_delay_ms := EXTRACT(EPOCH FROM (NOW() - v_gate_pass.waktu_keluar)::INTERVAL) * 1000;
    
    -- If there's a positive delay, adjust the return time
    IF v_delay_ms > 0 THEN
      v_new_kembali := v_gate_pass.waktu_kembali + (v_delay_ms || ' milliseconds')::INTERVAL;
    ELSE
      v_new_kembali := v_gate_pass.waktu_kembali;
    END IF;

    UPDATE public.gate_pass
    SET status        = 'checked_in',
        actual_keluar = NOW(),
        waktu_kembali = v_new_kembali,
        updated_at    = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    
    v_message := 'Keluar berhasil (Checked-In)';

  ELSIF v_gate_pass.status IN ('checked_in', 'out') AND v_gate_pass.actual_kembali IS NULL THEN
    -- CHECK-IN: record actual return time
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

-- ── Also update authenticated_scan_pos_jaga ─────────────────────────

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
  v_delay_ms   BIGINT;
  v_new_kembali TIMESTAMP;
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
    -- CHECK-OUT: auto-adjust return time based on delay
    v_delay_ms := EXTRACT(EPOCH FROM (NOW() - v_gate_pass.waktu_keluar)::INTERVAL) * 1000;
    
    IF v_delay_ms > 0 THEN
      v_new_kembali := v_gate_pass.waktu_kembali + (v_delay_ms || ' milliseconds')::INTERVAL;
    ELSE
      v_new_kembali := v_gate_pass.waktu_kembali;
    END IF;

    UPDATE public.gate_pass
    SET status        = 'checked_in',
        actual_keluar = NOW(),
        waktu_kembali = v_new_kembali,
        updated_at    = NOW()
    WHERE id = v_gate_pass.id;

    v_message    := 'Scan keluar berhasil (Checked-In)';
    v_new_status := 'checked_in';

  ELSIF v_gate_pass.status IN ('checked_in', 'out') THEN
    -- CHECK-IN: record actual return time
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
