-- ============================================================
-- Migration: Add command_level enum and level_komando column
-- Implements tiered commander hierarchy from SPESIFIKASI.md §3.3 & §4.2
-- ============================================================

-- 1. Create enum (idempotent)
DO $$ BEGIN
  CREATE TYPE command_level AS ENUM ('BATALION', 'KOMPI', 'PELETON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add column (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS level_komando command_level;

-- Normalize existing rows before adding strict constraint.
UPDATE users
SET level_komando = CASE
  WHEN role <> 'komandan' THEN NULL
  WHEN level_komando IS NOT NULL THEN level_komando
  WHEN jabatan ILIKE '%batalyon%' THEN 'BATALION'::command_level
  WHEN jabatan ILIKE '%kompi%' THEN 'KOMPI'::command_level
  WHEN jabatan ILIKE '%peleton%' THEN 'PELETON'::command_level
  ELSE 'KOMPI'::command_level
END;

-- 3. Add CHECK constraint so level_komando is required for komandan only
--    Drop first if it already exists from a previous attempt.
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT chk_komandan_level
      CHECK (
        (role = 'komandan' AND level_komando IS NOT NULL)
        OR (role <> 'komandan' AND level_komando IS NULL)
      );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_users_level_komando ON users(level_komando);

-- 5. Update API functions that return user data to include level_komando
--    The column is now part of the users table and will be returned by SELECT *.
--    Explicit RPC functions that enumerate columns need to be updated if they
--    do not already use SELECT *.  Force schema reload so PostgREST picks up
--    the new column immediately.
NOTIFY pgrst, 'reload schema';
