-- ============================================================
-- KARYO OS — Enhanced Gate Pass Validation & Auto-Approval
--
-- Features:
-- - Allow gate pass auto-approval based on role/history
-- - Validate duration, timing, and destination rules
-- - Enhanced status transitions with validation
-- - Track approval decisions with reasons
-- ============================================================

-- Optional: Add column to track approval reason/decision
ALTER TABLE public.gate_pass
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;

-- Create a table to track auto-approval decisions
CREATE TABLE IF NOT EXISTS gate_pass_approval_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_pass_id UUID NOT NULL REFERENCES gate_pass(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approval_status TEXT NOT NULL,
  is_auto BOOLEAN DEFAULT FALSE,
  approval_reason TEXT,
  criteria_met JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_pass_approval_log_gp_id ON gate_pass_approval_log(gate_pass_id);
CREATE INDEX IF NOT EXISTS idx_gate_pass_approval_log_approver ON gate_pass_approval_log(approver_id);

-- Function to check auto-approval criteria
CREATE OR REPLACE FUNCTION public.should_auto_approve_gate_pass(
  p_user_id UUID,
  p_keperluan TEXT,
  p_tujuan TEXT,
  p_waktu_keluar TIMESTAMPTZ,
  p_waktu_kembali TIMESTAMPTZ
)
RETURNS TABLE (
  should_approve BOOLEAN,
  reason TEXT,
  criteria JSONB
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_user_role TEXT;
  v_satuan TEXT;
  v_previous_approvals INT;
  v_is_repeated_destination BOOLEAN;
  v_is_working_hours BOOLEAN;
  v_duration_hours INT;
  v_criteria JSONB;
  v_reason TEXT;
  v_should_approve BOOLEAN := FALSE;
BEGIN
  -- Get user info
  SELECT role, satuan INTO v_user_role, v_satuan
  FROM public.users
  WHERE id = p_user_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User tidak ditemukan', NULL::JSONB;
    RETURN;
  END IF;

  -- Calculate criteria
  SELECT COUNT(*) INTO v_previous_approvals
  FROM public.gate_pass
  WHERE user_id = p_user_id AND status IN ('completed', 'returned');

  SELECT EXISTS (
    SELECT 1 FROM public.gate_pass
    WHERE user_id = p_user_id
      AND tujuan = p_tujuan
      AND status IN ('completed', 'returned')
  ) INTO v_is_repeated_destination;

  v_is_working_hours := EXTRACT(DOW FROM p_waktu_keluar) NOT IN (0, 6)
                     AND EXTRACT(HOUR FROM p_waktu_keluar) >= 7
                     AND EXTRACT(HOUR FROM p_waktu_keluar) < 18;

  v_duration_hours := EXTRACT(EPOCH FROM (p_waktu_kembali - p_waktu_keluar)) / 3600;

  -- Build criteria object
  v_criteria := jsonb_build_object(
    'user_role', v_user_role,
    'satuan', v_satuan,
    'previous_approvals', v_previous_approvals,
    'is_repeated_destination', v_is_repeated_destination,
    'is_working_hours', v_is_working_hours,
    'duration_hours', v_duration_hours
  );

  -- Decision logic
  IF v_user_role = 'komandan' THEN
    v_should_approve := TRUE;
    v_reason := 'Auto-approved: Komandan';
  ELSIF v_user_role = 'admin' THEN
    v_should_approve := TRUE;
    v_reason := 'Auto-approved: Admin';
  ELSIF v_user_role = 'prajurit' THEN
    -- Auto-approve prajurit if:
    -- 1. Previous 3+ approvals history
    -- 2. Repeated/known destination
    -- 3. Duration <= 1 day
    -- 4. During working hours
    IF v_previous_approvals >= 3
       AND v_is_repeated_destination
       AND v_duration_hours <= 24
       AND v_is_working_hours THEN
      v_should_approve := TRUE;
      v_reason := 'Auto-approved: Prajurit dengan track record baik (3+ approvals, destinasi rutin, durasi ≤1 hari, jam kerja)';
    ELSE
      v_should_approve := FALSE;
      v_reason := 'Membutuhkan approval komandan';
    END IF;
  END IF;

  RETURN QUERY SELECT v_should_approve, v_reason, v_criteria;
END;
$$;


-- Enhanced api_insert_gate_pass with validation & auto-approval
DROP FUNCTION IF EXISTS public.api_insert_gate_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE FUNCTION public.api_insert_gate_pass(
  p_user_id       UUID,
  p_caller_role   TEXT,
  p_keperluan     TEXT,
  p_tujuan        TEXT,
  p_waktu_keluar  TIMESTAMPTZ,
  p_waktu_kembali TIMESTAMPTZ,
  p_qr_token      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_gate_pass_id UUID;
  v_should_approve BOOLEAN;
  v_approval_reason TEXT;
  v_criteria JSONB;
  v_result JSONB;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Authorization: Only self or admin
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

  -- Validation: Duration check (max 7 days)
  IF (p_waktu_kembali - p_waktu_keluar) > INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Durasi izin maksimal 7 hari';
  END IF;

  -- Validation: Destination/reason not too short or too long
  IF LENGTH(BTRIM(p_tujuan)) < 3 OR LENGTH(BTRIM(p_tujuan)) > 255 THEN
    RAISE EXCEPTION 'Tujuan harus 3-255 karakter';
  END IF;

  IF LENGTH(BTRIM(p_keperluan)) < 5 OR LENGTH(BTRIM(p_keperluan)) > 255 THEN
    RAISE EXCEPTION 'Keperluan harus 5-255 karakter';
  END IF;

  -- Check auto-approval criteria
  SELECT should_approve, reason, criteria
    INTO v_should_approve, v_approval_reason, v_criteria
  FROM public.should_auto_approve_gate_pass(
    p_user_id,
    p_keperluan,
    p_tujuan,
    p_waktu_keluar,
    p_waktu_kembali
  );

  -- Insert gate pass
  INSERT INTO public.gate_pass (
    user_id,
    keperluan,
    tujuan,
    waktu_keluar,
    waktu_kembali,
    qr_token,
    status,
    approved_by,
    auto_approved,
    approval_reason
  )
  VALUES (
    p_user_id,
    p_keperluan,
    p_tujuan,
    p_waktu_keluar,
    p_waktu_kembali,
    p_qr_token,
    CASE WHEN v_should_approve THEN 'approved'::public.gate_pass_status ELSE 'pending'::public.gate_pass_status END,
    CASE WHEN v_should_approve THEN v_caller_id ELSE NULL END,
    v_should_approve,
    v_approval_reason
  )
  RETURNING id INTO v_gate_pass_id;

  -- Log approval decision
  IF v_should_approve THEN
    INSERT INTO public.gate_pass_approval_log (
      gate_pass_id,
      approver_id,
      approval_status,
      is_auto,
      approval_reason,
      criteria_met
    )
    VALUES (
      v_gate_pass_id,
      v_caller_id,
      'approved',
      TRUE,
      v_approval_reason,
      v_criteria
    );
  END IF;

  v_result := jsonb_build_object(
    'gate_pass_id', v_gate_pass_id,
    'auto_approved', v_should_approve,
    'status', CASE WHEN v_should_approve THEN 'approved' ELSE 'pending' END,
    'approval_reason', v_approval_reason
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_insert_gate_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;


-- Enhanced gate pass approval with validation
DROP FUNCTION IF EXISTS public.api_update_gate_pass_status(UUID, TEXT, UUID, TEXT, UUID, TEXT);

CREATE FUNCTION public.api_update_gate_pass_status(
  p_caller_id     UUID,
  p_caller_role   TEXT,
  p_id            UUID,
  p_status        TEXT,
  p_approved_by   UUID DEFAULT NULL,
  p_approval_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_satuan TEXT;
  v_target_satuan TEXT;
  v_current_status public.gate_pass_status;
  v_new_status public.gate_pass_status;
  v_result JSONB;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_caller_id <> p_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_caller_role, v_caller_satuan
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: caller not found';
  END IF;

  SELECT g.status, NULLIF(BTRIM(target.satuan), '')
    INTO v_current_status, v_target_satuan
  FROM public.gate_pass g
  JOIN public.users target ON target.id = g.user_id
  WHERE g.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gate pass tidak ditemukan';
  END IF;

  v_new_status := p_status::public.gate_pass_status;

  -- Validate status transition
  IF v_current_status = 'pending' THEN
    -- Only admin/komandan can approve/reject pending
    IF v_new_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Status pending hanya bisa dirubah ke approved/rejected';
    END IF;
    
    IF v_caller_role NOT IN ('admin', 'komandan') THEN
      RAISE EXCEPTION 'Unauthorized: hanya admin/komandan yang dapat memproses approval';
    END IF;

    -- Komandan hanya approve gate pass di satuannya
    IF v_caller_role = 'komandan' AND v_caller_satuan IS DISTINCT FROM v_target_satuan THEN
      RAISE EXCEPTION 'Unauthorized: gate pass di luar satuan Anda';
    END IF;
  ELSIF v_current_status = 'approved' THEN
    -- Only guard can transition to checked_in/out
    IF v_new_status NOT IN ('checked_in', 'out') THEN
      RAISE EXCEPTION 'Status approved hanya bisa dirubah ke checked_in/out (scan keluar)';
    END IF;
    
    IF v_caller_role NOT IN ('admin', 'guard') THEN
      RAISE EXCEPTION 'Unauthorized: hanya admin/guard yang dapat scan keluar';
    END IF;
  ELSIF v_current_status IN ('checked_in', 'out') THEN
    -- Only guard can transition to completed/returned
    IF v_new_status NOT IN ('completed', 'returned', 'overdue') THEN
      RAISE EXCEPTION 'Status checked_in hanya bisa dirubah ke completed/returned/overdue (scan kembali)';
    END IF;
    
    IF v_caller_role NOT IN ('admin', 'guard') THEN
      RAISE EXCEPTION 'Unauthorized: hanya admin/guard yang dapat scan kembali';
    END IF;
  ELSE
    RAISE EXCEPTION 'Status % tidak bisa dirubah lagi', v_current_status::TEXT;
  END IF;

  UPDATE public.gate_pass
  SET status = v_new_status,
      approved_by = COALESCE(p_approved_by, approved_by),
      approval_reason = COALESCE(p_approval_reason, approval_reason),
      updated_at = NOW()
  WHERE id = p_id;

  -- Log approval decision
  INSERT INTO public.gate_pass_approval_log (
    gate_pass_id,
    approver_id,
    approval_status,
    is_auto,
    approval_reason
  )
  VALUES (
    p_id,
    v_caller_id,
    v_new_status::TEXT,
    FALSE,
    p_approval_reason
  );

  v_result := jsonb_build_object(
    'gate_pass_id', p_id,
    'status', v_new_status::TEXT,
    'message', 'Status berhasil diperbarui'
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_update_gate_pass_status(UUID, TEXT, UUID, TEXT, UUID, TEXT) TO anon;

-- Function to get approval statistics
CREATE OR REPLACE FUNCTION public.api_get_approval_stats(p_user_id UUID)
RETURNS TABLE (
  total_gate_passes INT,
  completed INT,
  pending INT,
  rejected INT,
  auto_approved INT,
  approval_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.gate_pass
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT
    v_total,
    COUNT(*) FILTER (WHERE status IN ('completed', 'returned'))::INT,
    COUNT(*) FILTER (WHERE status = 'pending')::INT,
    COUNT(*) FILTER (WHERE status = 'rejected')::INT,
    COUNT(*) FILTER (WHERE auto_approved = TRUE)::INT,
    CASE WHEN v_total > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE status IN ('completed', 'returned'))::NUMERIC / v_total * 100,
        2
      )
      ELSE 0
    END
  FROM public.gate_pass
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_approval_stats(UUID) TO anon;
