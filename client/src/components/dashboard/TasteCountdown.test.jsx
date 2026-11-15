import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasteCountdown from './TasteCountdown';

const setup = (taste) => render(<MemoryRouter><TasteCountdown taste={taste} /></MemoryRouter>);

describe('TasteCountdown (WhatsApp taste expiry nudge)', () => {
  it('renders nothing when there is no taste window', () => {
    const { container } = setup(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts down the days left and attributes the CTA', () => {
    setup({ endsAt: '2026-12-01T00:00:00Z', daysLeft: 12, endedDaysAgo: null });
    expect(screen.getByText(/12 days left/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go pro/i }))
      .toHaveAttribute('href', '/dashboard/upgrade?src=reminders');
  });

  it('uses the singular "day" at one day left', () => {
    setup({ endsAt: '2026-11-15T00:00:00Z', daysLeft: 1, endedDaysAgo: null });
    expect(screen.getByText(/1 day left/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 days left/i)).toBeNull();
  });

  it('switches to the "off" message once the window has ended', () => {
    setup({ endsAt: '2026-10-01T00:00:00Z', daysLeft: 0, endedDaysAgo: 3 });
    expect(screen.getByText(/reminders are off/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go pro/i }))
      .toHaveAttribute('href', '/dashboard/upgrade?src=reminders');
  });
});
