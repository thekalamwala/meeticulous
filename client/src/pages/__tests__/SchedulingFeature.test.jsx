import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SchedulingFeature, { slotStarts } from '../features/SchedulingFeature';

describe('slotStarts', () => {
  // Same loop as server/services/availabilityService.js: step = duration + buffer.
  it('steps by duration plus buffer and keeps only slots that fit', () => {
    expect(slotStarts(600, 780, 30, 0)).toHaveLength(6);
    expect(slotStarts(600, 780, 30, 15)).toEqual([600, 645, 690, 735]);
    expect(slotStarts(600, 780, 60, 15)).toEqual([600, 675]);
  });
});

describe('Scheduling feature page', () => {
  const renderPage = () => render(<MemoryRouter><SchedulingFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/become-a-host');
    expect(screen.getByRole('link', { name: /see a live booking page/i }).getAttribute('href')).toBe('/contact');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
  });

  it('confirms a booking when a free slot is picked, and booked slots are disabled', async () => {
    renderPage();
    expect(screen.getByRole('button', { name: '2:00 PM, booked' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '11:30 AM' }));
    expect(await screen.findByText('Booking confirmed')).toBeTruthy();
    expect(screen.getByText('11:30 AM (IST)')).toBeTruthy();
  });

  it('recounts slots when session length and buffer change', () => {
    renderPage();
    fireEvent.click(within(screen.getByRole('group', { name: 'Session length' })).getByRole('button', { name: '60 min' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Buffer after each booking' })).getByRole('button', { name: '15 min' }));
    expect(screen.getByText('2 slots this morning')).toBeTruthy();
  });
});
