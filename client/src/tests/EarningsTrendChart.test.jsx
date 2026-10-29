import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EarningsTrendChart from '../components/EarningsTrendChart';

const at = (y, m, d = 15) => new Date(y, m, d, 12, 0, 0).toISOString();
const booking = (y, m, price = 1000, vendor = null) => ({
  scheduled_at: at(y, m),
  vendor_amount: vendor,
  services: { price, title: 'S' },
});
const NOW = new Date(2026, 0, 15);

const card = (name) => screen.getByRole('button', { name });

describe('EarningsTrendChart — metric cards', () => {
  it('renders the four metric cards', () => {
    render(<EarningsTrendChart paid={[booking(2026, 0)]} now={NOW} />);
    expect(card(/net earnings/i)).toBeTruthy();
    expect(card(/gross revenue/i)).toBeTruthy();
    expect(card(/paid bookings/i)).toBeTruthy();
    expect(card(/avg booking/i)).toBeTruthy();
  });

  it('defaults to the net metric active', () => {
    render(<EarningsTrendChart paid={[booking(2026, 0)]} now={NOW} />);
    expect(card(/net earnings/i).getAttribute('aria-pressed')).toBe('true');
    expect(card(/gross revenue/i).getAttribute('aria-pressed')).toBe('false');
  });

  it('switches active metric when a card is clicked', () => {
    const { container } = render(
      <EarningsTrendChart paid={[booking(2026, 0)]} now={NOW} />,
    );
    fireEvent.click(card(/gross revenue/i));
    expect(card(/gross revenue/i).getAttribute('aria-pressed')).toBe('true');
    expect(card(/net earnings/i).getAttribute('aria-pressed')).toBe('false');
    const svg = container.querySelector('svg[role="img"]');
    expect(svg.getAttribute('aria-label')).toMatch(/gross/i);
  });
});

describe('EarningsTrendChart — range toggle', () => {
  it('defaults to a 6-month range and renders that many x labels', () => {
    const { container } = render(
      <EarningsTrendChart paid={[booking(2026, 0)]} now={NOW} />,
    );
    expect(card('6M').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-x-label]')).toHaveLength(6);
  });

  it('changes the number of months when the range toggle is used', () => {
    const { container } = render(
      <EarningsTrendChart paid={[booking(2026, 0)]} now={NOW} />,
    );
    fireEvent.click(card('3M'));
    expect(card('3M').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-x-label]')).toHaveLength(3);
  });
});

describe('EarningsTrendChart — states', () => {
  it('shows an empty state when there are no paid bookings', () => {
    render(<EarningsTrendChart paid={[]} now={NOW} />);
    expect(screen.getByText(/no paid earnings/i)).toBeTruthy();
    expect(card(/net earnings/i).textContent).toContain('₹0');
  });

  it('shows a — delta when there is no previous-period data', () => {
    render(<EarningsTrendChart paid={[booking(2026, 0, 2000)]} now={NOW} />);
    expect(card(/net earnings/i).textContent).toContain('—');
  });

  it('shows a percentage delta when the previous period has data', () => {
    render(
      <EarningsTrendChart
        paid={[booking(2026, 0, 2000), booking(2025, 5, 1000)]}
        now={NOW}
      />,
    );
    expect(card(/net earnings/i).textContent).toContain('%');
  });
});
