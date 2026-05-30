-- ============================================================
-- KARYO OS — Migration 009: Server-side gate pass scan function
-- Uses server timestamps so scan time is consistent with attendance.
-- ============================================================

CREATE OR REPLACE FUNCTION public.server_scan_gate_pass(p_qr_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gate_pass public.gate_pass%ROWTYPE;
  v_result public.gate_pass%ROWTYPE;
  v_message TEXT;
BEGIN
  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR tidak valid';
  END IF;

  IF v_gate_pass.status = 'approved' AND v_gate_pass.actual_keluar IS NULL THEN
    UPDATE public.gate_pass
    SET status = 'out',
        actual_keluar = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Keluar berhasil';
  ELSIF v_gate_pass.status = 'out' AND v_gate_pass.actual_kembali IS NULL THEN
    UPDATE public.gate_pass
    SET status = 'returned',
        actual_kembali = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Kembali berhasil';
  ELSIF v_gate_pass.status = 'returned' THEN
    RAISE EXCEPTION 'Sudah kembali, tidak bisa scan lagi';
  ELSE
    RAISE EXCEPTION 'Status gate pass tidak valid untuk scan';
  END IF;

  RETURN jsonb_build_object(
    'id', v_result.id,
    'status', v_result.status,
    'actual_keluar', v_result.actual_keluar,
    'actual_kembali', v_result.actual_kembali,
    'message', v_message
  );
END;
$$;
