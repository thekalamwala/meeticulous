import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsFeature, { SAMPLE_REVIEWS } from '../features/ReviewsFeature';

describe('Reviews feature page', () => {
  const renderPage = () => render(<MemoryRouter><ReviewsFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /how reviews get verified/i }).getAttribute('href')).toBe('#verified');
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/be-a-sloth');
  });

  it('updates the sample review when a star is tapped', async () => {
    renderPage();
    expect(screen.getByText(SAMPLE_REVIEWS[5])).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rate 2 stars' }));
    expect(await screen.findByText(SAMPLE_REVIEWS[2])).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rate 2 stars' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the verification stage on click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /completed/i }));
    expect(screen.getByText(/anyone you mark as a no-show/i)).toBeTruthy();
  });
});
