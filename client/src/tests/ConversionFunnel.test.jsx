/**
 * tests/ConversionFunnel.test.jsx
 * Pro-gated views→bookings funnel: real numbers for Pro, upsell overlay for free.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ConversionFunnel from '../components/dashboard/ConversionFunnel';

const renderIt = (props) => render(<MemoryRouter><ConversionFunnel {...props} /></MemoryRouter>);

describe('ConversionFunnel', () => {
  it('shows the host\'s real numbers and conversion % for a Pro host', () => {
    renderIt({ views: 200, bookings: 50, isFree: false });
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument(); // 50/200
    expect(screen.queryByText(/upgrade to/i)).toBeNull();
  });

  it('guards against divide-by-zero (0 views → 0%)', () => {
    renderIt({ views: 0, bookings: 0, isFree: false });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows the upgrade overlay (not real numbers) for a free host', () => {
    renderIt({ views: 7, bookings: 1, isFree: true });
    expect(screen.getByRole('link', { name: /upgrade to/i })).toHaveAttribute('href', '/dashboard/upgrade?src=funnel');
    // Real figures are not shown; the blurred teaser uses sample numbers instead.
    expect(screen.queryByText('7')).toBeNull();
  });
});
