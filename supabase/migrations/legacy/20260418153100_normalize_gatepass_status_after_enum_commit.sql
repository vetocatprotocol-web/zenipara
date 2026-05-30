-- ============================================================
-- Gate Pass status normalization after enum migration commit
--
-- This migration is intentionally separated from enum value creation
-- to avoid PostgreSQL error:
--   unsafe use of new value "checked_in" of enum type gate_pass_status
-- ============================================================

UPDATE public.gate_pass
SET status = 'checked_in'
WHERE status = 'out';

UPDATE public.gate_pass
SET status = 'completed'
WHERE status = 'returned';
