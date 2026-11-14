/**
 * tests/PlanComparison.test.jsx
 * The in-dashboard Free vs Pro feature matrix.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlanComparison from '../components/pricing/PlanComparison';

describe('PlanComparison', () => {
  it('renders both plan columns and the headline commission difference', () => {
    render(<PlanComparison />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();

    // The commission row is the whole pitch: 5% free vs 0% Pro.
    const row = screen.getByText('Commission on your bookings').closest('tr');
    expect(within(row).getByText('5%')).toBeInTheDocument();
    expect(within(row).getByText('0%')).toBeInTheDocument();
  });

  it('renders group headers from the matrix', () => {
    render(<PlanComparison />);
    expect(screen.getByText('Price & commission')).toBeInTheDocument();
    expect(screen.getByText('Selling')).toBeInTheDocument();
  });
});
