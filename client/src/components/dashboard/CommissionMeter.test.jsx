import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommissionMeter from './CommissionMeter';

const setup = (props) => render(<MemoryRouter><CommissionMeter {...props} /></MemoryRouter>);
const line = /in commission/i;

describe('CommissionMeter (free→Pro conversion)', () => {
  it('is blunt once paid exceeds the Pro yearly price, and attributes the CTA', () => {
    setup({ commissionPaid: 2340, isFree: true, src: 'earnings' });
    expect(screen.getByText(/more than Pro costs/i)).toBeInTheDocument();
    expect(screen.getByText(/You've paid ₹2,340 in commission/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go pro|keep every rupee/i }))
      .toHaveAttribute('href', '/dashboard/upgrade?src=earnings');
  });

  it('stays gentle at or below the Pro yearly price (boundary = gentle)', () => {
    setup({ commissionPaid: 1179, isFree: true });
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByText(/more than Pro costs/i)).toBeNull();
  });

  it('defaults the attribution src to "commission"', () => {
    setup({ commissionPaid: 500, isFree: true });
    expect(screen.getByRole('link', { name: /go pro|keep every rupee/i }))
      .toHaveAttribute('href', '/dashboard/upgrade?src=commission');
  });

  it('hides for a paid (Pro) host', () => {
    setup({ commissionPaid: 2340, isFree: false });
    expect(screen.queryByText(line)).toBeNull();
  });

  it('hides when no commission has been paid yet', () => {
    setup({ commissionPaid: 0, isFree: true });
    expect(screen.queryByText(line)).toBeNull();
  });

  it('hides for the session when dismissed', () => {
    setup({ commissionPaid: 2340, isFree: true });
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(line)).toBeNull();
  });
});
