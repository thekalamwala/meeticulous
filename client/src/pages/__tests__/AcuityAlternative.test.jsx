import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AcuityAlternative, { FAQ, ACUITY_PRICE } from '../compare/AcuityAlternative';
import { COMPETITORS } from '../../data/competitors';
import { PREMIUM_PLAN } from '../../data/plans';

vi.mock('../../services/analytics', () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: 'LP_VIEWED', LP_CTA_CLICKED: 'LP_CTA_CLICKED' },
}));

const ACU = COMPETITORS.acuity;
const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const renderPage = () => render(<MemoryRouter><AcuityAlternative /></MemoryRouter>);

describe('AcuityAlternative (/compare/acuity-alternative)', () => {
  it('renders exactly one h1 and a primary CTA to /become-a-host', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const ctas = screen.getAllByRole('link', { name: /start free/i });
    expect(ctas.length).toBeGreaterThan(0);
    ctas.forEach((a) => expect(a.getAttribute('href')).toBe('/become-a-host'));
    expect(screen.getByRole('link', { name: /see the comparison/i }).getAttribute('href')).toBe('#side-by-side');
  });

  it("shows Acuity's paidFrom and Pro's monthly price in the table", () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getByText(ACU.paidFrom)).toBeTruthy();
    expect(within(table).getByText(new RegExp(inr(PREMIUM_PLAN.monthly)))).toBeTruthy();
    // null fields render "Not listed", never "No".
    expect(within(table).getAllByText('Not listed').length).toBeGreaterThan(0);
  });

  it('renders every FAQ question once, from the same array as the JSON-LD', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('#faq details')).toHaveLength(FAQ.length);
    FAQ.forEach((f) => expect(screen.getByText(f.q)).toBeTruthy());
  });

  it('shows the trademark / not-affiliated line', () => {
    renderPage();
    expect(screen.getByText(/isn.t affiliated with Acuity Scheduling/i)).toBeTruthy();
  });

  it('parses Acuity pricing from competitors.js and toggles the first-year math', () => {
    expect(Number.isFinite(ACUITY_PRICE.yearlyPerMonth)).toBe(true);
    expect(Number.isFinite(ACUITY_PRICE.monthly)).toBe(true);
    expect(ACUITY_PRICE.plan).toBeTruthy();
    const { yearlyPerMonth: yr, monthly: mo } = ACUITY_PRICE;

    renderPage();
    // Deterministic initial state: yearly.
    expect(screen.getByRole('button', { name: 'Yearly' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(`$${yr} × 12 = $${yr * 12}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText(`$${mo} × 12 = $${mo * 12}`)).toBeTruthy();
    expect(screen.getByText(`${inr(PREMIUM_PLAN.monthly)} × 12 = ${inr(PREMIUM_PLAN.monthly * 12)}`)).toBeTruthy();
  });
});
