import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/features/auth/LoginPage';
import { useAuthStore } from '@/features/auth/authStore';

vi.mock('@/features/shared/lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Login page', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('shows validation error when NRP is empty', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));

    expect(await screen.findByText(/NRP tidak boleh kosong/i)).toBeInTheDocument();
  });

  it('shows validation error when PIN is invalid', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nomor Registrasi Pokok/i), { target: { value: '12345' } });
    fireEvent.change(screen.getByPlaceholderText(/6 digit PIN/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Masuk/i }));

    expect(await screen.findByText(/PIN harus 6 digit angka/i)).toBeInTheDocument();
  });
});
