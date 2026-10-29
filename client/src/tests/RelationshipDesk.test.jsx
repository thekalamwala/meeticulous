import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RelationshipDesk from '../pages/admin/sales/RelationshipDesk';

const renderDesk = () => render(<MemoryRouter><RelationshipDesk /></MemoryRouter>);

const ITEMS = [
  { id: 'r1', lead_id: 'L1', name: 'Priya Sharma', business_name: null, reason: 'first_success',
    touch_type: 'appreciation', priority: 'high', suggested_channel: 'whatsapp', suggested_sender: 'owner',
    mode: 'recommend', explanation: 'Landed their first paid booking.', health_state: 'thriving',
    last_meaningful_interaction_at: '2026-06-15T10:00:00Z', last_automated_touch_at: '2026-06-20T10:00:00Z' },
  { id: 'r2', lead_id: 'L2', name: 'Rahul Verma', business_name: null, reason: 'cooling',
    touch_type: 'check_in', priority: 'medium', suggested_channel: 'email', suggested_sender: 'owner',
    mode: 'recommend', explanation: 'Cooling — last meaningful contact 24d ago.', health_state: 'cooling',
    last_meaningful_interaction_at: null, last_automated_touch_at: null },
  { id: 'g1', lead_id: null, contact_id: 'C9', subject_type: 'guest', name: 'Anita Guest', business_name: null,
    reason: 'dormant', touch_type: 'winback', priority: 'low', suggested_channel: 'email', suggested_sender: 'owner',
    mode: 'recommend', explanation: 'Gone quiet after being an active customer.', health_state: 'dormant',
    last_meaningful_interaction_at: '2026-05-01T10:00:00Z', last_automated_touch_at: '2026-05-10T10:00:00Z' },
];

vi.mock('../services/api', () => ({
  crmGetRelationships: vi.fn(() => Promise.resolve({ data: { count: 3, items: ITEMS } })),
  crmRecommendationDone: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  crmRecommendationSnooze: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  crmRecommendationDismiss: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

import { crmGetRelationships, crmRecommendationDone } from '../services/api';

beforeEach(() => vi.clearAllMocks());

test('renders ranked recommendations with name, reason and health', async () => {
  renderDesk();
  await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
  expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
  expect(screen.getByText('First success')).toBeInTheDocument(); // reason label
  expect(screen.getByText('Gone quiet')).toBeInTheDocument();
  expect(screen.getByText('Thriving')).toBeInTheDocument();      // health chip
  // Two-clock header: r2 has neither timestamp → both clocks read "never".
  expect(screen.getByText('Human never')).toBeInTheDocument();
  expect(screen.getByText('Auto never')).toBeInTheDocument();
});

test('a guest rec renders with a Guest badge alongside lead recs', async () => {
  renderDesk();
  await waitFor(() => screen.getByText('Anita Guest'));
  expect(screen.getByText('Guest')).toBeInTheDocument();          // guest subject badge
  expect(screen.getAllByText('Lead').length).toBe(2);             // the two lead recs
  // every rec — lead or guest — still exposes its quick actions
  expect(screen.getAllByRole('button', { name: 'Mark done' }).length).toBe(3);
});

test('Mark done records the touch on the rec\'s suggested channel', async () => {
  renderDesk();
  await waitFor(() => screen.getByText('Priya Sharma'));
  const doneButtons = screen.getAllByRole('button', { name: 'Mark done' });
  fireEvent.click(doneButtons[0]);
  await waitFor(() => expect(crmRecommendationDone).toHaveBeenCalledWith('r1', { channel: 'whatsapp' }));
});

test('empty queue shows the all-warm state', async () => {
  crmGetRelationships.mockResolvedValueOnce({ data: { count: 0, items: [] } });
  renderDesk();
  await waitFor(() => expect(screen.getByText(/every relationship is warm/i)).toBeInTheDocument());
});
