import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Regression: #707 dropped the StageBadge definition but left a usage in the
// mobile card render, so the Leads page threw "StageBadge is not defined" the
// moment any lead row rendered. The old test suite never rendered a row, so it
// slipped through. This mounts the page WITH a lead row and asserts it renders.

vi.mock('../services/api', () => ({
  crmListLeads: vi.fn(() => Promise.resolve({ data: { rows: [
    { id: 'L1', name: 'Ada Lovelace', status: 'qualified', phone: '9990001111', email: 'ada@x.com', created_at: '2025-01-01', tags: [] },
  ], total: 1 } })),
  crmDashboard: vi.fn(() => Promise.resolve({ data: {} })),
  crmListFollowUps: vi.fn(() => Promise.resolve({ data: [] })),
  crmListTags: vi.fn(() => Promise.resolve({ data: [] })),
  // remaining named imports SalesLeads pulls in — stubbed so the module loads.
  crmCreateLead: vi.fn(), crmBulk: vi.fn(), crmLeadsExportCsv: vi.fn(),
  crmImportPreview: vi.fn(), crmImportCommit: vi.fn(), crmCreateTag: vi.fn(),
  crmUpdateTag: vi.fn(), crmDeleteTag: vi.fn(), crmUpdateLead: vi.fn(),
  crmSetStatus: vi.fn(), crmAddTag: vi.fn(), crmRemoveTag: vi.fn(),
  crmListTemplates: vi.fn(() => Promise.resolve({ data: [] })),
  crmListSequences: vi.fn(() => Promise.resolve({ data: [] })),
  crmListViews: vi.fn(() => Promise.resolve({ data: [] })),
  crmCreateView: vi.fn(), crmDeleteView: vi.fn(),
  getCategories: vi.fn(() => Promise.resolve({ data: [] })),
}));
vi.mock('../pages/admin/sales/LeadDrawer', () => ({ default: () => null }));

import SalesLeads from '../pages/admin/sales/SalesLeads';

test('renders a lead row without crashing (StageBadge defined)', async () => {
  render(<MemoryRouter><SalesLeads /></MemoryRouter>);
  // The row renders in both the desktop table and the mobile card; the card is
  // the one that references StageBadge, so reaching here means it resolved.
  const cells = await screen.findAllByText('Ada Lovelace');
  expect(cells.length).toBeGreaterThan(0);
  // StageBadge renders the status label.
  expect(screen.getAllByText('Qualified').length).toBeGreaterThan(0);
});
