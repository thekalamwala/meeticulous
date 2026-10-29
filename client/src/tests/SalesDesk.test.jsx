import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the API + the drawer (its LeadPanel deps are irrelevant to the action logic).
vi.mock('../services/api', () => ({
  crmGetDesk: vi.fn(),
  crmSetStatus: vi.fn(() => Promise.resolve({ data: {} })),
  crmCreateFollowUp: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('../pages/admin/sales/LeadDrawer', () => ({ default: () => null }));

import SalesDesk from '../pages/admin/sales/SalesDesk';
import { crmGetDesk, crmSetStatus, crmCreateFollowUp } from '../services/api';

const emptyQueues = () => ({
  needs_attention: { count: 0, leads: [] }, replies: { count: 0, leads: [] },
  followups: { count: 0, leads: [] }, high_intent: { count: 0, leads: [] },
  activation: { count: 0, leads: [] },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  crmGetDesk.mockResolvedValue({ data: {
    ...emptyQueues(),
    high_intent: { count: 1, leads: [{ id: 'L1', name: 'Ada Lovelace', score: 82, intent: 'high', reasons: ['High intent (score 82)'] }] },
  } });
});

test('renders a lead in its queue', async () => {
  render(<SalesDesk />);
  expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
});

test('Won action calls crmSetStatus(id, "paid")', async () => {
  render(<SalesDesk />);
  await screen.findByText('Ada Lovelace');
  fireEvent.click(screen.getByText('Won'));
  await waitFor(() => expect(crmSetStatus).toHaveBeenCalledWith('L1', 'paid'));
});

test('Snooze action creates a follow-up', async () => {
  render(<SalesDesk />);
  await screen.findByText('Ada Lovelace');
  fireEvent.click(screen.getByText('Snooze 2d'));
  await waitFor(() => expect(crmCreateFollowUp).toHaveBeenCalledWith('L1', expect.objectContaining({ remind: true })));
});

test('Won is guarded by confirm — cancel does nothing', async () => {
  window.confirm.mockReturnValue(false);
  render(<SalesDesk />);
  await screen.findByText('Ada Lovelace');
  fireEvent.click(screen.getByText('Won'));
  expect(crmSetStatus).not.toHaveBeenCalled();
});
