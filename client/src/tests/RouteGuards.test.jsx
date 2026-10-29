import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ProtectedRoute's auth + onboarding-resume behavior is covered by its own tests.
// Here we isolate the ROLE wall by stubbing ProtectedRoute to a pass-through.
vi.mock('../components/common/ProtectedRoute', () => ({
  default: ({ children }) => children,
}));

const mockUser = { current: null };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

import HostRoute from '../components/common/HostRoute';
import GuestRoute from '../components/common/GuestRoute';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<div>DASHBOARD home</div>} />
        <Route path="/dashboard/bookings" element={<HostRoute><div>HOST bookings</div></HostRoute>} />
        <Route path="/dashboard/earnings" element={<HostRoute><div>HOST earnings</div></HostRoute>} />
        <Route path="/user/my-bookings" element={<GuestRoute><div>GUEST bookings</div></GuestRoute>} />
        <Route path="/user/profile" element={<GuestRoute><div>GUEST profile</div></GuestRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('role route guards', () => {
  beforeEach(() => { mockUser.current = null; });

  it('redirects a guest off a host route to the guest equivalent', () => {
    mockUser.current = { role: 'user' };
    renderAt('/dashboard/bookings');
    expect(screen.getByText('GUEST bookings')).toBeInTheDocument();
  });

  it('redirects a guest off a host route with no equivalent to guest home', () => {
    mockUser.current = { role: 'user' };
    renderAt('/dashboard/earnings');
    expect(screen.getByText('GUEST bookings')).toBeInTheDocument();
  });

  it('lets a host load a guest route (traveling space)', () => {
    // Unified identity: a host may browse/book as a customer in Traveling mode,
    // so the guest space is no longer walled off by identity.
    mockUser.current = { role: 'host' };
    renderAt('/user/my-bookings');
    expect(screen.getByText('GUEST bookings')).toBeInTheDocument();
  });

  it('lets a host load a host route', () => {
    mockUser.current = { role: 'host' };
    renderAt('/dashboard/bookings');
    expect(screen.getByText('HOST bookings')).toBeInTheDocument();
  });

  it('lets a guest load a guest route', () => {
    mockUser.current = { role: 'user' };
    renderAt('/user/profile');
    expect(screen.getByText('GUEST profile')).toBeInTheDocument();
  });

  it('lets superadmin load a guest route', () => {
    mockUser.current = { role: 'superadmin' };
    renderAt('/user/profile');
    expect(screen.getByText('GUEST profile')).toBeInTheDocument();
  });
});
