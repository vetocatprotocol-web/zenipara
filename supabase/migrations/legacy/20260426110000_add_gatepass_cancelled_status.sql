-- ============================================================
-- Gate Pass: allow pemohon to cancel before keluar
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'gate_pass_status' AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE public.gate_pass_status ADD VALUE 'cancelled';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.api_update_gate_pass_status(
  p_caller_id       UUID,
  p_caller_role     TEXT,
  p_id              UUID,
  p_status          TEXT,
  p_approved_by     UUID DEFAULT NULL,
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
  v_target_user_id UUID;
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

  SELECT g.status, NULLIF(BTRIM(target.satuan), ''), g.user_id
    INTO v_current_status, v_target_satuan, v_target_user_id
  FROM public.gate_pass g
  JOIN public.users target ON target.id = g.user_id
  WHERE g.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gate pass tidak ditemukan';
  END IF;

  v_new_status := p_status::public.gate_pass_status;

  -- Pemohon bisa membatalkan gate pass miliknya sendiri selama belum scan keluar.
  IF v_new_status = 'cancelled' THEN
    IF v_caller_role <> 'prajurit' THEN
      RAISE EXCEPTION 'Unauthorized: hanya pemohon yang dapat membatalkan gate pass';
    END IF;

    IF v_target_user_id <> v_caller_id THEN
      RAISE EXCEPTION 'Unauthorized: Anda hanya dapat membatalkan gate pass milik sendiri';
    END IF;

    IF v_current_status NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Gate pass dengan status % tidak bisa dibatalkan', v_current_status::TEXT;
    END IF;

  -- Validate status transition for non-cancel flows.
  ELSIF v_current_status = 'pending' THEN
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

  -- Log approval decision / status transition
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