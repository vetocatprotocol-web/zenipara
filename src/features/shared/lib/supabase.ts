import { createClient } from '@supabase/supabase-js';
import { readSessionContext } from './sessionContext';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/** True only when both required environment variables are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Log a clear error rather than throwing at module evaluation time.
  // A module-level throw fires before React mounts, so the ErrorBoundary
  // never runs and the user sees a blank page with no explanation.
  // Keeping the module loadable lets the app render and show a proper UI.
  console.error(
    '[KARYO OS] Missing Supabase environment variables. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment ' +
      'environment variables. ' +
      'All Supabase API calls will fail until this is resolved.',
  );
}

// createClient requires non-empty strings; use placeholder values so the
// module loads successfully. Any API call will produce a network error
// (not a silent failure) that is surfaced through the ErrorBoundary.
const baseFetch = globalThis.fetch.bind(globalThis);

const sessionAwareFetch: typeof fetch = async (input, init) => {
  const session = readSessionContext();
  if (!session) {
    return baseFetch(input, init);
  }

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-karyo-user-id', session.user_id);
  headers.set('x-karyo-user-role', session.role);
  headers.set('x-karyo-satuan-id', session.satuan_id ?? '');

  if (input instanceof Request) {
    return baseFetch(new Request(input, { ...init, headers }));
  }

  return baseFetch(input, { ...init, headers });
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    global: {
      fetch: sessionAwareFetch,
    },
  },
);
