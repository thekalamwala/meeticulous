/**
 * tests/InviteLandingLinkedin.test.jsx
 * /invite/:slug — both CTAs offer LinkedIn, and a LinkedIn click stashes the
 * invite first (parity with the Google CTA's `readInvite() || slug`).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

const start = vi.fn(async () => {});
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ startLinkedinHostAuth: start }) }));
vi.mock('../context/FeatureContext', () => ({
  useFeature: () => true,
  useFeatures: () => ({ flags: { host_linkedin_login: true } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('../services/api', () => ({
  getInviteConfig: vi.fn(async () => ({ data: { active: true, label: 'Asha' } })),
  recordInviteVisit: vi.fn(async () => ({})),
  getVendorGoogleUrl: vi.fn(),
}));
vi.mock('./../pages/Home', () => ({ STATS: [], Odometer: () => null }));
vi.mock('../components/home/Reveal', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/home/HowItWorks', () => ({ default: () => null }));
vi.mock('../components/pricing/PricingCards', () => ({ default: () => null }));
vi.mock('../components/common/IconArt', () => ({ default: () => null }));
vi.mock('../components/common/Seo', () => ({ default: () => null }));

import InviteLanding from '../pages/InviteLanding';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });

const renderPage = () => render(
  <MemoryRouter initialEntries={['/invite/vip-asha']}>
    <Routes><Route path="/invite/:slug" element={<InviteLanding />} /></Routes>
  </MemoryRouter>,
);

test('LinkedIn on both CTAs; click stashes the invite slug before auth', async () => {
  renderPage();
  const buttons = await screen.findAllByRole('button', { name: /continue with linkedin/i });
  expect(buttons).toHaveLength(2);
  localStorage.clear(); // stash not (yet) there
  let inviteAtStart = null;
  start.mockImplementationOnce(async () => { inviteAtStart = localStorage.getItem('bas_invite'); });
  fireEvent.click(buttons[1]);
  await waitFor(() => expect(start).toHaveBeenCalledWith('signup'));
  expect(inviteAtStart).toBe('vip-asha');
});
