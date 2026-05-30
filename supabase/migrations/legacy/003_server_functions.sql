-- ============================================================
-- KARYO OS — Migration 003: Server-side functions
-- Adds server-timestamp check-in/check-out and logistics
-- request workflow.
-- ============================================================

-- ============================================================
-- TABEL: logistics_requests
-- Permintaan logistik dari Komandan ke Admin
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logistics_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  satuan          TEXT NOT NULL,
  nama_item       TEXT NOT NULL,
  jumlah          INTEGER NOT NULL DEFAULT 1 CHECK (jumlah > 0),
  satuan_item     TEXT,
  alasan          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_requested_by
  ON public.logistics_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_logistics_requests_satuan
  ON public.logistics_requests(satuan);
CREATE INDEX IF NOT EXISTS idx_logistics_requests_status
  ON public.logistics_requests(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_logistics_requests_updated_at ON public.logistics_requests;
CREATE TRIGGER update_logistics_requests_updated_at
  BEFORE UPDATE ON public.logistics_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS (dev: open)
ALTER TABLE public.logistics_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dev_anon_all_logistics_requests" ON public.logistics_requests;
CREATE POLICY "dev_anon_all_logistics_requests"
  ON public.logistics_requests FOR ALL TO anon
  USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- FUNGSI: server_checkin
-- Melakukan check-in dengan waktu server (NOW()) sehingga
-- tidak bisa dimanipulasi dari sisi klien.
-- ============================================================
CREATE OR REPLACE FUNCTION public.server_checkin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today      DATE := CURRENT_DATE;
  v_existing   public.attendance%ROWTYPE;
  v_result     public.attendance%ROWTYPE;
BEGIN
  -- Cek apakah sudah ada record hari ini
  SELECT * INTO v_existing
  FROM public.attendance
  WHERE user_id = p_user_id AND tanggal = v_today;

  IF FOUND THEN
    IF v_existing.check_in IS NOT NULL THEN
      RAISE EXCEPTION 'Sudah check-in hari ini';
    END IF;
    -- Update existing row (e.g. status=alpa then check-in)
    UPDATE public.attendance
    SET check_in = NOW(), status = 'hadir'
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  ELSE
    -- Insert baru
    INSERT INTO public.attendance (user_id, tanggal, check_in, status)
    VALUES (p_user_id, v_today, NOW(), 'hadir')
    RETURNING * INTO v_result;
  END IF;

  RETURN jsonb_build_object(
    'id',       v_result.id,
    'tanggal',  v_result.tanggal,
    'check_in', v_result.check_in,
    'status',   v_result.status
  );
END;
$$;

-- ============================================================
-- FUNGSI: server_checkout
-- Melakukan check-out dengan waktu server (NOW()).
-- ============================================================
CREATE OR REPLACE FUNCTION public.server_checkout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today    DATE := CURRENT_DATE;
  v_existing public.attendance%ROWTYPE;
  v_result   public.attendance%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM public.attendance
  WHERE user_id = p_user_id AND tanggal = v_today;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Belum check-in hari ini';
  END IF;

  IF v_existing.check_in IS NULL THEN
    RAISE EXCEPTION 'Belum check-in hari ini';
  END IF;

  IF v_existing.check_out IS NOT NULL THEN
    RAISE EXCEPTION 'Sudah check-out hari ini';
  END IF;

  UPDATE public.attendance
  SET check_out = NOW()
  WHERE id = v_existing.id
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id',        v_result.id,
    'tanggal',   v_result.tanggal,
    'check_in',  v_result.check_in,
    'check_out', v_result.check_out,
    'status',    v_result.status
  );
END;
$$;

-- ============================================================
-- FUNGSI: bulk_reset_pins
-- Reset PIN untuk banyak user sekaligus (admin use).
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_reset_pins(
  p_user_ids  UUID[],
  p_new_pin   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF length(p_new_pin) <> 6 OR p_new_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN harus 6 digit angka';
  END IF;

  UPDATE public.users
  SET pin_hash  = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
      updated_at = NOW()
  WHERE id = ANY(p_user_ids)
    AND is_active = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- FUNGSI: import_users_csv
-- Menerima array of user records dan membuat akun sekaligus.
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_users_csv(
  p_users JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item       JSONB;
  v_success    INTEGER := 0;
  v_failed     INTEGER := 0;
  v_errors     JSONB   := '[]'::JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_users)
  LOOP
    BEGIN
      PERFORM public.create_user_with_pin(
        (v_item->>'nrp')::TEXT,
        (v_item->>'pin')::TEXT,
        (v_item->>'nama')::TEXT,
        (v_item->>'role')::TEXT,
        (v_item->>'satuan')::TEXT,
        NULLIF(v_item->>'pangkat', ''),
        NULLIF(v_item->>'jabatan', '')
      );
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'nrp',   v_item->>'nrp',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success,
    'failed',  v_failed,
    'errors',  v_errors
  );
END;
$$;
