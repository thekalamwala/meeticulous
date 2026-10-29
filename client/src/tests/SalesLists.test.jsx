import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  crmListLists: vi.fn(() => Promise.resolve({ data: [{ id: 'L1', name: 'Topmate — cold', source: 'topmate', cold_count: 3 }] })),
  crmCreateList: vi.fn(),
  crmGetList: vi.fn(() => Promise.resolve({ data: { id: 'L1', name: 'Topmate — cold', source: 'topmate' } })),
  crmListLeads: vi.fn(() => Promise.resolve({ data: { rows: [{ id: 'x1', name: 'Ada', email: 'a@b.com', tags: ['topmate', 'grade-A'] }], total: 1 } })),
  crmBulk: vi.fn(), crmImportCommit: vi.fn(),
  crmListTags: vi.fn(() => Promise.resolve({ data: [{ id: 't1', name: 'grade-A' }, { id: 't2', name: 'topmate' }] })),
  adminCampCreateSegment: vi.fn(() => Promise.resolve({ data: { id: 'seg1' } })),
}));
// Stub the drawer so the row-click test doesn't mount the full LeadPanel.
vi.mock('../pages/admin/sales/LeadDrawer', () => ({ default: ({ leadId }) => (leadId ? <div>drawer-open:{leadId}</div> : null) }));

const detail = () => render(
  <MemoryRouter initialEntries={['/admin/sales/lists/L1']}>
    <Routes><Route path="/admin/sales/lists/:id" element={<SalesLists />} /></Routes>
  </MemoryRouter>,
);

import SalesLists from '../pages/admin/sales/SalesLists';

beforeEach(() => vi.clearAllMocks());

test('lists index renders a list card with its cold count', async () => {
  render(<MemoryRouter initialEntries={['/admin/sales/lists']}>
    <Routes><Route path="/admin/sales/lists" element={<SalesLists />} /></Routes>
  </MemoryRouter>);
  expect(await screen.findByText('Topmate — cold')).toBeTruthy();
  expect(screen.getByText(/3/)).toBeTruthy();
});

test('list detail scopes the leads query to the list', async () => {
  detail();
  await screen.findByText('Ada');
  expect(api.crmListLeads).toHaveBeenCalledWith(expect.objectContaining({ listId: 'L1' }));
});

test('clicking a contact row opens the lead drawer', async () => {
  detail();
  fireEvent.click(await screen.findByText('Ada'));
  expect(await screen.findByText('drawer-open:x1')).toBeTruthy();
});

test('Create segment posts a prospect segment scoped to the list source tag', async () => {
  vi.spyOn(window, 'prompt').mockReturnValue('My Topmate Segment');
  detail();
  const btn = await screen.findByRole('button', { name: /create segment/i });
  fireEvent.click(btn);
  await waitFor(() => expect(api.adminCampCreateSegment).toHaveBeenCalledTimes(1));
  const arg = api.adminCampCreateSegment.mock.calls[0][0];
  expect(arg.name).toBe('My Topmate Segment');
  expect(arg.definition.contact_type).toBe('prospect');
  expect(arg.definition.filters).toContainEqual({ field: 'tags', op: 'contains', value: 'topmate' });
});
