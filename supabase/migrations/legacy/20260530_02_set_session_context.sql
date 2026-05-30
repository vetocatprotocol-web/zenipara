-- Migration: set_session_context with p_satuan_id
-- Sets PostgreSQL session settings used by RLS policies (karyo.user_id, karyo.user_role, karyo.satuan_id)

CREATE OR REPLACE FUNCTION public.set_session_context(
  p_user_id UUID,
  p_role TEXT,
  p_satuan_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Persist canonical session keys used by existing helpers/policies
  PERFORM set_config('karyo.current_user_id', COALESCE(p_user_id::text, ''), TRUE);
  PERFORM set_config('karyo.current_user_role', COALESCE(p_role, ''), TRUE);
  PERFORM set_config('karyo.current_satuan_id', COALESCE(p_satuan_id::text, ''), TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_session_context(UUID, TEXT, UUID) TO anon;
