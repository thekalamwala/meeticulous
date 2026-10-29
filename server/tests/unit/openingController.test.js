// Window gate is the real enforcement for POST /open (client countdown is
// cosmetic). This locks the pending/open/closed boundaries so a bad edit can't
// silently open the doors early or keep them open forever.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { _windowState } = require('../../controllers/openingController');

const opensAt = new Date('2026-08-15T02:30:00Z'); // 08:00 IST
const closesAt = new Date('2026-08-16T02:30:00Z');
const win = { opensAt, closesAt };

describe('opening window state', () => {
  it('is pending before opens_at', () => {
    expect(_windowState(win, new Date('2026-08-15T02:29:00Z'))).toBe('pending');
  });
  it('is open at opens_at (inclusive)', () => {
    expect(_windowState(win, opensAt)).toBe('open');
  });
  it('is open during the window', () => {
    expect(_windowState(win, new Date('2026-08-15T18:00:00Z'))).toBe('open');
  });
  it('is closed at closes_at (exclusive)', () => {
    expect(_windowState(win, closesAt)).toBe('closed');
  });
  it('is closed when the window is unset (fails safe in prod)', () => {
    expect(_windowState({ opensAt: null, closesAt: null }, opensAt)).toBe('closed');
  });
});
