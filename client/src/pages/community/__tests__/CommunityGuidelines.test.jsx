import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const features = { flags: { community: true }, ready: true };
vi.mock('../../../context/FeatureContext', () => ({ useFeatures: () => features }));
const auth = { user: null };
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../services/communityApi', () => ({ getMe: vi.fn() }));
vi.mock('../../ErrorPage', () => ({ default: ({ code }) => <h1>Error {code}</h1> }));

import { getMe } from '../../../services/communityApi';
import CommunityGuidelines from '../CommunityGuidelines';

const page = () => render(<MemoryRouter><CommunityGuidelines /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  features.flags = { community: true };
  auth.user = null;
});

test('guidelines show the terms version, grievance officer and timelines', () => {
  page();
  expect(screen.getByRole('heading', { level: 1, name: 'Community Guidelines' })).toBeTruthy();
  expect(screen.getByText(/2026-11-v1/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: /grievance officer/i })).toBeTruthy();
  expect(screen.getByText(/24 hours/)).toBeTruthy();
  expect(screen.getByText(/15 days/)).toBeTruthy();
});

test('flag off, logged out -> 404', async () => {
  features.flags = { community: false };
  page();
  expect(await screen.findByText('Error 404')).toBeTruthy();
  expect(getMe).not.toHaveBeenCalled();
});

test('flag missing from the (fail-open) map is not "on" -> 404 for a plain member', async () => {
  features.flags = {};
  auth.user = { id: 'u1' };
  getMe.mockResolvedValue({ member: { early_access: false, badge: null } });
  page();
  expect(await screen.findByText('Error 404')).toBeTruthy();
});

test('flag off but early access or staff badge -> guidelines', async () => {
  features.flags = { community: false };
  auth.user = { id: 'u1' };
  getMe.mockResolvedValue({ member: { early_access: true } });
  const { unmount } = page();
  expect(await screen.findByRole('heading', { name: 'Community Guidelines' })).toBeTruthy();
  unmount();
  getMe.mockResolvedValue({ member: { badge: 'staff' } });
  page();
  expect(await screen.findByRole('heading', { name: 'Community Guidelines' })).toBeTruthy();
});

test('flag off and /me fails (gate 404) -> 404', async () => {
  features.flags = { community: false };
  auth.user = { id: 'u1' };
  getMe.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 404 } }));
  page();
  expect(await screen.findByText('Error 404')).toBeTruthy();
});
