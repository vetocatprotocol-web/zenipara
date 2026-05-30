-- ============================================================
-- KARYO OS — Modul Surat Perintah (Sprint)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sprint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_surat TEXT NOT NULL UNIQUE,
  satuan TEXT NOT NULL,
  judul TEXT NOT NULL,
  dasar TEXT,
  tujuan TEXT NOT NULL,
  tempat_tujuan TEXT NOT NULL,
  tanggal_berangkat DATE NOT NULL,
  tanggal_kembali DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'active', 'selesai', 'dibatalkan')),
  dibuat_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL,
  disetujui_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL,
  disetujui_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tanggal_kembali >= tanggal_berangkat)
);

CREATE TABLE IF NOT EXISTS public.sprint_personel (
  sprint_id UUID NOT NULL REFERENCES public.sprint(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jabatan_dalam_sprint TEXT DEFAULT 'anggota',
  laporan_kembali TEXT,
  kembali_at TIMESTAMPTZ,
  PRIMARY KEY (sprint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_satuan_tanggal
  ON public.sprint(satuan, tanggal_berangkat DESC);
CREATE INDEX IF NOT EXISTS idx_sprint_status
  ON public.sprint(status);
CREATE INDEX IF NOT EXISTS idx_sprint_personel_user
  ON public.sprint_personel(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sprint_updated_at'
  ) THEN
    CREATE TRIGGER trg_sprint_updated_at
      BEFORE UPDATE ON public.sprint
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.sprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_personel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sprint FROM anon, authenticated;
REVOKE ALL ON public.sprint_personel FROM anon, authenticated;

-- ----------------------------------------------------------------
-- Helper: Generate nomor surat Sprint
-- Format: SPRINT/001/IV/2026/SAT
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_nomor_sprint(
  p_satuan TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_bulan TEXT;
  v_tahun TEXT;
  v_seq INTEGER;
BEGIN
  v_bulan := TO_CHAR(NOW(), 'fmRMN');
  v_tahun := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(nomor_surat, '^SPRINT/([0-9]+)/.*', '\1'), '')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM public.sprint
  WHERE satuan = p_satuan
    AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM');

  RETURN 'SPRINT/' ||
         LPAD(v_seq::TEXT, 3, '0') || '/' ||
         v_bulan || '/' || v_tahun || '/' ||
         UPPER(LEFT(REGEXP_REPLACE(p_satuan, '[^a-zA-Z0-9]', '', 'g'), 4));
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Ambil daftar sprint
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_sprint(
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nomor_surat TEXT,
  satuan TEXT,
  judul TEXT,
  dasar TEXT,
  tujuan TEXT,
  tempat_tujuan TEXT,
  tanggal_berangkat DATE,
  tanggal_kembali DATE,
  status TEXT,
  dibuat_oleh UUID,
  disetujui_oleh UUID,
  disetujui_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  pembuat JSON,
  jumlah_personel INTEGER
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
  IF NOT public.is_feature_enabled('sprint') THEN
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
    s.id,
    s.nomor_surat,
    s.satuan,
    s.judul,
    s.dasar,
    s.tujuan,
    s.tempat_tujuan,
    s.tanggal_berangkat,
    s.tanggal_kembali,
    s.status,
    s.dibuat_oleh,
    s.disetujui_oleh,
    s.disetujui_at,
    s.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
      ELSE NULL
    END AS pembuat,
    COUNT(sp.user_id)::INTEGER AS jumlah_personel
  FROM public.sprint s
  LEFT JOIN public.users u ON u.id = s.dibuat_oleh
  LEFT JOIN public.sprint_personel sp ON sp.sprint_id = s.id
  WHERE
    (
      v_role = 'admin'
      OR s.satuan = v_scope_satuan
      OR EXISTS (
        SELECT 1 FROM public.sprint_personel sp2
        WHERE sp2.sprint_id = s.id AND sp2.user_id = v_caller_id
      )
    )
    AND (p_status IS NULL OR s.status = p_status)
  GROUP BY s.id, u.id
  ORDER BY s.tanggal_berangkat DESC, s.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Ambil personel dalam sprint
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_sprint_personel(
  p_sprint_id UUID
)
RETURNS TABLE (
  sprint_id UUID,
  user_id UUID,
  jabatan_dalam_sprint TEXT,
  laporan_kembali TEXT,
  kembali_at TIMESTAMPTZ,
  user_info JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_sprint_satuan TEXT;
BEGIN
  IF NOT public.is_feature_enabled('sprint') THEN
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

  SELECT s.satuan INTO v_sprint_satuan
  FROM public.sprint s WHERE s.id = p_sprint_id;

  IF v_sprint_satuan IS NULL THEN
    RAISE EXCEPTION 'Sprint tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_sprint_satuan THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sprint_personel sp
      WHERE sp.sprint_id = p_sprint_id AND sp.user_id = v_caller_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    sp.sprint_id,
    sp.user_id,
    sp.jabatan_dalam_sprint,
    sp.laporan_kembali,
    sp.kembali_at,
    json_build_object(
      'id', u.id, 'nama', u.nama, 'nrp', u.nrp,
      'pangkat', u.pangkat, 'jabatan', u.jabatan
    ) AS user_info
  FROM public.sprint_personel sp
  JOIN public.users u ON u.id = sp.user_id
  WHERE sp.sprint_id = p_sprint_id
  ORDER BY sp.jabatan_dalam_sprint;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Buat sprint baru
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_create_sprint(
  p_judul TEXT,
  p_tujuan TEXT,
  p_tempat_tujuan TEXT,
  p_tanggal_berangkat DATE,
  p_tanggal_kembali DATE,
  p_dasar TEXT DEFAULT NULL,
  p_personel_ids UUID[] DEFAULT NULL,
  p_jabatan_ids TEXT[] DEFAULT NULL
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
  v_nomor TEXT;
  v_sprint_id UUID;
  i INTEGER;
BEGIN
  IF NOT public.is_feature_enabled('sprint') THEN
    RAISE EXCEPTION 'sprint feature is disabled';
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

  IF v_role NOT IN ('admin', 'komandan', 'staf') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_judul IS NULL OR BTRIM(p_judul) = '' THEN
    RAISE EXCEPTION 'Judul wajib diisi';
  END IF;

  IF p_tujuan IS NULL OR BTRIM(p_tujuan) = '' THEN
    RAISE EXCEPTION 'Tujuan wajib diisi';
  END IF;

  IF p_tempat_tujuan IS NULL OR BTRIM(p_tempat_tujuan) = '' THEN
    RAISE EXCEPTION 'Tempat tujuan wajib diisi';
  END IF;

  IF p_tanggal_kembali < p_tanggal_berangkat THEN
    RAISE EXCEPTION 'Tanggal kembali tidak boleh sebelum tanggal berangkat';
  END IF;

  IF v_scope_satuan IS NULL THEN
    RAISE EXCEPTION 'Satuan pengguna tidak valid';
  END IF;

  v_nomor := public.generate_nomor_sprint(v_scope_satuan);

  INSERT INTO public.sprint (
    nomor_surat, satuan, judul, dasar, tujuan, tempat_tujuan,
    tanggal_berangkat, tanggal_kembali, status, dibuat_oleh
  )
  VALUES (
    v_nomor, v_scope_satuan, BTRIM(p_judul),
    NULLIF(BTRIM(p_dasar), ''),
    BTRIM(p_tujuan), BTRIM(p_tempat_tujuan),
    p_tanggal_berangkat, p_tanggal_kembali,
    CASE WHEN v_role = 'komandan' THEN 'approved' ELSE 'draft' END,
    v_caller_id
  )
  RETURNING id INTO v_sprint_id;

  -- Set disetujui jika komandan yang buat
  IF v_role = 'komandan' THEN
    UPDATE public.sprint
    SET disetujui_oleh = v_caller_id, disetujui_at = NOW()
    WHERE id = v_sprint_id;
  END IF;

  -- Tambah personel
  IF p_personel_ids IS NOT NULL THEN
    FOR i IN 1..array_length(p_personel_ids, 1) LOOP
      INSERT INTO public.sprint_personel (sprint_id, user_id, jabatan_dalam_sprint)
      VALUES (
        v_sprint_id,
        p_personel_ids[i],
        COALESCE(
          CASE WHEN p_jabatan_ids IS NOT NULL AND i <= array_length(p_jabatan_ids, 1)
            THEN NULLIF(BTRIM(p_jabatan_ids[i]), '')
            ELSE NULL
          END,
          'anggota'
        )
      )
      ON CONFLICT (sprint_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_sprint_id;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Update status sprint
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_update_sprint_status(
  p_sprint_id UUID,
  p_status TEXT
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
  v_sprint_satuan TEXT;
  v_current_status TEXT;
BEGIN
  IF NOT public.is_feature_enabled('sprint') THEN
    RAISE EXCEPTION 'sprint feature is disabled';
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

  SELECT s.satuan, s.status
    INTO v_sprint_satuan, v_current_status
  FROM public.sprint s WHERE s.id = p_sprint_id;

  IF v_sprint_satuan IS NULL THEN
    RAISE EXCEPTION 'Sprint tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_sprint_satuan THEN
    RAISE EXCEPTION 'Sprint di luar satuan Anda';
  END IF;

  IF p_status NOT IN ('draft', 'approved', 'active', 'selesai', 'dibatalkan') THEN
    RAISE EXCEPTION 'Status tidak valid';
  END IF;

  -- approved: hanya komandan/admin
  IF p_status = 'approved' THEN
    IF v_role NOT IN ('admin', 'komandan') THEN
      RAISE EXCEPTION 'Unauthorized: hanya komandan/admin yang dapat menyetujui';
    END IF;
    IF v_current_status <> 'draft' THEN
      RAISE EXCEPTION 'Hanya sprint berstatus draft yang dapat disetujui';
    END IF;
    UPDATE public.sprint
    SET status = 'approved', disetujui_oleh = v_caller_id, disetujui_at = NOW(), updated_at = NOW()
    WHERE id = p_sprint_id;
    RETURN;
  END IF;

  UPDATE public.sprint
  SET status = p_status, updated_at = NOW()
  WHERE id = p_sprint_id;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Laporan kembali dari personel
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_laporan_kembali_sprint(
  p_sprint_id UUID,
  p_laporan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := public.current_karyo_user_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sprint_personel
    WHERE sprint_id = p_sprint_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Anda tidak terdaftar dalam sprint ini';
  END IF;

  UPDATE public.sprint_personel
  SET laporan_kembali = BTRIM(p_laporan), kembali_at = NOW()
  WHERE sprint_id = p_sprint_id AND user_id = v_caller_id;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Hapus sprint (hanya draft)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_delete_sprint(
  p_sprint_id UUID
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
  v_sprint_satuan TEXT;
  v_current_status TEXT;
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

  SELECT s.satuan, s.status
    INTO v_sprint_satuan, v_current_status
  FROM public.sprint s WHERE s.id = p_sprint_id;

  IF v_sprint_satuan IS NULL THEN
    RAISE EXCEPTION 'Sprint tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_sprint_satuan THEN
    RAISE EXCEPTION 'Sprint di luar satuan Anda';
  END IF;

  IF v_current_status <> 'draft' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Hanya sprint berstatus draft yang dapat dihapus';
  END IF;

  DELETE FROM public.sprint WHERE id = p_sprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_nomor_sprint(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_sprint(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_sprint_personel(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_sprint(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_update_sprint_status(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_laporan_kembali_sprint(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_sprint(UUID) TO anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES ('sprint', true)
ON CONFLICT (feature_key) DO NOTHING;
