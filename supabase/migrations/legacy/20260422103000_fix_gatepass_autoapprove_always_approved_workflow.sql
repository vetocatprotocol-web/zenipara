-- ============================================================
-- KARYO OS — Fix Gate Pass auto-approve agar konsisten dengan alur operasi
-- Submit gate pass harus otomatis approved untuk role operasional aktif.
-- ============================================================

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
  SELECT public.canonicalize_role(role), satuan
    INTO v_user_role, v_satuan
  FROM public.users
  WHERE id = p_user_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User tidak ditemukan', NULL::JSONB;
    RETURN;
  END IF;

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

  v_criteria := jsonb_build_object(
    'user_role', v_user_role,
    'satuan', v_satuan,
    'previous_approvals', v_previous_approvals,
    'is_repeated_destination', v_is_repeated_destination,
    'is_working_hours', v_is_working_hours,
    'duration_hours', v_duration_hours
  );

  IF v_user_role IN ('admin', 'komandan', 'staf', 'guard', 'prajurit') THEN
    v_should_approve := TRUE;
    v_reason := FORMAT('Auto-approved: %s', INITCAP(v_user_role));
  ELSE
    v_should_approve := FALSE;
    v_reason := 'Membutuhkan approval komandan';
  END IF;

  RETURN QUERY SELECT v_should_approve, v_reason, v_criteria;
END;
$$;

NOTIFY pgrst, 'reload schema';
