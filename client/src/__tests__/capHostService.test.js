import { describe, it, expect } from 'vitest';
import { capHostService } from '../../scripts/lib/capHostService.mjs';

const prof = ['/services/doctors', '/services/lawyers'];
const hs = ['/alice', '/alice/intro', '/bob', '/bob/call', '/carol'];

describe('capHostService', () => {
  it('keeps everything and drops nothing when under the cap', () => {
    const { routes, dropped } = capHostService(prof, hs, 1500);
    expect(dropped).toBe(0);
    expect(routes).toEqual([...prof, ...hs]);
  });

  it('caps host/service to the first N (priority order) but never professions', () => {
    const { routes, dropped } = capHostService(prof, hs, 2);
    expect(dropped).toBe(3);
    // professions first and all present; only the first 2 host/service kept
    expect(routes).toEqual(['/services/doctors', '/services/lawyers', '/alice', '/alice/intro']);
  });

  it('treats cap <= 0 as unlimited', () => {
    const { routes, dropped } = capHostService(prof, hs, 0);
    expect(dropped).toBe(0);
    expect(routes).toEqual([...prof, ...hs]);
  });
});
