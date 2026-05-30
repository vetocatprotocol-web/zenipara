-- ============================================================
-- KARYO OS — Modul Kalender Kegiatan Satuan
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan TEXT NOT NULL,
  satuan_id UUID REFERENCES public.satuans(id) ON DELETE SET NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  jenis TEXT NOT NULL CHECK (jenis IN ('latihan', 'upacara', 'inspeksi', 'perjalanan', 'rapat', 'lainnya')),
  tanggal_mulai TIMESTAMPTZ NOT NULL,
  tanggal_selesai TIMESTAMPTZ NOT NULL,
  lokasi TEXT,
  target_role TEXT[],
  is_wajib BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tanggal_selesai >= tanggal_mulai)
);

CREATE TABLE IF NOT EXISTS public.kegiatan_rsvp (
  kegiatan_id UUID NOT NULL REFERENCES public.kegiatan(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('hadir', 'tidak_hadir', 'belum')),
  alasan TEXT,
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (kegiatan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_satuan_tanggal
  ON public.kegiatan(satuan, tanggal_mulai DESC);
CREATE INDEX IF NOT EXISTS idx_kegiatan_tanggal_mulai
  ON public.kegiatan(tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_kegiatan_rsvp_user
  ON public.kegiatan_rsvp(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kegiatan_updated_at'
  ) THEN
    CREATE TRIGGER trg_kegiatan_updated_at
      BEFORE UPDATE ON public.kegiatan
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kegiatan_rsvp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kegiatan FROM anon, authenticated;
REVOKE ALL ON public.kegiatan_rsvp FROM anon, authenticated;

-- ----------------------------------------------------------------
-- RPC: Ambil daftar kegiatan (semua role yang relevan)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_kegiatan(
  p_tanggal_dari DATE DEFAULT NULL,
  p_tanggal_sampai DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  satuan TEXT,
  judul TEXT,
  deskripsi TEXT,
  jenis TEXT,
  tanggal_mulai TIMESTAMPTZ,
  tanggal_selesai TIMESTAMPTZ,
  lokasi TEXT,
  target_role TEXT[],
  is_wajib BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  rsvp_hadir INTEGER,
  rsvp_tidak_hadir INTEGER,
  rsvp_total INTEGER,
  my_rsvp TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
BEGIN
  IF NOT public.is_feature_enabled('kalender_kegiatan') THEN
    RETURN;
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    k.id,
    k.satuan,
    k.judul,
    k.deskripsi,
    k.jenis,
    k.tanggal_mulai,
    k.tanggal_selesai,
    k.lokasi,
    k.target_role,
    k.is_wajib,
    k.created_by,
    k.created_at,
    COUNT(*) FILTER (WHERE r.status = 'hadir')::INTEGER AS rsvp_hadir,
    COUNT(*) FILTER (WHERE r.status = 'tidak_hadir')::INTEGER AS rsvp_tidak_hadir,
    COUNT(r.user_id)::INTEGER AS rsvp_total,
    COALESCE(
      (SELECT r2.status FROM public.kegiatan_rsvp r2
       WHERE r2.kegiatan_id = k.id AND r2.user_id = v_caller_id),
      'belum'
    ) AS my_rsvp
  FROM public.kegiatan k
  LEFT JOIN public.kegiatan_rsvp r ON r.kegiatan_id = k.id
  WHERE
    (v_role = 'admin' OR k.satuan = v_scope_satuan OR k.target_role IS NULL OR v_role::TEXT = ANY(k.target_role))
    AND (p_tanggal_dari IS NULL OR k.tanggal_mulai::DATE >= p_tanggal_dari)
    AND (p_tanggal_sampai IS NULL OR k.tanggal_selesai::DATE <= p_tanggal_sampai)
  GROUP BY k.id
  ORDER BY k.tanggal_mulai ASC;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Buat kegiatan baru
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_create_kegiatan(
  p_judul TEXT,
  p_jenis TEXT,
  p_tanggal_mulai TIMESTAMPTZ,
  p_tanggal_selesai TIMESTAMPTZ,
  p_deskripsi TEXT DEFAULT NULL,
  p_lokasi TEXT DEFAULT NULL,
  p_target_role TEXT[] DEFAULT NULL,
  p_is_wajib BOOLEAN DEFAULT TRUE,
  p_satuan TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_result UUID;
BEGIN
  IF NOT public.is_feature_enabled('kalender_kegiatan') THEN
    RAISE EXCEPTION 'kalender_kegiatan feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'komandan', 'staf') THEN
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan/staf yang dapat membuat kegiatan';
  END IF;

  IF p_judul IS NULL OR BTRIM(p_judul) = '' THEN
    RAISE EXCEPTION 'Judul kegiatan wajib diisi';
  END IF;

  IF p_jenis NOT IN ('latihan', 'upacara', 'inspeksi', 'perjalanan', 'rapat', 'lainnya') THEN
    RAISE EXCEPTION 'Jenis kegiatan tidak valid';
  END IF;

  IF p_tanggal_mulai IS NULL OR p_tanggal_selesai IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai dan selesai wajib diisi';
  END IF;

  IF p_tanggal_selesai < p_tanggal_mulai THEN
    RAISE EXCEPTION 'Tanggal selesai tidak boleh sebelum tanggal mulai';
  END IF;

  INSERT INTO public.kegiatan (
    satuan,
    judul,
    deskripsi,
    jenis,
    tanggal_mulai,
    tanggal_selesai,
    lokasi,
    target_role,
    is_wajib,
    created_by
  )
  VALUES (
    CASE WHEN v_role = 'admin'
      THEN COALESCE(NULLIF(BTRIM(p_satuan), ''), v_scope_satuan, '')
      ELSE COALESCE(v_scope_satuan, '')
    END,
    BTRIM(p_judul),
    NULLIF(BTRIM(p_deskripsi), ''),
    p_jenis,
    p_tanggal_mulai,
    p_tanggal_selesai,
    NULLIF(BTRIM(p_lokasi), ''),
    p_target_role,
    COALESCE(p_is_wajib, TRUE),
    v_caller_id
  )
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: RSVP kegiatan
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_rsvp_kegiatan(
  p_kegiatan_id UUID,
  p_status TEXT,
  p_alasan TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_kegiatan_satuan TEXT;
BEGIN
  IF NOT public.is_feature_enabled('kalender_kegiatan') THEN
    RAISE EXCEPTION 'kalender_kegiatan feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('hadir', 'tidak_hadir', 'belum') THEN
    RAISE EXCEPTION 'Status RSVP tidak valid';
  END IF;

  SELECT k.satuan
    INTO v_kegiatan_satuan
  FROM public.kegiatan k
  WHERE k.id = p_kegiatan_id;

  IF v_kegiatan_satuan IS NULL THEN
    RAISE EXCEPTION 'Kegiatan tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_kegiatan_satuan THEN
    RAISE EXCEPTION 'Kegiatan di luar satuan Anda';
  END IF;

  INSERT INTO public.kegiatan_rsvp (kegiatan_id, user_id, status, alasan, responded_at)
  VALUES (p_kegiatan_id, v_caller_id, p_status, NULLIF(BTRIM(p_alasan), ''), NOW())
  ON CONFLICT (kegiatan_id, user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    alasan = EXCLUDED.alasan,
    responded_at = NOW();
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Hapus kegiatan
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_delete_kegiatan(
  p_kegiatan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_kegiatan_satuan TEXT;
  v_created_by UUID;
BEGIN
  IF NOT public.is_feature_enabled('kalender_kegiatan') THEN
    RAISE EXCEPTION 'kalender_kegiatan feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id
    AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'komandan', 'staf') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT k.satuan, k.created_by
    INTO v_kegiatan_satuan, v_created_by
  FROM public.kegiatan k
  WHERE k.id = p_kegiatan_id;

  IF v_kegiatan_satuan IS NULL THEN
    RAISE EXCEPTION 'Kegiatan tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_kegiatan_satuan THEN
    RAISE EXCEPTION 'Kegiatan di luar satuan Anda';
  END IF;

  DELETE FROM public.kegiatan WHERE id = p_kegiatan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_kegiatan(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_kegiatan(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT[], BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rsvp_kegiatan(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_kegiatan(UUID) TO anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES ('kalender_kegiatan', true)
ON CONFLICT (feature_key) DO NOTHING;
