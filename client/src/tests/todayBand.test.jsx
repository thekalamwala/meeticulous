import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodayBand, focusBooking } from '../pages/TodayV2';

// The focal card picks one of three jobs from what's true right now.
const at = (mins) => new Date(Date.now() + mins * 60_000).toISOString();
const bk = (mins, extra = {}) => ({ id: `b${mins}`, scheduled_at: at(mins), status: 'confirmed', guest_name: 'Aarav Shah', services: { title: 'Funnel Teardown', duration: 45 }, customer_total: 1499, payment_status: 'paid', ...extra });
const base = { isFree: true, proPlan: { monthly_price: 999 }, username: 'riya', views: 465, onOpen: vi.fn(), onCopy: vi.fn(), go: vi.fn() };

describe('focusBooking', () => {
  it('prefers the booking in progress, then the next one, ignoring cancelled', () => {
    expect(focusBooking([bk(60), bk(-10)]).phase).toBe('now');
    expect(focusBooking([bk(-120), bk(90), bk(30, { status: 'cancelled' })]).booking.id).toBe('b90');
    expect(focusBooking([bk(-120)])).toBeNull();
  });
});

describe('TodayBand', () => {
  it('shows the booking details when one is coming', () => {
    render(<TodayBand {...base} bookings={[bk(90, { meeting_link: 'https://meet.google.com/x' })]} />);
    expect(screen.getByText(/Aarav Shah/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /join call/i })).toBeTruthy();
    expect(screen.getByText(/₹1,499 · Paid/)).toBeTruthy();
  });

  it('shows the Pro ad with the GST-inclusive price when nothing is booked on a free plan', () => {
    render(<TodayBand {...base} bookings={[]} />);
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeTruthy();
    expect(screen.getByText(/₹1,179\/month · incl\. GST/)).toBeTruthy(); // 999 × 1.18
  });

  it('shows the share card when nothing is booked on Pro', () => {
    render(<TodayBand {...base} isFree={false} bookings={[]} />);
    expect(screen.getByRole('button', { name: /copy booking link/i })).toBeTruthy();
    expect(screen.getByText(/465 people have seen your page/)).toBeTruthy();
    expect(screen.queryByText(/upgrade to pro/i)).toBeNull();
  });
});
