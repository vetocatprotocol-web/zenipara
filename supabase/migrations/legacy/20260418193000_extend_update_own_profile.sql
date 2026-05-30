-- ============================================================
-- Extend self-profile update RPC
-- Allows users to update their own personal profile fields.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_user_id             UUID,
  p_tempat_lahir        TEXT,
  p_tanggal_lahir       TEXT,
  p_no_telepon          TEXT,
  p_alamat              TEXT,
  p_pendidikan_terakhir TEXT,
  p_agama               TEXT,
  p_status_pernikahan   TEXT,
  p_golongan_darah      TEXT,
  p_kontak_darurat_nama TEXT,
  p_kontak_darurat_telp TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_self_id UUID := public.current_karyo_user_id();
BEGIN
  IF p_user_id IS NULL OR v_self_id IS NULL OR p_user_id <> v_self_id THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah profil pengguna lain';
  END IF;

  UPDATE public.users
  SET
    tempat_lahir         = COALESCE(NULLIF(p_tempat_lahir, ''), tempat_lahir),
    tanggal_lahir        = COALESCE(NULLIF(p_tanggal_lahir, '')::DATE, tanggal_lahir),
    no_telepon           = COALESCE(NULLIF(p_no_telepon, ''), no_telepon),
    alamat               = COALESCE(NULLIF(p_alamat, ''), alamat),
    pendidikan_terakhir  = COALESCE(NULLIF(p_pendidikan_terakhir, ''), pendidikan_terakhir),
    agama                = COALESCE(NULLIF(p_agama, ''), agama),
    status_pernikahan    = COALESCE(NULLIF(p_status_pernikahan, ''), status_pernikahan),
    golongan_darah       = COALESCE(NULLIF(p_golongan_darah, ''), golongan_darah),
    kontak_darurat_nama   = COALESCE(NULLIF(p_kontak_darurat_nama, ''), kontak_darurat_nama),
    kontak_darurat_telp   = COALESCE(NULLIF(p_kontak_darurat_telp, ''), kontak_darurat_telp),
    updated_at            = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_profile(uuid, text, text, text, text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated;
