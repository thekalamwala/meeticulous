import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
  getInviteConfig: vi.fn(async () => ({ data: { label: 'Social Squad', active: true } })),
  recordInviteVisit: vi.fn(async () => ({})),
  getVendorGoogleUrl: vi.fn(async () => ({ data: { url: 'https://accounts.google.com/x' } })),
}));

import InviteLanding from '../InviteLanding';
import { getInviteConfig } from '../../services/api';

const renderAt = (slug) => render(
  <MemoryRouter initialEntries={[`/invite/${slug}`]}>
    <Routes>
      <Route path="/invite/:slug" element={<InviteLanding />} />
      <Route path="/" element={<div>HOME</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });

test('stashes bas_invite first-touch and sets invite utm_source', async () => {
  renderAt('social');
  await waitFor(() => expect(localStorage.getItem('bas_invite')).toBe('social'));
  const utm = JSON.parse(sessionStorage.getItem('bas_utm') || '{}');
  expect(utm.utm_source).toBe('invite/social');
});

test('does not overwrite an existing bas_invite', async () => {
  localStorage.setItem('bas_invite', 'earlier');
  renderAt('social');
  await waitFor(() => expect(getInviteConfig).toHaveBeenCalled());
  expect(localStorage.getItem('bas_invite')).toBe('earlier');
});

test('redirects home when slug is inactive/unknown', async () => {
  getInviteConfig.mockResolvedValueOnce({ data: { active: false } });
  const { getByText } = renderAt('ghost');
  await waitFor(() => expect(getByText('HOME')).toBeTruthy());
  expect(localStorage.getItem('bas_invite')).toBeNull();
});
