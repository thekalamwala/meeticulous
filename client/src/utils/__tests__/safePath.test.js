import { describe, it, expect } from 'vitest';
import { isInternalPath } from '../safePath';

describe('isInternalPath', () => {
  it('accepts ordinary app paths', () => {
    for (const p of ['/', '/user', '/dashboard/bookings?tab=past#top', '/jane/booking/intro-call']) {
      expect(isInternalPath(p)).toBe(true);
    }
  });

  it('rejects anything a browser would treat as another origin', () => {
    for (const p of ['', 'user', 'https://evil.com', '//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/a\\b', null, undefined]) {
      expect(isInternalPath(p)).toBe(false);
    }
  });
});
