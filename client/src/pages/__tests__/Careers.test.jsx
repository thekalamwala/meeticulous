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

  it('has the redesign sections: hero CTAs, fact strip, values; no perks or closing CTA', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: /see open roles/i })[0]).toHaveAttribute('href', '#open-roles');
    expect(screen.getByRole('link', { name: /meet the team/i })).toHaveAttribute('href', '/about#team');
    expect(screen.getByRole('region', { name: /working at meeticulous/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /why build with us/i })).toBeInTheDocument();
    // The "Work that fits your life" Perks section was removed (owner request).
    expect(screen.queryByRole('heading', { name: /work that fits your life/i })).toBeNull();
    // The closing "Don't see your role?" CTA band was removed (owner request).
    expect(screen.queryByRole('heading', { name: /don't see your role/i })).toBeNull();
  });

  it('lists each open role as a link to its detail page', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /digital marketeer/i });
    expect(link).toHaveAttribute('href', '/careers/digital-marketeer');
  });
});
