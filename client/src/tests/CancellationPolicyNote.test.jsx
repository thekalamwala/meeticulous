/**
 * tests/CancellationPolicyNote.test.jsx
 * The checkout cancellation-policy disclosure + its tier formatter.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import CancellationPolicyNote from '../components/booking/CancellationPolicyNote';
import { cancellationSegments } from '../lib/cancellationPolicy';

describe('cancellationSegments', () => {
  it('formats the default policy into window-based rows', () => {
    expect(cancellationSegments()).toEqual([
      { pct: 'Full refund', when: '24h or more before' },
      { pct: '50% refund', when: '6–24h before' },
      { pct: 'No refund', when: 'under 6h before, or no-show' },
    ]);
  });

  it('formats a stricter custom policy (Pro 48/24)', () => {
    const rows = cancellationSegments([{ hours: 48, pct: 1 }, { hours: 24, pct: 0.5 }, { hours: 0, pct: 0 }]);
    expect(rows[0]).toEqual({ pct: 'Full refund', when: '48h or more before' });
    expect(rows[1]).toEqual({ pct: '50% refund', when: '24–48h before' });
    expect(rows[2].pct).toBe('No refund');
  });
});

describe('CancellationPolicyNote', () => {
  it('renders the policy and a link to the full policy', () => {
    render(<MemoryRouter><CancellationPolicyNote /></MemoryRouter>);
    expect(screen.getByText('Cancellation policy')).toBeInTheDocument();
    expect(screen.getByText('Full refund')).toBeInTheDocument();
    expect(screen.getByText(/booking fee is non-refundable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /full policy/i })).toHaveAttribute('href', '/refund');
  });
});
