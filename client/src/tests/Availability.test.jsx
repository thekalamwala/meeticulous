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
    const { container } = render(<MemoryRouter><Availability /></MemoryRouter>);

    // 7 day switches, all closed. Time windows use the branded MeetDropdown
    // (.mt-dd) now, not native <select> — count those, by delta since the page
    // also has fixed dropdowns (Apply Monday's hours, timezone, buffer). The
    // Connected-calendars card also renders slide-to-connect switches, so
    // isolate the day toggles by their "Open/Close <day>" label.
    const allSwitches = await screen.findAllByRole('switch');
    const switches = allSwitches.filter((s) => /^(open|close) /i.test(s.getAttribute('aria-label') || ''));
    expect(switches).toHaveLength(7);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    const baseSelects = container.querySelectorAll('.mt-dd').length;

    // Toggle the first day on → a default window appears (start + end selects).
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(container.querySelectorAll('.mt-dd').length).toBe(baseSelects + 2),
    );
    expect(switches[0].getAttribute('aria-checked')).toBe('true');

    // Toggle it back off → the two window selects disappear.
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(container.querySelectorAll('.mt-dd').length).toBe(baseSelects),
    );
  });
});
