-- ============================================================
-- Gate Pass Fase C: Komandan approval (no auto-approve)
-- Harden status transition so approval only happens from pending.
-- ============================================================

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
    CASE WHEN p_caller_role = 'komandan' THEN 'approved'::public.gate_pass_status ELSE 'pending'::public.gate_pass_status END,
    CASE WHEN p_caller_role = 'komandan' THEN v_caller_id ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_update_gate_pass_status(
  p_caller_id   UUID,
  p_caller_role TEXT,
  p_id          UUID,
  p_status      TEXT,
  p_approved_by UUID DEFAULT NULL
)
RETURNS VOID
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

  -- Fase C approval: only admin/komandan can move pending -> approved/rejected.
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status update tidak valid via approval API: %', p_status;
  END IF;

  IF v_caller_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan yang dapat memproses approval gate pass';
  END IF;

  IF v_caller_role = 'komandan' AND v_caller_satuan IS DISTINCT FROM v_target_satuan THEN
    RAISE EXCEPTION 'Unauthorized: gate pass di luar satuan Anda';
  END IF;

  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Status gate pass sudah diproses (%), tidak bisa di-approval ulang', v_current_status::TEXT;
  END IF;

  UPDATE public.gate_pass
  SET status = p_status::public.gate_pass_status,
      approved_by = COALESCE(p_approved_by, v_caller_id),
      updated_at = NOW()
  WHERE id = p_id;
END;
$$;
