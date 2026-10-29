import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Availability from '../pages/Availability';

// No saved availability → the form opens in editing mode with every day closed.
vi.mock('../services/api', () => ({
  getAvailability: vi.fn(() => Promise.resolve({ data: null })),
  setAvailability: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('Availability per-day toggle', () => {
  it('opens a closed day and reveals its time inputs', async () => {
    const { container } = render(<MemoryRouter><Availability /></MemoryRouter>);

    // 7 day switches, all closed. Time windows use <Select> dropdowns (30-min
    // preset grid), not <input type=time> — so count selects, and by delta since
    // the page also has fixed selects (Apply Monday's hours, timezone, buffer).
    const switches = await screen.findAllByRole('switch');
    expect(switches).toHaveLength(7);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    const baseSelects = container.querySelectorAll('select').length;

    // Toggle the first day on → a default window appears (start + end selects).
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(container.querySelectorAll('select').length).toBe(baseSelects + 2),
    );
    expect(switches[0].getAttribute('aria-checked')).toBe('true');

    // Toggle it back off → the two window selects disappear.
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(container.querySelectorAll('select').length).toBe(baseSelects),
    );
  });
});
