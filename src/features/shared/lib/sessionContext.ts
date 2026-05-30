import type { KaryoSession } from '../types';

const SESSION_CONTEXT_KEY = 'karyo_session_context';

export function writeSessionContext(session: KaryoSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_CONTEXT_KEY, JSON.stringify(session));
}

export function readSessionContext(): KaryoSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(SESSION_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as KaryoSession;
    if (!session.user_id || !session.role || !session.expires_at) return null;

    if (new Date(session.expires_at) < new Date()) {
      clearSessionContext();
      return null;
    }

    return session;
  } catch {
    clearSessionContext();
    return null;
  }
}

export function clearSessionContext(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_CONTEXT_KEY);
}