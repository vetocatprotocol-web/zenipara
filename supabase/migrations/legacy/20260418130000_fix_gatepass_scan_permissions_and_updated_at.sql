-- ============================================================
-- Fix gate pass scan runtime issues:
-- 1) Ensure gate_pass has updated_at used by scan RPCs.
-- 2) Ensure browser role (anon/authenticated) can execute scan RPCs.
-- ============================================================

ALTER TABLE public.gate_pass
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_gate_pass_updated_at ON public.gate_pass;
CREATE TRIGGER trg_gate_pass_updated_at
  BEFORE UPDATE ON public.gate_pass
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT EXECUTE ON FUNCTION public.server_scan_gate_pass(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.server_scan_gate_pass(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_pos_jaga(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.scan_pos_jaga(TEXT, UUID) TO authenticated;
