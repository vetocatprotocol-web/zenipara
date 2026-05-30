import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '@/app/ProtectedRoute';
import { useAuthStore } from '@/features/store/authStore';
import { useFeatureStore } from '@/store/featureStore';
import { DEFAULT_FEATURE_FLAGS } from '@/features/shared/lib/featureFlags';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,
    });
    useFeatureStore.setState({
      flags: { ...DEFAULT_FEATURE_FLAGS },
      isLoaded: true,
      isLoading: false,
      isSaving: false,
      loadedForUserId: null,
      loadFeatureFlags: vi.fn(),
      setFeatureEnabled: vi.fn(),
      setFeatureFlags: vi.fn(),
      setAllFeaturesEnabled: vi.fn(),
    });
  });

  it('renders loading spinner when not initialized', () => {
    useAuthStore.setState({ isInitialized: false, isAuthenticated: false, user: null });
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/*" element={<ProtectedRoute allowedRoles={['admin_satuan']} />}> 
            <Route path="" element={<div>Allowed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Memuat/i)).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false, user: null });
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>LoginPage</div>} />
          <Route path="/*" element={<ProtectedRoute allowedRoles={['admin_satuan']} />}> 
            <Route path="" element={<div>Allowed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/LoginPage/i)).toBeInTheDocument();
  });

  it('redirects unauthorized user to default role page', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: true, user: { id: 'u1', nrp: '11111', nama: 'Komandan A', role: 'komandan', satuan: 'Satuan A', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-14T00:00:00Z', updated_at: '2026-04-14T00:00:00Z' } });
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/komandan/dashboard" element={<div>KomandanDashboard</div>} />
          <Route path="/*" element={<ProtectedRoute allowedRoles={['admin_satuan']} />}> 
            <Route path="" element={<div>Allowed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/KomandanDashboard/i)).toBeInTheDocument();
  });

  it('renders child outlet for authorized user', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: true, user: { id: 'u1', nrp: '11111', nama: 'Admin A', role: 'admin_satuan', satuan: 'Pusat', is_active: true, is_online: true, login_attempts: 0, created_at: '2026-04-14T00:00:00Z', updated_at: '2026-04-14T00:00:00Z' } });
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin_satuan']} />}>
            <Route index element={<div>Allowed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Allowed/i)).toBeInTheDocument();
  });

  // Guard-specific routing tests removed after guard role deprecation
});
