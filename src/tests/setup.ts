import '@testing-library/jest-dom';

// Mock supabase module to prevent env var errors and network calls in tests
vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  },
}));

// Suppress expected noise produced during tests:
//   • [KARYO OS] – handleError's intentional DEV-mode console.error for mocked errors
//   • React Router Future Flag Warning – v6 warnings suppressed until v7 migration
const _origError = console.error;
const _origWarn = console.warn;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (String(args[0] ?? '') === '[KARYO OS]') return;
    _origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (String(args[0] ?? '').includes('React Router Future Flag Warning')) return;
    _origWarn(...args);
  };
});
afterAll(() => {
  console.error = _origError;
  console.warn = _origWarn;
});

// Reset localStorage between tests
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
