/**
 * tests/MembershipsPublish.test.jsx
 * Prod bug 2026-11-27: Go live worked, but the SAME button then read "Move to
 * draft", so a double-click's 2nd click undid it (live → draft → live, all 200).
 * Guards: one publish call per click burst, no reversing action in Go live's
 * place, Move to draft confirmed first, and inline Saved / error on the card.
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const draftProgram = {
  id: 'p1', name: 'Inner Loop', blurb: '', status: 'draft',
  tiers: [{ id: 't1', name: 'Premium', type: 'paid', price_inr: 499, status: 'live', perks: [] }],
};

vi.mock('../services/api', () => ({
  getMyMembership: vi.fn(),
  saveMembership: vi.fn(),
  publishMembership: vi.fn(),
  getHostMembers: vi.fn().mockResolvedValue({ data: { member_count: 0, mrr: 0, members: [] } }),
  updateMembershipTier: vi.fn(),
  deleteMembershipTier: vi.fn(),
  addMembershipTier: vi.fn(),
  uploadImage: vi.fn(),
}));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, Toaster: () => null };
});
vi.mock('../context/FeatureContext', () => ({ useFeature: vi.fn(() => true) }));
vi.mock('../hooks/useFeatureFlags', () => ({ default: () => ({ flags: { dashboard_v2: true } }) }));

import { getMyMembership, saveMembership, publishMembership } from '../services/api';
import Memberships from '../pages/Memberships';

const renderPage = async (program = draftProgram) => {
  getMyMembership.mockResolvedValue({ data: { program } });
  render(<MemoryRouter><Memberships /></MemoryRouter>);
  await screen.findByText('Your program');
};

beforeEach(() => vi.clearAllMocks());

describe('Memberships — Go live', () => {
  test('a double-click sends ONE publish and never {live:false}', async () => {
    let resolve;
    publishMembership.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await renderPage();

    const goLive = screen.getByRole('button', { name: 'Go live' });
    fireEvent.click(goLive);
    fireEvent.click(goLive); // second click of the double-click, before any re-render
    expect(publishMembership).toHaveBeenCalledTimes(1);
    expect(publishMembership).toHaveBeenCalledWith(true);

    await act(async () => { resolve({ data: { program: { status: 'live' } } }); });
    expect(await screen.findByText('Live · members can join')).toBeTruthy();
    // Nothing that reverses it sits where Go live was.
    expect(screen.queryByRole('button', { name: 'Go live' })).toBeNull();

    // A fast extra click on "Move to draft" right after going live is ignored.
    fireEvent.click(screen.getByRole('button', { name: 'Move to draft' }));
    expect(screen.queryByText(/Members can't join while it's in draft/)).toBeNull();
    expect(publishMembership).not.toHaveBeenCalledWith(false);
    expect(publishMembership).toHaveBeenCalledTimes(1);
  });

  test('Move to draft asks first, then sends {live:false}', async () => {
    publishMembership.mockResolvedValue({ data: { program: { status: 'draft' } } });
    await renderPage({ ...draftProgram, status: 'live' });

    fireEvent.click(screen.getByRole('button', { name: 'Move to draft' }));
    expect(publishMembership).not.toHaveBeenCalled();
    expect(await screen.findByText(/Members can't join while it's in draft/)).toBeTruthy();

    const confirms = screen.getAllByRole('button', { name: 'Move to draft' });
    fireEvent.click(confirms[confirms.length - 1]);
    await waitFor(() => expect(publishMembership).toHaveBeenCalledWith(false));
  });

  test('a failed Go live shows the reason on the card', async () => {
    publishMembership.mockRejectedValue({ response: { data: { message: 'Publish at least one tier before going live.' } } });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least one tier/);
  });
});

describe('Memberships — Save program', () => {
  test('shows "Saved just now" inline until the next edit', async () => {
    saveMembership.mockResolvedValue({ data: { program: draftProgram } });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Save program' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Saved just now/);

    fireEvent.change(screen.getByPlaceholderText('e.g. Inner Circle'), { target: { value: 'Inner Loop 2' } });
    expect(screen.queryByText(/Saved just now/)).toBeNull();
  });

  test('a failed save shows the error on the card', async () => {
    saveMembership.mockRejectedValue({ response: { data: { message: 'name is required' } } });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Save program' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/name is required/);
  });
});
