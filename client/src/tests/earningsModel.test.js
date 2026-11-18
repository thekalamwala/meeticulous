import { describe, it, expect } from 'vitest';
import { periodStart, summarizeEarnings } from '../pages/money/earningsModel';

const svc = (title, price) => ({ services: { title, price } });

describe('summarizeEarnings', () => {
  it('counts only paid bookings; net uses vendor_amount, gross uses price', () => {
    const bookings = [
      { payment_status: 'paid', vendor_amount: 900, ...svc('Call', 1000) },
      { payment_status: 'paid', vendor_amount: 450, ...svc('Call', 500) },
      { payment_status: 'unpaid', vendor_amount: 999, ...svc('Call', 1000) }, // excluded
    ];
    const { paid, gross, net, byService } = summarizeEarnings(bookings, null);
    expect(paid).toHaveLength(2);
    expect(gross).toBe(1500);
    expect(net).toBe(1350);
    expect(byService).toEqual([{ label: 'Call', net: 1350, count: 2 }]);
  });

  it('falls back to price when vendor_amount is missing, and sorts services by net desc', () => {
    const bookings = [
      { payment_status: 'paid', ...svc('A', 200) },                     // no vendor_amount -> net 200
      { payment_status: 'paid', vendor_amount: 500, ...svc('B', 600) }, // net 500
    ];
    const { net, byService } = summarizeEarnings(bookings, null);
    expect(net).toBe(700);
    expect(byService.map((r) => r.label)).toEqual(['B', 'A']); // highest net first
  });

  it('period start filters out older bookings', () => {
    const now = new Date();
    const old = new Date(now); old.setDate(old.getDate() - 100);
    const recent = new Date(now); recent.setDate(recent.getDate() - 5);
    const bookings = [
      { payment_status: 'paid', scheduled_at: old.toISOString(), ...svc('X', 100) },
      { payment_status: 'paid', scheduled_at: recent.toISOString(), ...svc('X', 300) },
    ];
    const { gross } = summarizeEarnings(bookings, periodStart('30d'));
    expect(gross).toBe(300); // only the recent one
  });
});
