import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpenRoles from '../OpenRoles';


describe('Open role cards', () => {
  it('shows role details and an apply action linked to the actual role', () => {
    render(<MemoryRouter><OpenRoles /></MemoryRouter>);
    const card = screen.getByRole('article', { name: 'Digital Marketeer' });
    expect(within(card).getByRole('link', { name: 'Apply now' }).getAttribute('href')).toBe('/careers/digital-marketeer');
    expect(within(card).getByText('₹6–9 LPA')).toBeTruthy();
    expect(within(card).getByText('Full-time')).toBeTruthy();
  });

  it('omits company dates and save controls', () => {
    render(<MemoryRouter><OpenRoles /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByText('Meeticulous')).toBeNull();
    expect(document.querySelector('#open-roles time')).toBeNull();
  });
});
