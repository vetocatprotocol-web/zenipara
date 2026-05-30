-- ============================================================
-- Gate Pass workflow update (post enum commit)
-- 1) Submit is auto-approved
-- 2) Static Pos Jaga QR scan is mandatory for keluar and kembali
-- 3) Status transition: approved -> checked_in -> completed
-- ============================================================

-- Keep guard policies aligned with new statuses.
DROP POLICY IF EXISTS "Guard dapat melihat gate pass scan" ON public.gate_pass;
CREATE POLICY "Guard dapat melihat gate pass scan" ON public.gate_pass
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = current_karyo_user_id() AND u.role = 'guard'
    )
    AND (status IN ('approved', 'checked_in', 'completed', 'out', 'returned'))
  );

DROP POLICY IF EXISTS "Guard update status keluar/masuk" ON public.gate_pass;
CREATE POLICY "Guard update status keluar/masuk" ON public.gate_pass
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = current_karyo_user_id() AND u.role = 'guard'
    )
    AND (status IN ('approved', 'checked_in', 'out'))
  )
  WITH CHECK (
    (status IN ('approved', 'checked_in', 'completed', 'out', 'returned', 'overdue'))
  );

-- Legacy policy compatibility from migration 006.
DROP POLICY IF EXISTS "Guard hanya bisa update status via QR" ON public.gate_pass;
CREATE POLICY "Guard hanya bisa update status via QR"
  ON public.gate_pass
  FOR UPDATE TO anon USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_karyo_user_id()
      AND u.role = 'guard'
    )
  ) WITH CHECK (
    status IN ('checked_in', 'completed', 'out', 'returned', 'overdue')
  );

-- Auto-approved submit.
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
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
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
    'approved',
    p_user_id
  );
END;
$$;

-- Keep API read aligned and gate_pass feature-aware.
CREATE OR REPLACE FUNCTION public.api_get_gate_passes(
  p_user_id        UUID,
  p_role           TEXT,
  p_target_user_id UUID    DEFAULT NULL,
  p_status_filter  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  keperluan       TEXT,
  tujuan          TEXT,
  waktu_keluar    TIMESTAMPTZ,
  waktu_kembali   TIMESTAMPTZ,
  actual_keluar   TIMESTAMPTZ,
  actual_kembali  TIMESTAMPTZ,
  status          TEXT,
  approved_by     UUID,
  qr_token        TEXT,
  created_at      TIMESTAMPTZ,
  "user"          JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RETURN;
  END IF;

  IF p_role IN ('admin', 'komandan', 'guard') THEN
    RETURN QUERY
    SELECT
      g.id,
      g.user_id,
      g.keperluan,
      g.tujuan::TEXT,
      g.waktu_keluar,
      g.waktu_kembali,
      g.actual_keluar,
      g.actual_kembali,
      g.status::TEXT,
      g.approved_by,
      g.qr_token,
      g.created_at,
      CASE WHEN u.id IS NOT NULL
        THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat, 'satuan', u.satuan)
        ELSE NULL
      END
    FROM public.gate_pass g
    LEFT JOIN public.users u ON g.user_id = u.id
    WHERE (p_target_user_id IS NULL OR g.user_id = p_target_user_id)
      AND (p_status_filter IS NULL OR g.status::TEXT = p_status_filter)
    ORDER BY g.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      g.id,
      g.user_id,
      g.keperluan,
      g.tujuan::TEXT,
      g.waktu_keluar,
      g.waktu_kembali,
      g.actual_keluar,
      g.actual_kembali,
      g.status::TEXT,
      g.approved_by,
      g.qr_token,
      g.created_at,
      NULL::JSON
    FROM public.gate_pass g
    WHERE g.user_id = p_user_id
      AND (p_status_filter IS NULL OR g.status::TEXT = p_status_filter)
    ORDER BY g.created_at DESC;
  END IF;
END;
$$;

-- Static Pos Jaga scan flow using new status names.
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
  v_pos        public.pos_jaga%ROWTYPE;
  v_gate_pass  public.gate_pass%ROWTYPE;
  v_message    text;
  v_new_status text;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
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
    SET status = 'checked_in',
        actual_keluar = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id;

    v_message := 'Scan keluar berhasil (Checked-In)';
    v_new_status := 'checked_in';

  ELSIF v_gate_pass.status IN ('checked_in', 'out') THEN
    UPDATE public.gate_pass
    SET status = 'completed',
        actual_kembali = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id;

    v_message := 'Scan kembali berhasil (Completed)';
    v_new_status := 'completed';

  ELSE
    RAISE EXCEPTION 'Status gate pass tidak valid untuk scan';
  END IF;

  RETURN jsonb_build_object(
    'gate_pass_id', v_gate_pass.id,
    'pos_nama', v_pos.nama,
    'status', v_new_status,
    'message', v_message
  );
END;
$$;

-- Keep legacy guard scanner behavior aligned.
CREATE OR REPLACE FUNCTION public.server_scan_gate_pass(p_qr_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_gate_pass public.gate_pass%ROWTYPE;
  v_result public.gate_pass%ROWTYPE;
  v_message TEXT;
BEGIN
  IF NOT is_feature_enabled('gate_pass') THEN
    RAISE EXCEPTION 'gate_pass feature is disabled';
  END IF;

  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR tidak valid';
  END IF;

  IF v_gate_pass.status = 'approved' AND v_gate_pass.actual_keluar IS NULL THEN
    UPDATE public.gate_pass
    SET status = 'checked_in',
        actual_keluar = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Keluar berhasil (Checked-In)';
  ELSIF v_gate_pass.status IN ('checked_in', 'out') AND v_gate_pass.actual_kembali IS NULL THEN
    UPDATE public.gate_pass
    SET status = 'completed',
        actual_kembali = NOW(),
        updated_at = NOW()
    WHERE id = v_gate_pass.id
    RETURNING * INTO v_result;
    v_message := 'Kembali berhasil (Completed)';
  ELSIF v_gate_pass.status IN ('completed', 'returned') THEN
    RAISE EXCEPTION 'Sudah completed, tidak bisa scan lagi';
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
