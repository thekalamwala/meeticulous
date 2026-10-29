import { render, screen, waitFor } from '@testing-library/react';
import { vi, test, expect } from 'vitest';

vi.mock('../../../services/api', () => ({
  adminCampaigns: () => Promise.resolve({ data: [{ id: 'c1', name: 'Promo', status: 'draft', stats: { sent: 0, total: 0 }, created_at: '2026-06-12' }] }),
  adminCampSegments: () => Promise.resolve({ data: [] }),
  adminEmailTemplates: () => Promise.resolve({ data: [] }),
  adminCampCreate: vi.fn(), adminCampLaunch: vi.fn(),
  adminCampSegPreview: vi.fn(), adminCampSyncContacts: vi.fn(),
  adminCampWaTemplates: () => Promise.resolve({ data: [] }), adminCampWaCreate: vi.fn(),
}));

import AdminCampaigns from '../AdminCampaigns';

test('renders campaign list', async () => {
  render(<AdminCampaigns />);
  await waitFor(() => expect(screen.getByText('Promo')).toBeTruthy());
  expect(screen.getByText('Campaigns')).toBeTruthy();
});
