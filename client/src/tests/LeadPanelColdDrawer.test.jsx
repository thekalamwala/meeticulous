import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  crmGetLead: vi.fn(() => Promise.resolve({ data: { lead: { id: 'x1', name: 'Ada', email: 'a@b.com', status: 'list', list_id: 'L1', tags: [], website: 'https://ada.io' }, notes: [], followUps: [] } })),
  crmLeadTimeline: vi.fn(() => Promise.resolve({ data: [] })),
  crmLeadMessages: vi.fn(() => Promise.resolve({ data: [] })),
  crmListTemplates: vi.fn(() => Promise.resolve({ data: [] })),
  crmListTags: vi.fn(() => Promise.resolve({ data: [] })),
  crmListLists: vi.fn(() => Promise.resolve({ data: [{ id: 'L1', name: 'This list' }, { id: 'L2', name: 'Other list' }] })),
  crmUpdateLead: vi.fn(() => Promise.resolve({ data: {} })),
  crmSetStatus: vi.fn(() => Promise.resolve({ data: {} })),
  crmSetDnc: vi.fn(() => Promise.resolve({ data: {} })),
  // referenced by the module but unused on this path — stubbed so it loads.
  crmAddLeadNote: vi.fn(), crmCreateFollowUp: vi.fn(), crmCompleteFollowUp: vi.fn(),
  crmAddTag: vi.fn(), crmRemoveTag: vi.fn(), crmLogCall: vi.fn(), crmSendWhatsApp: vi.fn(), crmSendEmail: vi.fn(),
  crmCreateTag: vi.fn(), crmListSequences: vi.fn(() => Promise.resolve({ data: [] })), crmEnroll: vi.fn(),
  crmListLeads: vi.fn(() => Promise.resolve({ data: { rows: [] } })), crmMergeLead: vi.fn(),
}));

import LeadPanel from '../pages/admin/sales/LeadPanel';

const drawer = () => render(<MemoryRouter><LeadPanel leadId="x1" variant="drawer" /></MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

test('cold lead drawer shows promote / disqualify / move + a website link', async () => {
  drawer();
  expect(await screen.findByRole('button', { name: /promote/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /disqualify/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /move to list/i })).toBeTruthy();
  expect(screen.getByText(/website/i)).toBeTruthy(); // socials link in identity
});

test('move to another list updates the lead list_id', async () => {
  drawer();
  fireEvent.click(await screen.findByRole('button', { name: /move to list/i }));
  fireEvent.click(await screen.findByText('Other list'));   // L1 (current) is filtered out
  await waitFor(() => expect(api.crmUpdateLead).toHaveBeenCalledWith('x1', { list_id: 'L2' }));
});

test('edit details saves the changed fields', async () => {
  drawer();
  fireEvent.click(await screen.findByRole('button', { name: /edit details/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(api.crmUpdateLead).toHaveBeenCalledWith('x1', expect.objectContaining({ name: 'Ada', email: 'a@b.com' })));
});
