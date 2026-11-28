import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EarningsCalculator from '../pages/EarningsCalculator';

const setup = () => render(<EarningsCalculator />, { wrapper: MemoryRouter });

describe('EarningsCalculator', () => {
  it('shows the estimated earnings for the winning plan on mount', () => {
    setup();
    expect(screen.getByText(/your estimated earnings/i)).toBeTruthy();
    // default ₹5,000 × 12/mo → the 9% commission dwarfs the annual fee
    expect(screen.getByText(/with pro, you keep/i)).toBeTruthy();
    expect(screen.getAllByText(/per year/i).length).toBeGreaterThan(0);
  });

  it('shows how much more the winner keeps than the free plan', () => {
    setup();
    expect(screen.getByText(/more than the free plan/i)).toBeTruthy();
  });

  it('renders both plans with take-home + CTAs', () => {
    setup();
    expect(screen.getAllByText(/you keep per year/i).length).toBe(2);
    expect(screen.getByRole('link', { name: /get started/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /start on pro/i }).length).toBeGreaterThan(0);
  });

  it('billing toggle switches to monthly', () => {
    setup();
    const monthly = screen.getAllByRole('button', { name: /^monthly$/i })[0];
    fireEvent.click(monthly);
    expect(monthly.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the sliders and numeric inputs in sync, with no quick-set buttons', () => {
    setup();
    const price = screen.getByRole('slider', { name: 'Set your price per session slider' });
    const sessions = screen.getByRole('slider', { name: 'Set your sessions per month slider' });

    fireEvent.change(price, { target: { value: '15000' } });
    fireEvent.change(sessions, { target: { value: '25' } });
    expect(price).toHaveAttribute('aria-valuetext', '₹15,000');
    expect(sessions).toHaveAttribute('aria-valuetext', '25');
    expect(screen.getByRole('spinbutton', { name: 'Set your price per session' }).value).toBe('15000');
    expect(screen.getByRole('spinbutton', { name: 'Set your sessions per month' }).value).toBe('25');

    expect(screen.queryByText(/quick set/i)).toBeNull();
    expect(screen.queryByRole('group', { name: /presets/i })).toBeNull();
  });

  // The honest answer at low volume is "stay free" — a calculator that always
  // recommends paying is a brochure, not a calculator.
  it('recommends the free plan at very low volume', () => {
    setup();
    const price = screen.getByLabelText('Set your price per session');
    const sessions = screen.getByLabelText('Set your sessions per month');
    fireEvent.change(price, { target: { value: '600' } });
    fireEvent.change(sessions, { target: { value: '1' } });
    expect(screen.getByText(/free plan keeps the most/i)).toBeTruthy();
    expect(screen.getByText(/with starter, you keep/i)).toBeTruthy();
  });

  // Pricing v2 (spec §4 item 11).
  it('shows the comparison bar for a platform charging 10% + transaction fee', () => {
    setup();
    expect(screen.getByText('Typical platform')).toBeTruthy();
    expect(screen.getByText(/third bar: a platform charging 10% \+ transaction fee/i)).toBeTruthy();
  });

  it('product, course & membership sales can tip the answer to Pro', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Set your price per session'), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText('Set your sessions per month'), { target: { value: '1' } });
    expect(screen.getByText(/with starter, you keep/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Monthly product, course & membership sales'), { target: { value: '20000' } });
    expect(screen.getByText(/with pro, you keep/i)).toBeTruthy();
  });

  it('shows Pro prices GST-inclusive, never the ex-GST base', () => {
    setup();
    expect(screen.getByText(/₹1,199\/yr \(₹99\/mo\), GST included/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/1,016|168\.64/);
  });
});
