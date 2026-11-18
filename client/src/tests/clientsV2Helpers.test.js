import { describe, it, expect } from 'vitest';
import { initialsOf, lastSeen, waLink } from '../pages/ClientsV2';

describe('ClientsV2 helpers', () => {
  it('initialsOf takes up to two initials, uppercased, with a fallback', () => {
    expect(initialsOf('Ananya Rao')).toBe('AR');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('a b c d')).toBe('AB');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });

  it('lastSeen renders relative days with today/em-dash edges', () => {
    expect(lastSeen(null)).toBe('—');
    expect(lastSeen(new Date().toISOString())).toBe('today');
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(lastSeen(threeDaysAgo)).toBe('3d ago');
  });

  it('waLink strips non-digits and is null without a number', () => {
    expect(waLink('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(waLink('')).toBe(null);
    expect(waLink(null)).toBe(null);
  });
});
