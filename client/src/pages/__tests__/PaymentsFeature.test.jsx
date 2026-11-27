import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentsFeature, { payoutBreakdown } from '../features/PaymentsFeature';

describe('payoutBreakdown', () => {
  // Pinned to the worked examples published on /host-fees §5 (you list ₹1,000;
  // pricing v2 fee, tds_tcs_v2 withholding for a host with a PAN and no GSTIN).
  it('matches the Pro (0%) example', () => {
    const b = payoutBreakdown(1000, 0);
    expect(b.guestPays).toBe(1010);
    expect([b.feeTaxable, b.feeGst]).toEqual([8.47, 1.53]);
    expect(b.gateway).toBe(20.2);
    expect(b.keep).toBe(978.8);
  });

  it('matches the Starter (9%) example', () => {
    expect(payoutBreakdown(1000, 9).keep).toBe(888.8);
  });
});

describe('Payments feature page', () => {
  const renderPage = () => render(<MemoryRouter><PaymentsFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/become-a-host');
    expect(screen.getByRole('link', { name: /see what you keep/i }).getAttribute('href')).toBe('#keep');
  });

  it('renders the Guides block directly above the FAQ', () => {
    // PageGuides reads the route itself; App skips /features + /for so it isn't doubled.
    const { container } = render(
      <MemoryRouter initialEntries={['/features/payments']}><PaymentsFeature /></MemoryRouter>,
    );
    const guides = container.querySelectorAll('#page-guides-title');
    expect(guides).toHaveLength(1);
    expect(guides[0].closest('section').nextElementSibling.id).toBe('faq');
  });

  it('recalculates what you keep when the price changes', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/your price for one session/i), { target: { value: '1000' } });
    expect(screen.getByText('₹978.80')).toBeTruthy();
    expect(screen.getByText('₹888.80')).toBeTruthy();
  });
});
