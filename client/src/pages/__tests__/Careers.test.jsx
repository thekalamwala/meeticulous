import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Careers from '../Careers';

const renderPage = () =>
  render(
    <MemoryRouter>
      <Careers />
    </MemoryRouter>
  );

describe('Careers page', () => {
  it('renders the hero + open-roles heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /build the calm way to get booked/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /open roles/i })).toBeInTheDocument();
  });

  it('lists each open role as a link to its detail page', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /digital marketeer/i });
    expect(link).toHaveAttribute('href', '/careers/digital-marketeer');
  });
});
