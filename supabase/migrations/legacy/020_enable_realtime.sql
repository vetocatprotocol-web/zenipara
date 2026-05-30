-- ============================================================
-- KARYO OS — Migration 020: Enable Supabase Realtime
-- Adds the tables that need live updates to the
-- supabase_realtime publication.  Safe to re-run: each block
-- only adds the table when it is not already in the publication.
-- ============================================================

DO $$
DECLARE
  tables TEXT[] := ARRAY['messages', 'announcements', 'tasks', 'attendance'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
