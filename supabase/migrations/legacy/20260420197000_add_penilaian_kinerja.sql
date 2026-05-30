-- ============================================================
-- KARYO OS — Modul Penilaian Kinerja (SKP/DP3 Digital)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.penilaian_periode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan TEXT NOT NULL,
  nama TEXT NOT NULL,
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif'
    CHECK (status IN ('aktif', 'ditutup')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tanggal_selesai >= tanggal_mulai)
);

CREATE TABLE IF NOT EXISTS public.penilaian_kinerja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID NOT NULL REFERENCES public.penilaian_periode(id) ON DELETE CASCADE,
  penilai_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dinilai_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kedisiplinan INTEGER NOT NULL CHECK (kedisiplinan BETWEEN 1 AND 100),
  kemampuan_teknis INTEGER NOT NULL CHECK (kemampuan_teknis BETWEEN 1 AND 100),
  kepemimpinan INTEGER NOT NULL CHECK (kepemimpinan BETWEEN 1 AND 100),
  loyalitas INTEGER NOT NULL CHECK (loyalitas BETWEEN 1 AND 100),
  fisik_mental INTEGER NOT NULL CHECK (fisik_mental BETWEEN 1 AND 100),
  nilai_akhir DECIMAL(5,2) GENERATED ALWAYS AS (
    (kedisiplinan + kemampuan_teknis + kepemimpinan + loyalitas + fisik_mental) / 5.0
  ) STORED,
  catatan TEXT,
  dinilai_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(periode_id, dinilai_id)
);

CREATE INDEX IF NOT EXISTS idx_penilaian_periode_satuan
  ON public.penilaian_periode(satuan, tanggal_mulai DESC);
CREATE INDEX IF NOT EXISTS idx_penilaian_kinerja_periode
  ON public.penilaian_kinerja(periode_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_kinerja_dinilai
  ON public.penilaian_kinerja(dinilai_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_kinerja_penilai
  ON public.penilaian_kinerja(penilai_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_penilaian_periode_updated_at'
  ) THEN
    CREATE TRIGGER trg_penilaian_periode_updated_at
      BEFORE UPDATE ON public.penilaian_periode
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.penilaian_periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penilaian_kinerja ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.penilaian_periode FROM anon, authenticated;
REVOKE ALL ON public.penilaian_kinerja FROM anon, authenticated;

-- ----------------------------------------------------------------
-- RPC: Ambil daftar periode penilaian
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_penilaian_periode(
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  satuan TEXT,
  nama TEXT,
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  jumlah_penilaian INTEGER
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
  IF NOT public.is_feature_enabled('penilaian_kinerja') THEN
    RETURN;
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    pp.id,
    pp.satuan,
    pp.nama,
    pp.tanggal_mulai,
    pp.tanggal_selesai,
    pp.status,
    pp.created_by,
    pp.created_at,
    COUNT(pk.id)::INTEGER AS jumlah_penilaian
  FROM public.penilaian_periode pp
  LEFT JOIN public.penilaian_kinerja pk ON pk.periode_id = pp.id
  WHERE
    (v_role = 'admin' OR pp.satuan = v_scope_satuan)
    AND (p_status IS NULL OR pp.status = p_status)
  GROUP BY pp.id
  ORDER BY pp.tanggal_mulai DESC;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Buat periode penilaian baru
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_create_penilaian_periode(
  p_nama TEXT,
  p_tanggal_mulai DATE,
  p_tanggal_selesai DATE
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
  IF NOT public.is_feature_enabled('penilaian_kinerja') THEN
    RAISE EXCEPTION 'penilaian_kinerja feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan yang dapat membuat periode penilaian';
  END IF;

  IF p_nama IS NULL OR BTRIM(p_nama) = '' THEN
    RAISE EXCEPTION 'Nama periode wajib diisi';
  END IF;

  IF p_tanggal_selesai < p_tanggal_mulai THEN
    RAISE EXCEPTION 'Tanggal selesai tidak boleh sebelum tanggal mulai';
  END IF;

  IF v_scope_satuan IS NULL THEN
    RAISE EXCEPTION 'Satuan pengguna tidak valid';
  END IF;

  INSERT INTO public.penilaian_periode (satuan, nama, tanggal_mulai, tanggal_selesai, created_by)
  VALUES (v_scope_satuan, BTRIM(p_nama), p_tanggal_mulai, p_tanggal_selesai, v_caller_id)
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Tutup periode penilaian
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_tutup_penilaian_periode(
  p_periode_id UUID
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
  v_periode_satuan TEXT;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pp.satuan INTO v_periode_satuan
  FROM public.penilaian_periode pp
  WHERE pp.id = p_periode_id;

  IF v_periode_satuan IS NULL THEN
    RAISE EXCEPTION 'Periode tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_periode_satuan THEN
    RAISE EXCEPTION 'Periode di luar satuan Anda';
  END IF;

  UPDATE public.penilaian_periode
  SET status = 'ditutup', updated_at = NOW()
  WHERE id = p_periode_id;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Ambil nilai personel dalam periode
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_penilaian_kinerja(
  p_periode_id UUID
)
RETURNS TABLE (
  id UUID,
  periode_id UUID,
  penilai_id UUID,
  dinilai_id UUID,
  kedisiplinan INTEGER,
  kemampuan_teknis INTEGER,
  kepemimpinan INTEGER,
  loyalitas INTEGER,
  fisik_mental INTEGER,
  nilai_akhir DECIMAL,
  catatan TEXT,
  dinilai_at TIMESTAMPTZ,
  dinilai_info JSON,
  penilai_info JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_periode_satuan TEXT;
  v_periode_status TEXT;
BEGIN
  IF NOT public.is_feature_enabled('penilaian_kinerja') THEN
    RETURN;
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pp.satuan, pp.status INTO v_periode_satuan, v_periode_status
  FROM public.penilaian_periode pp WHERE pp.id = p_periode_id;

  IF v_periode_satuan IS NULL THEN
    RAISE EXCEPTION 'Periode tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_periode_satuan THEN
    RAISE EXCEPTION 'Periode di luar satuan Anda';
  END IF;

  RETURN QUERY
  SELECT
    pk.id,
    pk.periode_id,
    pk.penilai_id,
    pk.dinilai_id,
    pk.kedisiplinan,
    pk.kemampuan_teknis,
    pk.kepemimpinan,
    pk.loyalitas,
    pk.fisik_mental,
    pk.nilai_akhir,
    pk.catatan,
    pk.dinilai_at,
    json_build_object(
      'id', ud.id, 'nama', ud.nama, 'nrp', ud.nrp,
      'pangkat', ud.pangkat, 'jabatan', ud.jabatan
    ) AS dinilai_info,
    json_build_object(
      'id', up.id, 'nama', up.nama, 'nrp', up.nrp,
      'pangkat', up.pangkat
    ) AS penilai_info
  FROM public.penilaian_kinerja pk
  JOIN public.users ud ON ud.id = pk.dinilai_id
  JOIN public.users up ON up.id = pk.penilai_id
  WHERE pk.periode_id = p_periode_id
    AND (
      v_role IN ('admin', 'komandan')
      OR pk.dinilai_id = v_caller_id
      -- prajurit hanya lihat nilai sendiri jika periode sudah ditutup
    )
    AND (
      v_role IN ('admin', 'komandan', 'staf')
      OR v_periode_status = 'ditutup'   -- prajurit hanya lihat setelah ditutup
    )
  ORDER BY ud.nama;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Simpan penilaian kinerja
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_upsert_penilaian_kinerja(
  p_periode_id UUID,
  p_dinilai_id UUID,
  p_kedisiplinan INTEGER,
  p_kemampuan_teknis INTEGER,
  p_kepemimpinan INTEGER,
  p_loyalitas INTEGER,
  p_fisik_mental INTEGER,
  p_catatan TEXT DEFAULT NULL
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
  v_periode_satuan TEXT;
  v_periode_status TEXT;
  v_result UUID;
BEGIN
  IF NOT public.is_feature_enabled('penilaian_kinerja') THEN
    RAISE EXCEPTION 'penilaian_kinerja feature is disabled';
  END IF;

  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT u.role, NULLIF(BTRIM(u.satuan), '')
    INTO v_role, v_scope_satuan
  FROM public.users u
  WHERE u.id = v_caller_id AND u.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'komandan') THEN
    RAISE EXCEPTION 'Unauthorized: hanya komandan/admin yang dapat menilai';
  END IF;

  SELECT pp.satuan, pp.status INTO v_periode_satuan, v_periode_status
  FROM public.penilaian_periode pp WHERE pp.id = p_periode_id;

  IF v_periode_satuan IS NULL THEN
    RAISE EXCEPTION 'Periode tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_periode_satuan THEN
    RAISE EXCEPTION 'Periode di luar satuan Anda';
  END IF;

  IF v_periode_status = 'ditutup' THEN
    RAISE EXCEPTION 'Periode penilaian sudah ditutup';
  END IF;

  -- Validasi skor
  IF p_kedisiplinan NOT BETWEEN 1 AND 100 OR
     p_kemampuan_teknis NOT BETWEEN 1 AND 100 OR
     p_kepemimpinan NOT BETWEEN 1 AND 100 OR
     p_loyalitas NOT BETWEEN 1 AND 100 OR
     p_fisik_mental NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Nilai harus antara 1-100';
  END IF;

  INSERT INTO public.penilaian_kinerja (
    periode_id, penilai_id, dinilai_id,
    kedisiplinan, kemampuan_teknis, kepemimpinan, loyalitas, fisik_mental,
    catatan, dinilai_at
  )
  VALUES (
    p_periode_id, v_caller_id, p_dinilai_id,
    p_kedisiplinan, p_kemampuan_teknis, p_kepemimpinan, p_loyalitas, p_fisik_mental,
    NULLIF(BTRIM(p_catatan), ''), NOW()
  )
  ON CONFLICT (periode_id, dinilai_id) DO UPDATE SET
    penilai_id = v_caller_id,
    kedisiplinan = EXCLUDED.kedisiplinan,
    kemampuan_teknis = EXCLUDED.kemampuan_teknis,
    kepemimpinan = EXCLUDED.kepemimpinan,
    loyalitas = EXCLUDED.loyalitas,
    fisik_mental = EXCLUDED.fisik_mental,
    catatan = EXCLUDED.catatan,
    dinilai_at = NOW()
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_penilaian_periode(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_penilaian_periode(TEXT, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_tutup_penilaian_periode(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_penilaian_kinerja(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_upsert_penilaian_kinerja(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES ('penilaian_kinerja', true)
ON CONFLICT (feature_key) DO NOTHING;
