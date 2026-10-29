import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsFeature from '../features/AnalyticsFeature';

describe('Analytics feature page', () => {
  const renderPage = () => render(<MemoryRouter><AnalyticsFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /see what it answers/i }).getAttribute('href')).toBe('#questions');
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/be-a-sloth');
  });

  it('labels the hero demo as sample data and switches tabs', () => {
    renderPage();
    expect(screen.getByText('Sample data')).toBeTruthy();
    expect(screen.getByText('Net earnings by month')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /clients/i }));
    expect(screen.getByText('Top clients by total spent')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /clients/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('highlights the metric that answers the picked question', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /which regulars have gone quiet/i }));
    expect(container.querySelector('[data-metric="lapsed"]').getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-metric="byService"]').getAttribute('data-active')).toBe('false');
    expect(screen.getByText(/Where: Customers · Lapsed/)).toBeTruthy();
  });
});
