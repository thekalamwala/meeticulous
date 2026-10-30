import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsFeature from '../features/NotificationsFeature';

describe('Notifications feature page', () => {
  const renderPage = () => render(<MemoryRouter><NotificationsFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /see what fires on each plan/i }).getAttribute('href')).toBe('#plans');
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/become-a-host');
  });

  it('hero demo reveals the message for the clicked time marker', () => {
    renderPage();
    expect(screen.queryByText(/starting in 1 hour/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /1 hour before/i }));
    expect(screen.getByText(/starting in 1 hour/i)).toBeTruthy();
  });

  it('plan toggle lights up the 1-hour reminder on Pro', () => {
    renderPage();
    expect(screen.getByTestId('flow-1h').getAttribute('data-on')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Pro' }));
    expect(screen.getByTestId('flow-1h').getAttribute('data-on')).toBe('true');
  });
});
