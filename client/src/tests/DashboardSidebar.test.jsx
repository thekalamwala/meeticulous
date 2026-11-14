import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// FeatureGate just renders its children so nav items don't depend on the flag
// map, and useAuth feeds a controlled user.
vi.mock('../components/common/FeatureGate', () => ({
  default: ({ children }) => children,
}));

// The topbar notification bell hits the API on mount/open — stub it out.
vi.mock('../services/api', () => ({
  getNotifications: vi.fn(() => Promise.resolve({ data: { notifications: [], unreadCount: 0 } })),
  markAllNotificationsRead: vi.fn(() => Promise.resolve({ data: {} })),
  markNotificationRead: vi.fn(() => Promise.resolve({ data: {} })),
  getFeatureFlags: vi.fn(() => Promise.resolve({ data: {} })), // ConsoleSidebar reads flags; coupons off
  getMyKyc: vi.fn(() => Promise.resolve({ data: null })),       // KycNudgeStrip in DashboardLayout
  getMyServices: vi.fn(() => Promise.resolve({ data: [] })),
}));

const mockAuth = { current: {} };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuth.current, logout: () => {} }),
}));

import DashboardLayout from '../components/common/DashboardLayout';

const renderLayout = (user) => {
  mockAuth.current = user;
  return render(
    <MemoryRouter>
      <DashboardLayout><div>PAGE</div></DashboardLayout>
    </MemoryRouter>,
  );
};

const renderAt = (initialPath, user) => {
  mockAuth.current = user;
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <DashboardLayout><div>PAGE</div></DashboardLayout>
    </MemoryRouter>,
  );
};

const openProfile = () => fireEvent.click(screen.getByLabelText('Profile menu'));

describe('dashboard topbar profile menu', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('shows name + category + plan badge on open and never the email', () => {
    renderLayout({ name: 'Shubham Datarkar', email: 'sndatarkar@gmail.com', plan: 'supreme', category: 'career-coaching', is_host: true, role: 'host' });
    openProfile();
    expect(screen.getByText('Shubham Datarkar')).toBeInTheDocument();
    expect(screen.getByText('Career Coaching')).toBeInTheDocument();   // humanized category
    expect(screen.getAllByText(/Supreme/).length).toBeGreaterThan(0);
    expect(screen.queryByText('sndatarkar@gmail.com')).toBeNull();      // email never shown
  });

  it('renders the profile photo in the avatar when one is set', () => {
    renderLayout({ name: 'Shubham Datarkar', email: 'x@y.com', plan: 'supreme', profile_image: 'https://cdn.example/x.jpg', role: 'host' });
    expect(screen.getByAltText('Shubham Datarkar').getAttribute('src')).toBe('https://cdn.example/x.jpg');
  });

  it('falls back to the name initial when there is no photo', () => {
    renderLayout({ name: 'Shubham Datarkar', email: 'x@y.com', plan: 'supreme', role: 'host' });
    expect(screen.queryByAltText('Shubham Datarkar')).toBeNull();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('offers account actions (Hostinger-style sections)', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', username: 'hosty' });
    openProfile();
    const menu = within(screen.getByRole('menu', { name: 'Account' }));
    // Plan chip in the header carries the humanized plan label (creator -> Pro).
    expect(menu.getByText('Pro')).toBeInTheDocument();
    ['Account information', 'Plan & billing', 'Verification', 'View public profile', 'Copy link', 'Account manager', 'Log out']
      .forEach((label) => expect(menu.getByText(label)).toBeInTheDocument());
    // The old nav shortcuts no longer live in the menu — they're in the sidebar.
    expect(menu.queryByText('Upcoming Bookings')).toBeNull();
  });

  it('holds View public profile + Log out (moved out of the sidebar)', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', username: 'hosty' });
    // Not present until the menu is opened — they no longer live in the sidebar.
    expect(screen.queryByText('Log out')).toBeNull();
    openProfile();
    expect(screen.getByText('View public profile')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('shows a verified tick by the name that links to KYC', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', kyc_status: 'approved' });
    openProfile();
    expect(screen.getByRole('link', { name: 'Verified host' }))
      .toHaveAttribute('href', '/dashboard/kyc');
  });

  it('shows a not-verified tick by the name when KYC is not done', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', kyc_status: 'pending' });
    openProfile();
    expect(screen.getByRole('link', { name: /Not verified/ }))
      .toHaveAttribute('href', '/dashboard/kyc');
  });
});

describe('dashboard topbar actions', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('exposes Support + Notifications controls', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host' });
    expect(screen.getByLabelText('Support')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument();
  });
});

describe('mobile — popups + nav drawer', () => {
  const setMobile = (matches) => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({
      matches, media: q, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  };
  beforeEach(() => { mockAuth.current = {}; setMobile(true); });
  afterEach(() => setMobile(false));

  it('profile opens as a sheet with a Close control + account actions', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', username: 'hosty' });
    fireEvent.click(screen.getByLabelText('Profile menu'));
    expect(screen.getByLabelText('Close')).toBeInTheDocument();     // sheet chrome
    expect(screen.getByText('View public profile')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('the More tab opens the drawer and Esc closes it', () => {
    renderLayout({ name: 'Host', plan: 'creator', role: 'host', username: 'hosty' });
    // The mobile nav opener is the bottom tab bar's "More" button.
    fireEvent.click(screen.getByLabelText('More'));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Close navigation')).toBeInTheDocument();
    // Section rail + item panel both live inside the drawer.
    expect(within(drawer).getByLabelText('Sections')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
  });
});

describe('console sidebar — single-column push/pop nav', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('deep-links open the active section panel with its page current', () => {
    renderAt('/dashboard/bookings', { name: 'Host', plan: 'creator', role: 'host' });
    // The Bookings section is pushed open (panel labelled "<section> pages"),
    // with a Back affordance and the active page current.
    const panel = within(screen.getByRole('navigation', { name: 'Bookings pages' }));
    expect(panel.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page');
  });

  it('deep pages highlight their parent item (longest-prefix match)', () => {
    renderAt('/dashboard/services/42/edit', { name: 'Host', plan: 'supreme', role: 'host' });
    const panel = within(screen.getByRole('navigation', { name: 'Catalog pages' }));
    expect(panel.getByRole('link', { name: 'Services' })).toHaveAttribute('aria-current', 'page');
  });

  it('Customers and Products are reachable for every plan (stale nav lock removed)', () => {
    renderAt('/dashboard/products', { name: 'Host', plan: 'free', role: 'host' });
    const products = screen.getByRole('link', { name: 'Products' });
    expect(products).not.toHaveAttribute('aria-disabled', 'true');
    expect(products).toHaveAttribute('href', '/dashboard/products');
  });

  it('moves Transactions into the Money section', () => {
    renderAt('/dashboard/payments/transactions', { name: 'Host', plan: 'creator', role: 'host' });
    const panel = within(screen.getByRole('navigation', { name: 'Money pages' }));
    expect(panel.getByRole('link', { name: 'Transactions' })).toHaveAttribute('aria-current', 'page');
  });

  it('surfaces a KYC-pending attention badge on Payouts (KYC gates payouts)', () => {
    renderAt('/dashboard/payments/payouts', { name: 'Host', plan: 'creator', role: 'host', kyc_status: 'pending' });
    // Payouts item's SR name carries the count + noun.
    expect(screen.getByLabelText('Payouts, 1 verify to get paid')).toBeInTheDocument();
  });

  it('shows the loud KYC banner atop Settings while unverified', () => {
    renderAt('/dashboard/kyc', { name: 'Host', plan: 'creator', role: 'host', kyc_status: 'pending' });
    // KYC pending → a maroon "Verify to get paid" banner leads the Settings panel.
    expect(screen.getByRole('link', { name: 'Verify to get paid' })).toHaveAttribute('href', '/dashboard/kyc');
  });
});

describe('console sidebar — tier-aware bottom slot', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('pitches Pro to free hosts', () => {
    renderAt('/dashboard', { name: 'H', plan: 'free', role: 'host' });
    expect(screen.getByRole('link', { name: 'Go Pro. Go Premium' }))
      .toHaveAttribute('href', '/dashboard/upgrade');
  });

  it('offers Refer & Earn to legacy paid hosts (no dead-end upsell)', () => {
    renderAt('/dashboard', { name: 'H', plan: 'creator', role: 'host' });
    expect(screen.getByRole('link', { name: 'Refer & Earn. Invite a host' }))
      .toHaveAttribute('href', '/dashboard/referrals');
  });

  it('shows Refer & Earn (no upsell) for Studio hosts', () => {
    renderAt('/dashboard', { name: 'H', plan: 'professional', role: 'host' });
    expect(screen.queryByRole('link', { name: /Go Pro/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Refer & Earn. Invite a host' }))
      .toHaveAttribute('href', '/dashboard/referrals');
  });

  it('shows concierge (no upsell, never advertises Supreme) for Supreme hosts', () => {
    renderAt('/dashboard', { name: 'H', plan: 'supreme', role: 'host' });
    expect(screen.queryByRole('link', { name: /Upgrade|Studio/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Priority concierge. Talk to your manager' }))
      .toHaveAttribute('href', '/bolt958');
  });
});

describe('dashboard sidebar — no premium / manage-plan card', () => {
  beforeEach(() => { mockAuth.current = {}; });

  it('never renders the old premium upsell card', () => {
    renderLayout({ name: 'Free User', plan: 'explorer', role: 'host' });
    expect(screen.queryByText('Upgrade to Host+')).toBeNull();
    expect(screen.queryByText('Upgrade — 20% off')).toBeNull();
  });

  it('shows no plan card for paid tiers either', () => {
    renderLayout({ name: 'Pro User', plan: 'supreme', role: 'host' });
    expect(screen.queryByText('Supreme access')).toBeNull();
    expect(screen.queryByText('Manage plan')).toBeNull();
  });
});
