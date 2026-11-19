// Tile renders every stat figure on the live dashboard — Today, Bookings, Earnings,
// Payouts, the four Intelligence pages and Community. Its value span carries
// tabular-nums so a row of tiles does not jitter as values refresh.
//
// RankedBars already had it; Tile did not, which is why Earnings showed four
// currency figures with none. Asserted here because it is one class on one line
// and silently easy to drop in a restyle.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tile } from '../components/dashboard/ui/v2';

describe('Tile', () => {
  it('renders its value with tabular-nums', () => {
    render(<Tile label="Net earnings" value="₹82,400" />);
    expect(screen.getByText('₹82,400').className).toContain('tabular-nums');
  });

  it('keeps tabular-nums on an accent tile', () => {
    render(<Tile label="Ready to withdraw" value="₹9" accent />);
    expect(screen.getByText('₹9').className).toContain('tabular-nums');
  });

  it('still renders label and hint', () => {
    render(<Tile label="Upcoming" value="14" hint="Next 30 days" />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Next 30 days')).toBeInTheDocument();
  });
});
