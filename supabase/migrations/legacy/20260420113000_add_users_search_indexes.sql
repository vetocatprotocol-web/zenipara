-- ============================================================
-- KARYO OS - User search and sort indexes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_nama_trgm
  ON public.users
  USING GIN (nama gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_nrp_trgm
  ON public.users
  USING GIN (nrp gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
  ON public.users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_satuan_is_active_created_at
  ON public.users (satuan, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_satuan_is_active_created_at
  ON public.users (role, satuan, is_active, created_at DESC);
