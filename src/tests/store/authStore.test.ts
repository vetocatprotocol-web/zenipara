import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useAuthStore, saveSession } from '@/features/auth/authStore';
import { supabase } from '@/features/shared/lib/supabase';
import type { Role } from '@/types';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

// Helper: build a chainable Supabase query mock that resolves to `result`
function buildQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = chain;
  q.eq = chain;
  q.update = chain;
  q.insert = chain;
  q.single = () => Promise.resolve(result);
  // Make the builder itself thenable so `await supabase.from(...).select(...)...` works
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  q.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  return q;
}

/**
 * Build a chainable RPC mock that supports `.single()`.
 * Use this instead of `mockResolvedValue` so that `.single()` can be chained on `supabase.rpc(...)`.
 */
function buildRpcQuery(result: { data: unknown; error: unknown }) {
  return {
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject),
  };
}

const SESSION_KEY = 'karyo_session';

// Session helpers that use the real AES-GCM encryption so tests match production behaviour.
async function makeValidEncryptedSession(userId = 'u1', role: Role = 'admin_satuan') {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8);
  await saveSession({ user_id: userId, role, expires_at: expiresAt.toISOString() });
}

async function makeExpiredEncryptedSession() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() - 1);
  await saveSession({ user_id: 'u1', role: 'admin_satuan', expires_at: expiresAt.toISOString() });
}

const mockUser = {
  id: 'u1',
  nrp: '12345',
  nama: 'Test User',
  role: 'admin_satuan' as const,
  satuan: 'Satuan A',
  is_active: true,
  is_online: false,
  login_attempts: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
    vi.clearAllMocks();
  });

  // ── restoreSession ─────────────────────────────────────────
  describe('restoreSession', () => {
    it('sets isLoading false when no session in localStorage', async () => {
      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('clears session and does not authenticate if session is expired', async () => {
      await makeExpiredEncryptedSession();
      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('clears session if user fetch fails', async () => {
      await makeValidEncryptedSession();
      mockSupabase.from.mockReturnValue(buildQuery({ data: null, error: new Error('db error') }));

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('restores user and sets isAuthenticated when session is valid', async () => {
      await makeValidEncryptedSession('u1', 'admin_satuan');
      // Current implementation fetches the user via RPC, not supabase.from
      mockSupabase.rpc.mockReturnValue(buildRpcQuery({ data: mockUser, error: null }));

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe('u1');
      // Verify get_user_by_id was called with the session user_id
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_by_id', {
        p_user_id: 'u1',
      });
    });

    it('restores a valid session from the persisted context when the crypto key is missing', async () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 8);
      localStorage.setItem('karyo_session_context', JSON.stringify({
        user_id: 'u1',
        role: 'admin_satuan',
        expires_at: expiresAt.toISOString(),
      }));
      localStorage.setItem(SESSION_KEY, JSON.stringify({ iv: 'abc', data: 'def' }));
      mockSupabase.rpc.mockReturnValue(buildRpcQuery({ data: mockUser, error: null }));

      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe('u1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_by_id', {
        p_user_id: 'u1',
      });
    });

    it('handles malformed session data gracefully', async () => {
      localStorage.setItem(SESSION_KEY, 'not-valid-json');
      await act(async () => {
        await useAuthStore.getState().restoreSession();
      });
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ── logout ────────────────────────────────────────────────
  describe('logout', () => {
    it('clears user and session when logged in', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      await makeValidEncryptedSession();
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({ update: updateMock, insert: insertMock });

      await act(async () => {
        await useAuthStore.getState().logout();
      });
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('clears state even when no user is logged in', async () => {
      await act(async () => {
        await useAuthStore.getState().logout();
      });
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ── clearError ────────────────────────────────────────────
  describe('clearError', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'some error' });
      act(() => useAuthStore.getState().clearError());
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // ── updateOnlineStatus ────────────────────────────────────
  describe('updateOnlineStatus', () => {
    it('updates user is_online in store', async () => {
      useAuthStore.setState({ user: { ...mockUser, is_online: false } });
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockSupabase.from.mockReturnValue({ update: updateMock });

      await act(async () => {
        await useAuthStore.getState().updateOnlineStatus(true);
      });
      expect(useAuthStore.getState().user?.is_online).toBe(true);
    });

    it('does nothing if no user is set', async () => {
      useAuthStore.setState({ user: null });
      // should not throw
      await act(async () => {
        await useAuthStore.getState().updateOnlineStatus(true);
      });
    });

    it('keeps local state updated even when rpc sync fails', async () => {
      useAuthStore.setState({ user: { ...mockUser, is_online: false } });
      mockSupabase.rpc.mockReturnValue(buildRpcQuery({ data: null, error: new Error('offline') }));

      await act(async () => {
        await useAuthStore.getState().updateOnlineStatus(true);
      });

      expect(useAuthStore.getState().user?.is_online).toBe(true);
    });
  });

  // ── login ─────────────────────────────────────────────────
  describe('login', () => {
    it('sets error state on wrong credentials', async () => {
      // verify_user_pin returns null → wrong credentials
      mockSupabase.rpc.mockReturnValue(buildRpcQuery({ data: null, error: null }));

      let thrown = false;
      await act(async () => {
        try {
          await useAuthStore.getState().login('99999', '0000');
        } catch {
          thrown = true;
        }
      });

      expect(thrown).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toContain('NRP atau PIN salah');
    });

    it('sets error state on system error', async () => {
      // verify_user_pin returns a Supabase error → system error
      mockSupabase.rpc.mockReturnValue(buildRpcQuery({ data: null, error: new Error('db error') }));

      await expect(
        act(async () => {
          await useAuthStore.getState().login('99999', '0000');
        })
      ).rejects.toThrow();

      expect(useAuthStore.getState().error).toContain('kesalahan sistem');
    });

    it('authenticates on successful login', async () => {
      // Sequence: verify_user_pin → set_session_context → get_user_by_id → update_user_login → insert_audit_log
      mockSupabase.rpc
        .mockReturnValueOnce(buildRpcQuery({ data: { user_id: 'u1', user_role: 'admin_satuan' }, error: null }))   // verify_user_pin
        .mockReturnValueOnce(buildRpcQuery({ data: null, error: null }))                                      // set_session_context
        .mockReturnValueOnce(buildRpcQuery({ data: mockUser, error: null }))                                 // get_user_by_id
        .mockReturnValue(buildRpcQuery({ data: null, error: null }));                                        // update_user_login, insert_audit_log

      await act(async () => {
        await useAuthStore.getState().login('12345', '1234');
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe('u1');
      expect(localStorage.getItem('karyo_session')).not.toBeNull();
      // Verify verify_user_pin was called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('verify_user_pin', { p_nrp: '12345', p_pin: '1234' });
      // Verify get_user_by_id was called with the resolved user_id
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_by_id', { p_user_id: 'u1' });
    });
  });
});
