import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Availability from '../pages/Availability';

// No saved availability → the form opens in editing mode with every day closed.
vi.mock('../services/api', () => ({
  getAvailability: vi.fn(() => Promise.resolve({ data: null })),
  setAvailability: vi.fn(() => Promise.resolve({ data: {} })),
  getGoogleAuthUrl: vi.fn(() => Promise.resolve({ data: { url: '#' } })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('Availability per-day toggle', () => {
  it('opens a closed day and reveals its time inputs', async () => {
    render(<MemoryRouter><Availability /></MemoryRouter>);

    // Scope to the desktop weekly grid: the page also renders the mobile day
    // cards (HoursMobile), the Connected-calendars switches, and the Booking-rules
    // dropdowns — all in the DOM at once in jsdom. The grid holds the 7 day toggles
    // and, per open day, start+end dropdowns (branded MeetDropdown = .mt-dd now).
    const grid = await screen.findByTestId('weekly-grid');
    const switches = [...grid.querySelectorAll('[role="switch"]')];
    expect(switches).toHaveLength(7);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    const baseSelects = grid.querySelectorAll('.mt-dd').length;

    // Toggle the first day on → a default window appears (start + end selects).
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(grid.querySelectorAll('.mt-dd').length).toBe(baseSelects + 2),
    );
    expect(switches[0].getAttribute('aria-checked')).toBe('true');

    // Toggle it back off → the two window selects disappear.
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(grid.querySelectorAll('.mt-dd').length).toBe(baseSelects),
    );
  });
});
