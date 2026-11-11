import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommissionMeter from './CommissionMeter';

const setup = (props) => render(<MemoryRouter><CommissionMeter {...props} /></MemoryRouter>);
const line = /paid .* in platform commission/i;

describe('CommissionMeter (free→Pro conversion)', () => {
  it('shows the rupees paid + upgrade link for a free host who has paid commission', () => {
    setup({ commissionPaid: 1250, isFree: true });
    expect(screen.getByText(/You've paid ₹1,250 in platform commission/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See plans/i })).toHaveAttribute('href', '/dashboard/upgrade');
  });

  it('hides for a paid (Pro) host', () => {
    setup({ commissionPaid: 1250, isFree: false });
    expect(screen.queryByText(line)).toBeNull();
  });

  it('hides when no commission has been paid yet', () => {
    setup({ commissionPaid: 0, isFree: true });
    expect(screen.queryByText(line)).toBeNull();
  });
});
