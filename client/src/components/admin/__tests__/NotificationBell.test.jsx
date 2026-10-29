// client/src/components/admin/__tests__/NotificationBell.test.jsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ adminOpsSummary: vi.fn() }));
import { adminOpsSummary } from '../../../services/api';
import NotificationBell from '../NotificationBell';

const renderBell = () => render(<MemoryRouter><NotificationBell /></MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

describe('NotificationBell', () => {
  it('shows the alert dot when totalAttention > 0', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [{ key: 'p', label: 'Pending payouts', count: 3, to: '/x', severity: 'warning' }], totalAttention: 3 } });
    renderBell();
    await waitFor(() => expect(screen.getByTestId('bell-dot')).toBeTruthy());
  });

  it('opens dropdown and lists attention rows with counts', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [
      { key: 'p', label: 'Pending payouts', count: 3, to: '/admin/finance/payouts', severity: 'warning' },
      { key: 'r', label: 'Reviews to moderate', count: 0, to: '/admin/support/reviews', severity: 'ok' },
    ], totalAttention: 3 } });
    renderBell();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    await waitFor(() => expect(screen.getByText('Pending payouts')).toBeTruthy());
    // Scope the count to its row — the dropdown header also shows the total (3).
    const row = screen.getByText('Pending payouts').closest('a');
    expect(within(row).getByText('3')).toBeTruthy();
  });

  it('shows empty state when nothing needs attention', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [], totalAttention: 0 } });
    renderBell();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    await waitFor(() => expect(screen.getByText(/nothing needs attention/i)).toBeTruthy());
  });
});
