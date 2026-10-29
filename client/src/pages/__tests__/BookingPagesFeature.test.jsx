import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPagesFeature, { toLinkSlug } from '../features/BookingPagesFeature';

describe('toLinkSlug', () => {
  // Mirrors server/utils/slugFormat: [a-z0-9] with single hyphens, max 30.
  it('folds a typed name into a username', () => {
    expect(toLinkSlug('Priya Nair')).toBe('priya-nair');
    expect(toLinkSlug('  Dr. A_B  ')).toBe('dr-a-b');
    expect(toLinkSlug('Café!!  Studio')).toBe('caf-studio');
    expect(toLinkSlug('a'.repeat(40))).toHaveLength(30);
  });
});

describe('Booking pages feature page', () => {
  const renderPage = () => render(<MemoryRouter><BookingPagesFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /see a live booking page/i }).getAttribute('href')).toBe('/demo');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getAllByRole('link', { name: /claim your free link/i })[0].getAttribute('href')).toBe('/become-a-host');
  });

  it('opens a service in the phone demo when tapped', () => {
    renderPage();
    const audit = screen.getByRole('button', { name: /brand audit/i });
    fireEvent.click(audit);
    expect(audit.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/walk you through what to fix first/i)).toBeTruthy();
  });

  it('previews the typed name as a link', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/type your name/i), { target: { value: 'Ravi Studio' } });
    expect(screen.getByTestId('bp-link').textContent).toBe('meeticulous.com/ravi-studio');
  });
});
