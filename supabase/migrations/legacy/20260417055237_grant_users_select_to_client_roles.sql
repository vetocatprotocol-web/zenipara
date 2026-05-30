-- ============================================================
-- KARYO OS — Migration 023: Grant users SELECT to client roles
--
-- Reason:
-- Some frontend modules still read from public.users directly
-- (dashboard counts, search, profile lookups). Without table-level SELECT,
-- PostgREST returns 401 before RLS policies are evaluated.
--
-- Security:
-- RLS remains enabled and still controls which rows are visible.
-- ============================================================

GRANT SELECT ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO authenticated;
