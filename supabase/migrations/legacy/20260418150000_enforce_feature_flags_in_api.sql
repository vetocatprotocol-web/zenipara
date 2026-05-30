-- ============================================================
-- KARYO OS — Migration: Feature Flag Enforcement Helper
--
-- PROBLEM: API functions ignore system_feature_flags, allowing
-- data access to disabled features via direct RPC calls, bypassing
-- UI-level feature gate protections.
--
-- APPROACH: This migration adds a helper function that all API functions
-- can use to check if a feature is enabled. Individual API functions
-- should call is_feature_enabled('feature_key') at the start and:
-- - For GET operations: RETURN (empty results) if disabled
-- - For INSERT/UPDATE/DELETE: RAISE EXCEPTION if disabled
--
-- FEATURE-TO-API MAPPING:
-- - user_management: api_get_users, api_update_user, api_delete_user
-- - announcements: api_get_announcements, api_insert_announcement, api_update_announcement, api_delete_announcement
-- - tasks: api_get_tasks, api_insert_task, api_update_task_status, api_insert_task_report, api_get_latest_task_report
-- - attendance: api_get_attendance
-- - gate_pass: api_get_gate_passes, api_insert_gate_pass, api_update_gate_pass_status
-- - leave_requests: api_get_leave_requests, api_insert_leave_request, api_update_leave_request_status
-- - audit_log: api_get_audit_logs
-- - documents: api_get_documents, api_insert_document, api_delete_document
-- - logistics: api_get_logistics_requests, api_insert_logistics_request, api_update_logistics_status
-- - messages: api_get_inbox, api_get_sent, api_insert_message, api_mark_message_read, api_mark_all_messages_read
-- - pos_jaga: (no dedicated API function, feature controls pos_jaga_list RLS)
-- - shift_schedule: (no dedicated API function, feature controls shift_schedule_list RLS)
-- - reports: (part of task management feature)
--
-- NOTE: Each function must be individually updated by CREATE OR REPLACE to add
-- the feature flag check. This migration only provides the helper function
-- and documents the strategy. Follow-up targeted updates will add checks to each function.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: is_feature_enabled
-- Returns TRUE if a feature is globally enabled in system_feature_flags.
-- Used by all API functions to enforce feature-level access control.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM public.system_feature_flags
  WHERE feature_key = p_feature_key;
  
  IF v_enabled IS NULL THEN
    -- Feature not configured in system_feature_flags; assume enabled for backward compatibility
    RETURN TRUE;
  END IF;
  
  RETURN v_enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO anon, authenticated;

-- ============================================================
-- NOTE: API functions must be updated individually to call is_feature_enabled()
-- Example pattern for GET functions (return empty):
--   IF NOT is_feature_enabled('feature_key') THEN RETURN; END IF;
-- Example pattern for INSERT/UPDATE/DELETE functions (raise error):
--   IF NOT is_feature_enabled('feature_key') THEN RAISE EXCEPTION 'feature_key feature is disabled'; END IF;
-- ============================================================
