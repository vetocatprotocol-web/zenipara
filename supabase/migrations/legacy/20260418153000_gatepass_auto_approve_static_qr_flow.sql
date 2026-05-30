-- ============================================================
-- Gate Pass workflow update:
-- 1) Submit is auto-approved
-- 2) Static Pos Jaga QR scan is mandatory for keluar and kembali
-- 3) Status transition: approved -> checked_in -> completed
--
-- Backward compatibility:
-- - Keep legacy statuses out/returned readable
-- - Data normalization out->checked_in and returned->completed dilakukan
--   pada migration lanjutan setelah commit enum values.
-- ============================================================

-- Add new enum values if not yet available.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'gate_pass_status' AND e.enumlabel = 'checked_in'
  ) THEN
    ALTER TYPE public.gate_pass_status ADD VALUE 'checked_in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'gate_pass_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE public.gate_pass_status ADD VALUE 'completed';
  END IF;
END $$;

-- NOTE:
-- Penggunaan nilai enum baru pada policy/function dipindahkan ke migration
-- lanjutan agar terhindar dari error Postgres "unsafe use of new value".
