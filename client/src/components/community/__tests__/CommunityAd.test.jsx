import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const navSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navSpy }));

let user = null;
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user }) }));

const track = vi.fn();
vi.mock('../../../services/analytics', () => ({
  analytics: { track: (...a) => track(...a) },
  EVENTS: { COMMUNITY_AD_IMPRESSION: 'community_ad_impression', COMMUNITY_AD_CLICKED: 'community_ad_clicked' },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn() } }));

import toast from 'react-hot-toast';
import CommunityAd from '../CommunityAd';

const render_ = () => render(<MemoryRouter><CommunityAd /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  try { sessionStorage.clear(); } catch { /* ignore */ }
  vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic: always the first variant in the deck
});
afterEach(() => vi.restoreAllMocks());

test('a guest (or logged-out visitor) gets a become-a-host variant; clicking tracks it and opens signup', async () => {
  user = null; // logged-out
  render_();
  // first GUEST variant (Math.random=0) is the testimonial -> "Start earning"
  expect(track).toHaveBeenCalledWith('community_ad_impression', { ad_code: 'guest_testimonial', audience: 'guest' });
  await userEvent.click(screen.getByRole('button', { name: 'Start earning' }));
  expect(track).toHaveBeenCalledWith('community_ad_clicked', { ad_code: 'guest_testimonial', audience: 'guest' });
  expect(navSpy).toHaveBeenCalledWith('/become-a-host?src=community_ad_guest_testimonial');
});

test('a logged-in non-host guest also gets the guest deck', () => {
  user = { id: 'g1', is_host: false, plan: null };
  render_();
  expect(track).toHaveBeenCalledWith('community_ad_impression', { ad_code: 'guest_testimonial', audience: 'guest' });
});

test('a free host gets an upgrade variant; clicking tracks the code and opens the upgrade flow', async () => {
  user = { id: 'h1', is_host: true, plan: 'free', name: 'Shubham Datarkar' };
  render_();
  // first UPGRADE variant (Math.random=0) is the testimonial -> "Go Pro"
  expect(track).toHaveBeenCalledWith('community_ad_impression', { ad_code: 'upgrade_testimonial', audience: 'upgrade' });
  await userEvent.click(screen.getByRole('button', { name: 'Go Pro' }));
  expect(track).toHaveBeenCalledWith('community_ad_clicked', { ad_code: 'upgrade_testimonial', audience: 'upgrade' });
  expect(navSpy).toHaveBeenCalledWith('/dashboard/upgrade?src=community_ad_upgrade_testimonial');
});

test('a Pro host gets an advertise variant; clicking tracks it and captures intent (no navigation)', async () => {
  user = { id: 'h2', is_host: true, plan: 'premium', name: 'Priya' };
  render_();
  expect(track).toHaveBeenCalledWith('community_ad_impression', { ad_code: 'advertise_capability', audience: 'advertise' });
  await userEvent.click(screen.getByRole('button', { name: 'Feature my page' }));
  expect(track).toHaveBeenCalledWith('community_ad_clicked', { ad_code: 'advertise_capability', audience: 'advertise' });
  expect(navSpy).not.toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalled();
});

test('dismissing hides the ad for the session', async () => {
  user = { id: 'h1', is_host: true, plan: 'free', name: 'Shubham' };
  const { container } = render_();
  await userEvent.click(screen.getByRole('button', { name: 'Hide this' }));
  expect(container.firstChild).toBeNull();
});
