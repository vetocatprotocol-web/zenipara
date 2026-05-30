-- ============================================================
-- KARYO OS — Modul Laporan Operasional (Laphar)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.laporan_ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_laporan TEXT UNIQUE,
  satuan TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('harian', 'insidentil', 'latihan', 'inspeksi', 'lainnya')),
  tanggal_kejadian DATE NOT NULL,
  waktu_kejadian TIME,
  lokasi TEXT,
  judul TEXT NOT NULL,
  uraian TEXT NOT NULL,
  tindakan TEXT,
  rekomendasi TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'diajukan', 'diketahui', 'diarsipkan')),
  dibuat_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL,
  diketahui_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL,
  diketahui_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laporan_ops_personel (
  laporan_id UUID NOT NULL REFERENCES public.laporan_ops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  peran TEXT CHECK (peran IN ('ketua', 'anggota', 'saksi')),
  PRIMARY KEY (laporan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_laporan_ops_satuan_tanggal
  ON public.laporan_ops(satuan, tanggal_kejadian DESC);
CREATE INDEX IF NOT EXISTS idx_laporan_ops_status
  ON public.laporan_ops(status);
CREATE INDEX IF NOT EXISTS idx_laporan_ops_personel_laporan
  ON public.laporan_ops_personel(laporan_id);
CREATE INDEX IF NOT EXISTS idx_laporan_ops_personel_user
  ON public.laporan_ops_personel(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_laporan_ops_updated_at'
  ) THEN
    CREATE TRIGGER trg_laporan_ops_updated_at
      BEFORE UPDATE ON public.laporan_ops
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.laporan_ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_ops_personel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laporan_ops FROM anon, authenticated;
REVOKE ALL ON public.laporan_ops_personel FROM anon, authenticated;

-- ----------------------------------------------------------------
-- Helper: Nomor Laporan Otomatis
-- Format: LAP-S3/001/IV/2026
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_nomor_laporan_ops(
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
    NULLIF(REGEXP_REPLACE(nomor_laporan, '^LAP-S3/([0-9]+)/.*', '\1'), '')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM public.laporan_ops
  WHERE satuan = p_satuan
    AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM');

  RETURN 'LAP-S3/' ||
         LPAD(v_seq::TEXT, 3, '0') || '/' ||
         v_bulan || '/' || v_tahun;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Ambil daftar laporan operasional
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_get_laporan_ops(
  p_status TEXT DEFAULT NULL,
  p_jenis TEXT DEFAULT NULL,
  p_tanggal_dari DATE DEFAULT NULL,
  p_tanggal_sampai DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nomor_laporan TEXT,
  satuan TEXT,
  jenis TEXT,
  tanggal_kejadian DATE,
  waktu_kejadian TIME,
  lokasi TEXT,
  judul TEXT,
  uraian TEXT,
  tindakan TEXT,
  rekomendasi TEXT,
  status TEXT,
  dibuat_oleh UUID,
  diketahui_oleh UUID,
  diketahui_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  pembuat JSON
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
  IF NOT public.is_feature_enabled('laporan_ops') THEN
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

  IF v_role NOT IN ('admin', 'komandan', 'staf') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.nomor_laporan,
    l.satuan,
    l.jenis,
    l.tanggal_kejadian,
    l.waktu_kejadian,
    l.lokasi,
    l.judul,
    l.uraian,
    l.tindakan,
    l.rekomendasi,
    l.status,
    l.dibuat_oleh,
    l.diketahui_oleh,
    l.diketahui_at,
    l.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
      ELSE NULL
    END AS pembuat
  FROM public.laporan_ops l
  LEFT JOIN public.users u ON u.id = l.dibuat_oleh
  WHERE
    (v_role = 'admin' OR l.satuan = v_scope_satuan)
    AND (p_status IS NULL OR l.status = p_status)
    AND (p_jenis IS NULL OR l.jenis = p_jenis)
    AND (p_tanggal_dari IS NULL OR l.tanggal_kejadian >= p_tanggal_dari)
    AND (p_tanggal_sampai IS NULL OR l.tanggal_kejadian <= p_tanggal_sampai)
  ORDER BY l.tanggal_kejadian DESC, l.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Buat laporan operasional
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_create_laporan_ops(
  p_judul TEXT,
  p_jenis TEXT,
  p_tanggal_kejadian DATE,
  p_uraian TEXT,
  p_waktu_kejadian TIME DEFAULT NULL,
  p_lokasi TEXT DEFAULT NULL,
  p_tindakan TEXT DEFAULT NULL,
  p_rekomendasi TEXT DEFAULT NULL
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
  v_result UUID;
BEGIN
  IF NOT public.is_feature_enabled('laporan_ops') THEN
    RAISE EXCEPTION 'laporan_ops feature is disabled';
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
    RAISE EXCEPTION 'Unauthorized: hanya admin/komandan/staf yang dapat membuat laporan';
  END IF;

  IF p_judul IS NULL OR BTRIM(p_judul) = '' THEN
    RAISE EXCEPTION 'Judul laporan wajib diisi';
  END IF;

  IF p_uraian IS NULL OR BTRIM(p_uraian) = '' THEN
    RAISE EXCEPTION 'Uraian laporan wajib diisi';
  END IF;

  IF p_jenis NOT IN ('harian', 'insidentil', 'latihan', 'inspeksi', 'lainnya') THEN
    RAISE EXCEPTION 'Jenis laporan tidak valid';
  END IF;

  IF p_tanggal_kejadian IS NULL THEN
    RAISE EXCEPTION 'Tanggal kejadian wajib diisi';
  END IF;

  IF v_scope_satuan IS NULL THEN
    RAISE EXCEPTION 'Satuan pengguna tidak valid';
  END IF;

  v_nomor := public.generate_nomor_laporan_ops(v_scope_satuan);

  INSERT INTO public.laporan_ops (
    nomor_laporan,
    satuan,
    jenis,
    tanggal_kejadian,
    waktu_kejadian,
    lokasi,
    judul,
    uraian,
    tindakan,
    rekomendasi,
    status,
    dibuat_oleh
  )
  VALUES (
    v_nomor,
    v_scope_satuan,
    p_jenis,
    p_tanggal_kejadian,
    p_waktu_kejadian,
    NULLIF(BTRIM(p_lokasi), ''),
    BTRIM(p_judul),
    BTRIM(p_uraian),
    NULLIF(BTRIM(p_tindakan), ''),
    NULLIF(BTRIM(p_rekomendasi), ''),
    'draft',
    v_caller_id
  )
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Update status laporan operasional
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_update_laporan_ops_status(
  p_laporan_id UUID,
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
  v_laporan_satuan TEXT;
  v_laporan_dibuat UUID;
  v_current_status TEXT;
BEGIN
  IF NOT public.is_feature_enabled('laporan_ops') THEN
    RAISE EXCEPTION 'laporan_ops feature is disabled';
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

  IF p_status NOT IN ('draft', 'diajukan', 'diketahui', 'diarsipkan') THEN
    RAISE EXCEPTION 'Status tidak valid';
  END IF;

  SELECT l.satuan, l.dibuat_oleh, l.status
    INTO v_laporan_satuan, v_laporan_dibuat, v_current_status
  FROM public.laporan_ops l
  WHERE l.id = p_laporan_id;

  IF v_laporan_satuan IS NULL THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_laporan_satuan THEN
    RAISE EXCEPTION 'Laporan di luar satuan Anda';
  END IF;

  -- Hanya pembuat atau admin/komandan yang dapat mengubah status ke diajukan
  IF p_status = 'diajukan' THEN
    IF v_role NOT IN ('admin', 'komandan', 'staf') THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF v_current_status <> 'draft' THEN
      RAISE EXCEPTION 'Hanya laporan berstatus draft yang dapat diajukan';
    END IF;
  END IF;

  -- Hanya komandan/admin yang bisa menandai "diketahui"
  IF p_status = 'diketahui' THEN
    IF v_role NOT IN ('admin', 'komandan') THEN
      RAISE EXCEPTION 'Unauthorized: hanya komandan/admin yang dapat menandai laporan diketahui';
    END IF;
    IF v_current_status <> 'diajukan' THEN
      RAISE EXCEPTION 'Hanya laporan berstatus diajukan yang dapat diketahui';
    END IF;

    UPDATE public.laporan_ops
    SET status = 'diketahui',
        diketahui_oleh = v_caller_id,
        diketahui_at = NOW(),
        updated_at = NOW()
    WHERE id = p_laporan_id;

    RETURN;
  END IF;

  -- Arsipkan: komandan/admin
  IF p_status = 'diarsipkan' THEN
    IF v_role NOT IN ('admin', 'komandan') THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF v_current_status <> 'diketahui' THEN
      RAISE EXCEPTION 'Hanya laporan berstatus diketahui yang dapat diarsipkan';
    END IF;
  END IF;

  UPDATE public.laporan_ops
  SET status = p_status,
      updated_at = NOW()
  WHERE id = p_laporan_id;
END;
$$;

-- ----------------------------------------------------------------
-- RPC: Hapus laporan (hanya draft, oleh pembuat/admin)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_delete_laporan_ops(
  p_laporan_id UUID
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
  v_laporan_satuan TEXT;
  v_dibuat_oleh UUID;
  v_current_status TEXT;
BEGIN
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

  SELECT l.satuan, l.dibuat_oleh, l.status
    INTO v_laporan_satuan, v_dibuat_oleh, v_current_status
  FROM public.laporan_ops l
  WHERE l.id = p_laporan_id;

  IF v_laporan_satuan IS NULL THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_laporan_satuan THEN
    RAISE EXCEPTION 'Laporan di luar satuan Anda';
  END IF;

  IF v_current_status <> 'draft' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Hanya laporan berstatus draft yang dapat dihapus';
  END IF;

  IF v_role NOT IN ('admin', 'komandan') AND v_dibuat_oleh IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Hanya pembuat atau admin/komandan yang dapat menghapus laporan';
  END IF;

  DELETE FROM public.laporan_ops WHERE id = p_laporan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_nomor_laporan_ops(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_laporan_ops(TEXT, TEXT, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_laporan_ops(TEXT, TEXT, DATE, TEXT, TIME, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_update_laporan_ops_status(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_delete_laporan_ops(UUID) TO anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES ('laporan_ops', true)
ON CONFLICT (feature_key) DO NOTHING;
