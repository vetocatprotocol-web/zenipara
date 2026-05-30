-- ============================================================
-- Fix api_get_gate_passes return type mismatch
-- gate_pass.tujuan is varchar(255), while function return type is TEXT.
-- ============================================================

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
