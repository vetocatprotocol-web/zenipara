import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/features/shared/lib/supabase';
import { fetchAuditLogs } from '@/features/shared/lib/api/auditLogs';
import type { AuditLog } from '../../../types';

const mockSupabase = supabase as unknown as { rpc: ReturnType<typeof vi.fn> };

const CALLER_ID = 'caller-1';
const CALLER_ROLE = 'admin';

const sampleLogs: AuditLog[] = [
  { id: 'l1', action: 'LOGIN', created_at: '2024-01-01T08:00:00Z' },
  { id: 'l2', user_id: 'u1', action: 'GATE_PASS_CREATE', created_at: '2024-01-01T09:00:00Z' },
] as AuditLog[];

describe('auditLogs API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns list of audit logs', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleLogs, error: null });
    const result = await fetchAuditLogs({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_audit_logs', expect.objectContaining({ p_user_id: CALLER_ID, p_role: CALLER_ROLE }));
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('LOGIN');
  });

  it('returns empty array when data is null', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const result = await fetchAuditLogs({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
    expect(result).toEqual([]);
  });

  it('throws on supabase error', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('query failed') });
    await expect(fetchAuditLogs({ callerId: CALLER_ID, callerRole: CALLER_ROLE })).rejects.toThrow('query failed');
  });

  it('uses default limit of 100', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: sampleLogs, error: null });
    await fetchAuditLogs({ callerId: CALLER_ID, callerRole: CALLER_ROLE });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_audit_logs', expect.objectContaining({ p_limit: 100 }));
  });

  it('uses custom limit when provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await fetchAuditLogs({ callerId: CALLER_ID, callerRole: CALLER_ROLE, limit: 10 });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('api_get_audit_logs', expect.objectContaining({ p_limit: 10 }));
  });
});
