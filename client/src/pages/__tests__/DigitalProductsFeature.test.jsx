import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DigitalProductsFeature, { buyerTotal } from '../features/DigitalProductsFeature';

describe('buyerTotal', () => {
  it('adds the ₹10 fee + GST to paid products and nothing to free ones', () => {
    expect(buyerTotal(499)).toBe(510.8);
    expect(buyerTotal(0)).toBe(0);
  });
});

describe('Digital products feature page', () => {
  const renderPage = () => render(<MemoryRouter><DigitalProductsFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/become-a-host');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /product limits by plan/i }).getAttribute('href')).toBe('#plans');
  });

  it('opens checkout from the shelf, then shows the download-ready state', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /client onboarding template/i }));
    // AnimatePresence mode="wait" swaps panels after the exit animation.
    const buy = await screen.findByRole('button', { name: /buy for ₹310\.80/i }, { timeout: 3000 });
    fireEvent.click(buy);
    expect(await screen.findByText(/your download is ready/i, {}, { timeout: 3000 })).toBeTruthy();
  });

  it('plan counter shows waiting products on the free plan', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /more products/i }));
    expect(screen.getByText(/3 live, 3 waiting/i)).toBeTruthy();
  });
});
