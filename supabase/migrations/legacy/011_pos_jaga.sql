-- ============================================================
-- KARYO OS — Migration 011: Pos Jaga (Static QR Guard Post)
-- Prajurit memindai QR statis di pos jaga untuk mencatat
-- waktu keluar/kembali tanpa perlu guard memindai QR prajurit.
-- ============================================================

-- Tabel pos jaga (guard post)
CREATE TABLE IF NOT EXISTS public.pos_jaga (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(100) NOT NULL,
  qr_token   text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_jaga_qr_token ON public.pos_jaga(qr_token);

-- RLS
ALTER TABLE public.pos_jaga ENABLE ROW LEVEL SECURITY;

-- Semua user terautentikasi dapat melihat pos jaga aktif
DROP POLICY IF EXISTS pos_jaga_select ON public.pos_jaga;
CREATE POLICY pos_jaga_select ON public.pos_jaga
  FOR SELECT USING (public.current_karyo_user_id() IS NOT NULL);

-- Hanya admin dan guard yang dapat mengelola pos jaga
DROP POLICY IF EXISTS pos_jaga_insert ON public.pos_jaga;
CREATE POLICY pos_jaga_insert ON public.pos_jaga
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = public.current_karyo_user_id() AND role IN ('admin', 'guard')
    )
  );

DROP POLICY IF EXISTS pos_jaga_update ON public.pos_jaga;
CREATE POLICY pos_jaga_update ON public.pos_jaga
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = public.current_karyo_user_id() AND role IN ('admin', 'guard')
    )
  );

-- ============================================================
-- RPC: scan_pos_jaga
-- Dipanggil oleh prajurit yang memindai QR statis di pos jaga.
-- Mencari gate pass aktif milik prajurit tersebut lalu memproses
-- keluar (approved → out) atau kembali (out → returned).
-- ============================================================

CREATE OR REPLACE FUNCTION public.scan_pos_jaga(
  p_pos_token text,
  p_user_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pos       public.pos_jaga%ROWTYPE;
  v_gate_pass public.gate_pass%ROWTYPE;
  v_message   text;
  v_new_status text;
BEGIN
  -- Verifikasi pos jaga
  SELECT * INTO v_pos
  FROM public.pos_jaga
  WHERE qr_token = p_pos_token AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR pos jaga tidak valid atau tidak aktif';
  END IF;

  -- Cari gate pass aktif milik prajurit (status approved atau out)
  SELECT * INTO v_gate_pass
  FROM public.gate_pass
  WHERE user_id = p_user_id
    AND status IN ('approved', 'out')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak ada gate pass aktif. Pastikan gate pass sudah disetujui.';
  END IF;

  -- Proses sesuai status gate pass
  IF v_gate_pass.status = 'approved' THEN
    UPDATE public.gate_pass
    SET status       = 'out',
        actual_keluar = NOW(),
        updated_at    = NOW()
    WHERE id = v_gate_pass.id;

    v_message    := 'Keluar berhasil dicatat';
    v_new_status := 'out';

  ELSIF v_gate_pass.status = 'out' THEN
    UPDATE public.gate_pass
    SET status         = 'returned',
        actual_kembali = NOW(),
        updated_at     = NOW()
    WHERE id = v_gate_pass.id;

    v_message    := 'Kembali berhasil dicatat';
    v_new_status := 'returned';
  END IF;

  RETURN jsonb_build_object(
    'gate_pass_id', v_gate_pass.id,
    'pos_nama',     v_pos.nama,
    'status',       v_new_status,
    'message',      v_message
  );
END;
$$;
