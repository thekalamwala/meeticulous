import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/communityApi', () => ({
  adminGetReports: vi.fn(), adminResolveReport: vi.fn(), adminModerate: vi.fn(), adminPatchMember: vi.fn(),
  adminSearchContent: vi.fn(), adminPin: vi.fn(), adminGetMembers: vi.fn(), adminPatchSpace: vi.fn(), getSpaces: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import * as api from '../../../services/communityApi';
import AdminCommunity from '../AdminCommunity';

const author = { id: 'u1', display_name: 'Asha', badge: null };
const groups = [
  { target_type: 'post', target_id: 'p1', report_id: 'r1', count: 1, reasons: { defamation: 1 }, latest_reported_at: '2026-11-03T10:00:00Z', preview: { title: 'Bad post', body: 'x', status: 'visible' }, author },
  { target_type: 'comment', target_id: 'c1', report_id: 'r2', count: 5, reasons: { spam: 5 }, latest_reported_at: '2026-11-03T09:00:00Z', preview: { body: 'buy now', status: 'visible' }, author },
];
const setPerms = (permissions) => localStorage.setItem('bas_admin', JSON.stringify({ permissions }));
const renderPage = () => render(<MemoryRouter><AdminCommunity /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  api.adminGetReports.mockResolvedValue({ groups });
  api.adminModerate.mockResolvedValue({ ok: true });
  vi.spyOn(window, 'prompt').mockReturnValue('');
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test('Reports tab lists the defamation group first and flags it', async () => {
  setPerms(['community.view', 'community.moderate']);
  renderPage();
  const cards = await screen.findAllByTestId('report-group');
  expect(within(cards[0]).getByText('Defamation')).toBeTruthy();
  expect(within(cards[1]).queryByText('Defamation')).toBeNull();
});

test('Remove calls the moderate endpoint with action remove', async () => {
  setPerms(['community.moderate']);
  renderPage();
  const [first] = await screen.findAllByTestId('report-group');
  await userEvent.click(within(first).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(api.adminModerate).toHaveBeenCalledWith('posts', 'p1', 'remove', ''));
});

test('cancelling the note prompt aborts a destructive action', async () => {
  setPerms(['community.moderate']);
  window.prompt.mockReturnValue(null);
  renderPage();
  const [first] = await screen.findAllByTestId('report-group');
  await userEvent.click(within(first).getByRole('button', { name: 'Remove' }));
  expect(api.adminModerate).not.toHaveBeenCalled();
});

test('view-only admin sees no action buttons', async () => {
  setPerms(['community.view']);
  renderPage();
  await screen.findAllByTestId('report-group');
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ban author' })).toBeNull();
});

test('Ban author sends a future date from the days input', async () => {
  setPerms(['community.moderate']);
  api.adminPatchMember.mockResolvedValue({});
  renderPage();
  const [first] = await screen.findAllByTestId('report-group');
  await userEvent.click(within(first).getByRole('button', { name: 'Ban author' }));
  await waitFor(() => expect(api.adminPatchMember).toHaveBeenCalled());
  const [uid, patch] = api.adminPatchMember.mock.calls[0];
  expect(uid).toBe('u1');
  expect(Date.parse(patch.banned_until)).toBeGreaterThan(Date.now());
});

test('Members tab: early access toggle patches the member', async () => {
  setPerms(['community.moderate']);
  api.adminGetMembers.mockResolvedValue({ members: [{ user_id: 'u9', display_name: 'Ravi', role: 'host', badge: null, early_access: false, links_allowed: false, banned_until: null, post_count: 0, comment_count: 0 }] });
  api.adminPatchMember.mockResolvedValue({});
  renderPage();
  await userEvent.click(await screen.findByRole('tab', { name: 'Members' }));
  await userEvent.click(await screen.findByRole('checkbox', { name: /early access/i }));
  await waitFor(() => expect(api.adminPatchMember).toHaveBeenCalledWith('u9', { early_access: true }));
});

test('Unban clears banned_until and ban_reason', async () => {
  setPerms(['community.moderate']);
  api.adminGetMembers.mockResolvedValue({ members: [{ user_id: 'u9', display_name: 'Ravi', role: 'host', badge: null, early_access: false, links_allowed: false, banned_until: '9999-12-31T00:00:00Z', post_count: 0, comment_count: 0 }] });
  api.adminPatchMember.mockResolvedValue({});
  renderPage();
  await userEvent.click(await screen.findByRole('tab', { name: 'Members' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Unban' }));
  await waitFor(() => expect(api.adminPatchMember).toHaveBeenCalledWith('u9', { banned_until: null, ban_reason: null }));
});
