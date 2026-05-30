-- ============================================================
-- KARYO OS — Modul Apel Digital (Fondasi)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satuan TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('pagi', 'siang', 'malam', 'upacara')),
  tanggal DATE NOT NULL,
  waktu_buka TIMESTAMPTZ NOT NULL,
  waktu_tutup TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (waktu_tutup > waktu_buka)
);

CREATE TABLE IF NOT EXISTS public.apel_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.apel_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'terlambat', 'absen', 'dinas_luar', 'izin')),
  check_in_at TIMESTAMPTZ,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_apel_sessions_satuan_tanggal
  ON public.apel_sessions(satuan, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_apel_attendance_session
  ON public.apel_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_apel_attendance_user
  ON public.apel_attendance(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_apel_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_apel_sessions_updated_at
      BEFORE UPDATE ON public.apel_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_apel_attendance_updated_at'
  ) THEN
    CREATE TRIGGER trg_apel_attendance_updated_at
      BEFORE UPDATE ON public.apel_attendance
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.apel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apel_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apel_sessions FROM anon, authenticated;
REVOKE ALL ON public.apel_attendance FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.api_get_apel_sessions(
  p_tanggal DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  satuan TEXT,
  jenis TEXT,
  tanggal DATE,
  waktu_buka TIMESTAMPTZ,
  waktu_tutup TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ,
  hadir_count INTEGER,
  terlambat_count INTEGER,
  total_tercatat INTEGER
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
  IF NOT public.is_feature_enabled('apel_digital') THEN
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

  IF v_role NOT IN ('admin', 'komandan', 'staf', 'prajurit') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.satuan,
    s.jenis,
    s.tanggal,
    s.waktu_buka,
    s.waktu_tutup,
    s.created_by,
    s.created_at,
    COUNT(*) FILTER (WHERE a.status = 'hadir')::INTEGER AS hadir_count,
    COUNT(*) FILTER (WHERE a.status = 'terlambat')::INTEGER AS terlambat_count,
    COUNT(a.id)::INTEGER AS total_tercatat
  FROM public.apel_sessions s
  LEFT JOIN public.apel_attendance a ON a.session_id = s.id
  WHERE s.tanggal = COALESCE(p_tanggal, CURRENT_DATE)
    AND (
      v_role = 'admin'
      OR (v_scope_satuan IS NOT NULL AND s.satuan = v_scope_satuan)
    )
  GROUP BY s.id
  ORDER BY s.waktu_buka ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_create_apel_session(
  p_jenis TEXT,
  p_tanggal DATE,
  p_waktu_buka TIMESTAMPTZ,
  p_waktu_tutup TIMESTAMPTZ,
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
  IF NOT public.is_feature_enabled('apel_digital') THEN
    RAISE EXCEPTION 'apel_digital feature is disabled';
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

  IF p_jenis NOT IN ('pagi', 'siang', 'malam', 'upacara') THEN
    RAISE EXCEPTION 'Jenis apel tidak valid';
  END IF;

  IF p_tanggal IS NULL OR p_waktu_buka IS NULL OR p_waktu_tutup IS NULL THEN
    RAISE EXCEPTION 'Data sesi apel tidak lengkap';
  END IF;

  IF p_waktu_tutup <= p_waktu_buka THEN
    RAISE EXCEPTION 'waktu_tutup harus setelah waktu_buka';
  END IF;

  IF v_role = 'admin' AND COALESCE(NULLIF(BTRIM(p_satuan), ''), v_scope_satuan) IS NULL THEN
    RAISE EXCEPTION 'Satuan wajib diisi';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS NULL THEN
    RAISE EXCEPTION 'Satuan pengguna tidak valid';
  END IF;

  INSERT INTO public.apel_sessions (
    satuan,
    jenis,
    tanggal,
    waktu_buka,
    waktu_tutup,
    created_by
  )
  VALUES (
    CASE WHEN v_role = 'admin'
      THEN COALESCE(NULLIF(BTRIM(p_satuan), ''), v_scope_satuan)
      ELSE v_scope_satuan
    END,
    p_jenis,
    p_tanggal,
    p_waktu_buka,
    p_waktu_tutup,
    v_caller_id
  )
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_lapor_hadir_apel(
  p_session_id UUID,
  p_keterangan TEXT DEFAULT NULL
)
RETURNS public.apel_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_session public.apel_sessions%ROWTYPE;
  v_status TEXT;
  v_row public.apel_attendance%ROWTYPE;
BEGIN
  IF NOT public.is_feature_enabled('apel_digital') THEN
    RAISE EXCEPTION 'apel_digital feature is disabled';
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

  IF v_role NOT IN ('admin', 'komandan', 'staf', 'prajurit') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT *
    INTO v_session
  FROM public.apel_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi apel tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_session.satuan THEN
    RAISE EXCEPTION 'Sesi apel di luar satuan Anda';
  END IF;

  IF NOW() < v_session.waktu_buka THEN
    RAISE EXCEPTION 'Sesi apel belum dibuka';
  END IF;

  IF NOW() > v_session.waktu_tutup THEN
    RAISE EXCEPTION 'Sesi apel sudah ditutup';
  END IF;

  v_status := CASE
    WHEN NOW() > (v_session.waktu_buka + INTERVAL '10 minutes') THEN 'terlambat'
    ELSE 'hadir'
  END;

  INSERT INTO public.apel_attendance (
    session_id,
    user_id,
    status,
    check_in_at,
    keterangan
  )
  VALUES (
    p_session_id,
    v_caller_id,
    v_status,
    NOW(),
    NULLIF(BTRIM(p_keterangan), '')
  )
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    check_in_at = EXCLUDED.check_in_at,
    keterangan = EXCLUDED.keterangan,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_get_apel_session_attendance(
  p_session_id UUID
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  user_id UUID,
  status TEXT,
  check_in_at TIMESTAMPTZ,
  keterangan TEXT,
  created_at TIMESTAMPTZ,
  "user" JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_scope_satuan TEXT;
  v_session_satuan TEXT;
BEGIN
  IF NOT public.is_feature_enabled('apel_digital') THEN
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

  IF v_role NOT IN ('admin', 'komandan', 'staf', 'prajurit') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT s.satuan
    INTO v_session_satuan
  FROM public.apel_sessions s
  WHERE s.id = p_session_id;

  IF v_session_satuan IS NULL THEN
    RAISE EXCEPTION 'Sesi apel tidak ditemukan';
  END IF;

  IF v_role <> 'admin' AND v_scope_satuan IS DISTINCT FROM v_session_satuan THEN
    RAISE EXCEPTION 'Sesi apel di luar satuan Anda';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.session_id,
    a.user_id,
    a.status,
    a.check_in_at,
    a.keterangan,
    a.created_at,
    CASE WHEN u.id IS NOT NULL
      THEN json_build_object('id', u.id, 'nama', u.nama, 'nrp', u.nrp, 'pangkat', u.pangkat)
      ELSE NULL
    END AS "user"
  FROM public.apel_attendance a
  LEFT JOIN public.users u ON u.id = a.user_id
  WHERE a.session_id = p_session_id
    AND (v_role <> 'prajurit' OR a.user_id = v_caller_id)
  ORDER BY a.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_apel_sessions(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_apel_session(TEXT, DATE, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_lapor_hadir_apel(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_apel_session_attendance(UUID) TO anon, authenticated;

INSERT INTO public.system_feature_flags (feature_key, is_enabled)
VALUES ('apel_digital', true)
ON CONFLICT (feature_key) DO NOTHING;
