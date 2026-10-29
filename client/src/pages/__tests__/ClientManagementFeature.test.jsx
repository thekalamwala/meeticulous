import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientManagementFeature, { SAMPLE_CLIENTS, totalSpent, FREE_CRM_CLIENTS } from '../features/ClientManagementFeature';

describe('Client management feature page', () => {
  const renderPage = () => render(<MemoryRouter><ClientManagementFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/be-a-sloth');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /what is free, what is not/i }).getAttribute('href')).toBe('#plans');
  });

  it('opens the clicked client card in the hero demo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /kabir test/i }));
    await waitFor(() => expect(screen.getByTestId('demo-client-name').textContent).toBe('Kabir Test'));
    const kabir = SAMPLE_CLIENTS.find((c) => c.name === 'Kabir Test');
    expect(screen.getByText(`₹${totalSpent(kabir).toLocaleString('en-IN')}`)).toBeTruthy();
  });

  it('switches the plan comparison note', () => {
    renderPage();
    expect(screen.getByTestId('plan-lens-note').textContent).toMatch(new RegExp(`${FREE_CRM_CLIENTS} most recent`));
    fireEvent.click(screen.getByRole('button', { name: /sloth active/i }));
    expect(screen.getByTestId('plan-lens-note').textContent).toMatch(/every client/i);
  });
});
