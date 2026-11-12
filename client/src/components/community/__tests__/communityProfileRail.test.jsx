import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const getMyCard = vi.fn();
vi.mock('../../../services/communityApi', () => ({ getMyCard: (...a) => getMyCard(...a) }));

import CommunityProfileRail from '../CommunityProfileRail';

const wrap = (user) => render(<MemoryRouter><CommunityProfileRail user={user} /></MemoryRouter>);

beforeEach(() => { getMyCard.mockReset(); });

describe('CommunityProfileRail', () => {
  it('host card shows bookings / rating / services and the workspace nav', async () => {
    getMyCard.mockResolvedValue({ is_host: true, verified: true, username: 'aastha', member_since: 2024, bookings: 328, rating: 4.9, reviews: 42, services: 6 });
    wrap({ name: 'Aastha', is_host: true });

    expect(await screen.findByText('328')).toBeTruthy();       // bookings, once the card loads
    expect(screen.getByText('4.9★')).toBeTruthy();             // rating
    expect(screen.getByText('6')).toBeTruthy();                // services
    expect(screen.getByRole('link', { name: 'Bookings' }).getAttribute('href')).toBe('/dashboard/bookings');
    expect(screen.getByRole('link', { name: /share your booking link/i }).getAttribute('href')).toBe('/aastha');
  });

  it('a host with no reviews shows "New" rather than a lonely rating', async () => {
    getMyCard.mockResolvedValue({ is_host: true, bookings: 0, rating: null, reviews: 0, services: 1 });
    wrap({ name: 'Dev', is_host: true });
    expect(await screen.findByText('New')).toBeTruthy();
  });

  it('a guest card shows the welcome line and Become a host', async () => {
    getMyCard.mockResolvedValue({ is_host: false });
    wrap({ name: 'Riya' });
    expect(await screen.findByText(/become a host/i)).toBeTruthy();
    expect(screen.getByText(/introduce yourself/i)).toBeTruthy();
  });
});
