-- ============================================================
-- KARYO OS — Harden Gate Pass submit flow
-- Pastikan pengajuan gate pass selalu auto-approved sesuai alur operasional.
-- ============================================================

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
  v_user_role TEXT;
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

  IF (p_waktu_kembali - p_waktu_keluar) > INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Durasi izin maksimal 7 hari';
  END IF;

  IF LENGTH(BTRIM(p_tujuan)) < 3 OR LENGTH(BTRIM(p_tujuan)) > 255 THEN
    RAISE EXCEPTION 'Tujuan harus 3-255 karakter';
  END IF;

  IF LENGTH(BTRIM(p_keperluan)) < 5 OR LENGTH(BTRIM(p_keperluan)) > 255 THEN
    RAISE EXCEPTION 'Keperluan harus 5-255 karakter';
  END IF;

  SELECT public.canonicalize_role(u.role)
    INTO v_user_role
  FROM public.users u
  WHERE u.id = p_user_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User tidak ditemukan';
  END IF;

  v_approval_reason := FORMAT('Auto-approved: %s', INITCAP(v_user_role));
  v_criteria := jsonb_build_object(
    'user_role', v_user_role,
    'forced_auto_approve', TRUE
  );

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
    'approved'::public.gate_pass_status,
    v_caller_id,
    TRUE,
    v_approval_reason
  )
  RETURNING id INTO v_gate_pass_id;

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

  v_result := jsonb_build_object(
    'gate_pass_id', v_gate_pass_id,
    'auto_approved', TRUE,
    'status', 'approved',
    'approval_reason', v_approval_reason
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_insert_gate_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
