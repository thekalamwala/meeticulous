import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import BookingDemo from '../BookingDemo';
import { FALLBACK_HOST } from '../demoData';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const apiSpy = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api', () => new Proxy({}, { get: () => apiSpy }));

describe('BookingDemo (pure simulation)', () => {
  // genSlots() returns no slots for a day whose open times have all passed (e.g.
  // today, run in the evening), so the FIRST selectable day isn't guaranteed to
  // have slots. Click enabled days (advancing a month if needed) until one does.
  const pickDayWithSlots = () => {
    for (let month = 0; month < 2; month++) {
      const days = screen.getAllByRole('button', { name: /^day-/ }).filter((b) => !b.disabled);
      for (const d of days) {
        fireEvent.click(d);
        const slots = screen.queryAllByRole('button', { name: /^slot-/ });
        if (slots.length) return slots[0];
      }
      fireEvent.click(screen.getByRole('button', { name: 'next-month' }));
    }
    return null;
  };

  it('advances service → date → time → confirmed and calls no API', () => {
    render(<BookingDemo host={FALLBACK_HOST} />);
    // pick first service
    fireEvent.click(screen.getByRole('button', { name: /Discovery Call/i }));
    // pick a day that actually has open slots, then its first slot
    const slot = pickDayWithSlots();
    expect(slot).toBeTruthy();
    fireEvent.click(slot);
    // confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));
    expect(screen.getByText(/You're booked/i)).toBeTruthy();
    expect(apiSpy).not.toHaveBeenCalled();
  });
});
