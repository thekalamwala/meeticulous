import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GoogleCalendarFeature, { addToDay, DEMO_START, hourLabel } from '../features/GoogleCalendarFeature';

describe('addToDay', () => {
  it('fills the first free queued hour and never overwrites an event', () => {
    const r = addToDay(DEMO_START, 'google');
    expect(r.hour).toBe(13);
    expect(r.events[11]).toEqual(DEMO_START[11]);
    expect(r.events[13].kind).toBe('google');
  });

  it('returns null when every queued hour is taken', () => {
    const full = Object.fromEntries([10, 11, 12, 13, 14, 15, 16].map((h) => [h, { title: 'x', kind: 'google' }]));
    expect(addToDay(full, 'booking')).toBeNull();
  });

  it('formats hours', () => {
    expect(hourLabel(10)).toBe('10 AM');
    expect(hourLabel(12)).toBe('12 PM');
    expect(hourLabel(13)).toBe('1 PM');
  });
});

describe('Google Calendar feature page', () => {
  const renderPage = () => render(<MemoryRouter><GoogleCalendarFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /connect your calendar free/i })[0].getAttribute('href')).toBe('/be-a-sloth');
    expect(screen.getByRole('link', { name: /what syncs which way/i }).getAttribute('href')).toBe('#sync');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
  });

  it('blocks the matching slot when a meeting is added in Google', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add a meeting in google/i }));
    expect(screen.getByRole('status').textContent).toMatch(/1 PM is now unavailable/);
    expect(screen.getAllByText('Lunch with Ma').length).toBeGreaterThan(0);
  });

  it('puts a client booking on the Google side with a Meet link', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /client books on Meeticulous/i }));
    expect(screen.getByRole('status').textContent).toMatch(/Strategy session, Aarav booked 3 PM/);
  });
});
