-- ============================================================
-- KARYO OS — Migration 017: Grant browser-facing RPC permissions
-- Fixes features that were failing silently because the frontend
-- calls these SECURITY DEFINER functions through the anon key.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.create_user_with_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_user_pin(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.import_users_csv(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.bulk_reset_pins(UUID[], TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_detail(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.change_user_pin(UUID, TEXT, TEXT) TO anon;