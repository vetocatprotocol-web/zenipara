-- ============================================================
-- KARYO OS — Migration 016: Ensure create_user_with_pin reactivates user
-- Fixes case where adding an existing NRP reports success but user stays hidden
-- due to is_active = false from previous deactivation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_user_with_pin(
  p_nrp     TEXT,
  p_pin     TEXT,
  p_nama    TEXT,
  p_role    TEXT,
  p_satuan  TEXT,
  p_pangkat TEXT DEFAULT NULL,
  p_jabatan TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.users (nrp, pin_hash, nama, role, satuan, pangkat, jabatan)
  VALUES (
    p_nrp,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_nama,
    p_role,
    p_satuan,
    p_pangkat,
    p_jabatan
  )
  ON CONFLICT (nrp) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      satuan = EXCLUDED.satuan,
      pangkat = EXCLUDED.pangkat,
      jabatan = EXCLUDED.jabatan,
      is_active = TRUE,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
