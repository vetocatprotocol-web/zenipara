-- ============================================================
-- KARYO OS — Migration 012: Fix auth/PIN helpers for Supabase
-- Replaces earlier function definitions with extension-qualified
-- pgcrypto calls so they work reliably in Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_nrp TEXT, p_pin TEXT)
RETURNS TABLE (user_id UUID) AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE nrp = p_nrp AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RETURN;
  END IF;

  IF v_user.pin_hash = extensions.crypt(p_pin, v_user.pin_hash) THEN
    user_id := v_user.id;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_login_attempts(p_nrp TEXT)
RETURNS VOID AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE public.users
  SET login_attempts = login_attempts + 1,
      locked_until = CASE
        WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
        ELSE locked_until
      END
  WHERE nrp = p_nrp
  RETURNING login_attempts INTO v_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reset_user_pin(p_user_id UUID, p_new_pin TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.change_user_pin(
  p_user_id UUID,
  p_old_pin TEXT,
  p_new_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_hash != extensions.crypt(p_old_pin, v_hash) THEN RETURN FALSE; END IF;

  UPDATE public.users
  SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;