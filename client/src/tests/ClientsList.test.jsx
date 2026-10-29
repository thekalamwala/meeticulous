import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ClientsList from '../pages/ClientsList';

const client = {
  id: 'c1', customer_key: 'p:+911234567890', name: 'Asha Rao',
  phone: '+911234567890', email: 'asha@example.com',
  bookings_count: 3, total_spent: 4500, ltv: 4500, is_recurring: true,
  last_booking_at: '2026-07-01T10:00:00Z', tags: [], attributes: {},
};

vi.mock('../services/api', () => ({
  crmGetCustomers: vi.fn(() => Promise.resolve({ data: { clients: [client], total: 1, page: 1, pageSize: 50 } })),
  crmExportCsv: vi.fn(() => Promise.resolve({ data: new Blob(['csv']) })),
  crmResolveCustomer: vi.fn(() => Promise.resolve({ data: { id: 'resolved-id' } })),
}));

import { crmGetCustomers } from '../services/api';

const renderList = () => render(<MemoryRouter><ClientsList /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

test('renders a client row with name, phone, spend and a recurring badge', async () => {
  renderList();
  await waitFor(() => expect(screen.getAllByText('Asha Rao').length).toBeGreaterThan(0));
  expect(screen.getAllByText('+911234567890').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Recurring').length).toBeGreaterThan(0);
  expect(screen.getByText('1 customer')).toBeInTheDocument();
});

test('typing in the search box refetches with ?q=', async () => {
  renderList();
  await waitFor(() => expect(screen.getAllByText('Asha Rao').length).toBeGreaterThan(0));
  fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'asha' } });
  await waitFor(() => {
    const last = crmGetCustomers.mock.calls.at(-1)[0];
    expect(last.q).toBe('asha');
  });
});

test('shows the empty state when there are no clients', async () => {
  crmGetCustomers.mockResolvedValueOnce({ data: { clients: [], total: 0, page: 1, pageSize: 50 } });
  renderList();
  await waitFor(() => expect(screen.getByText('No customers yet')).toBeInTheDocument());
});
