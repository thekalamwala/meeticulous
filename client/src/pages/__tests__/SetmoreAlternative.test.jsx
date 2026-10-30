import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SetmoreAlternative, { FAQ } from '../compare/SetmoreAlternative';
import { COMPETITORS } from '../../data/competitors';
import { PREMIUM_PLAN } from '../../data/plans';

vi.mock('../../hooks/useUtm', () => ({ default: () => ({}) }));
vi.mock('../../services/analytics', () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: 'LP_VIEWED', LP_CTA_CLICKED: 'LP_CTA_CLICKED' },
}));

const S = COMPETITORS.setmore;
const words = (s) => s.trim().split(/\s+/).length;
const renderPage = () => render(<MemoryRouter><SetmoreAlternative /></MemoryRouter>);

describe('SetmoreAlternative (/compare/setmore-alternative)', () => {
  it('has exactly one h1 and a modest DOM', () => {
    const { container } = renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('*').length).toBeLessThan(1200);
  });

  it('sends every "Start free" CTA to /become-a-host', () => {
    renderPage();
    const ctas = screen.getAllByRole('link', { name: /^start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((a) => expect(a.getAttribute('href')).toBe('/become-a-host'));
  });

  it("shows Setmore's paidFrom and Pro's monthly price in the table", () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(table.textContent).toContain(S.paidFrom);
    expect(table.textContent).toContain(`₹${PREMIUM_PLAN.monthly}`);
    expect(table.querySelector('caption')).toBeTruthy();
  });

  it('renders one <details> per FAQ entry, each answer 40-80 words', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('#faq details')).toHaveLength(FAQ.length);
    FAQ.forEach((f) => {
      expect(words(f.a)).toBeGreaterThanOrEqual(40);
      expect(words(f.a)).toBeLessThanOrEqual(80);
    });
  });

  it('keeps the short answer short: a one-line verdict + 3 reasons per side', () => {
    const { container } = renderPage();
    const p = container.querySelector('#short-answer p');
    expect(words(p.textContent)).toBeLessThanOrEqual(35);
    container.querySelectorAll('#short-answer ul').forEach((ul) => expect(ul.querySelectorAll('li')).toHaveLength(3));
  });

  it('shows the trademark / not-affiliated line and the source link', () => {
    renderPage();
    expect(screen.getByText(/isn.t affiliated with Setmore/i)).toBeTruthy();
    const src = screen.getByRole('link', { name: /setmore.s pricing page/i });
    expect(src.getAttribute('href')).toBe(S.source);
    expect(src.getAttribute('rel')).toContain('nofollow');
  });

  it('starts the payment picker on UPI and switches honestly to Setmore for international cards', () => {
    renderPage();
    const picker = screen.getByRole('group', { name: /how do your clients pay/i });
    const shown = () => picker.querySelector('[aria-live] > [aria-hidden="false"]').textContent;
    expect(within(picker).getByRole('radio', { name: /^upi$/i }).checked).toBe(true);
    expect(shown()).toContain('Meeticulous fits');
    fireEvent.click(within(picker).getByRole('radio', { name: /international card/i }));
    expect(shown()).toContain('Setmore works fine');
  });
});
