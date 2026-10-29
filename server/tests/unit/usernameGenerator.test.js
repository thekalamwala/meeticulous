const {
  generateCandidate, generateUnique, randomSuffix,
} = require('../../utils/usernameGenerator');
const { isReserved } = require('../../utils/reservedUsernames');

describe('usernameGenerator', () => {
  it('produces {adjective}-{noun}-{suffix}, all lowercase', () => {
    for (let i = 0; i < 50; i++) {
      const u = generateCandidate();
      expect(u).toBe(u.toLowerCase());
      expect(u).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]+$/);
      expect(u.split('-').length).toBe(3);
    }
  });

  it('randomSuffix is lowercase base36 of the requested length', () => {
    const s = randomSuffix(5);
    expect(s).toHaveLength(5);
    expect(s).toMatch(/^[a-z0-9]+$/);
  });

  it('generateUnique returns the first candidate not already used', async () => {
    const existsFn = jest.fn().mockResolvedValue(false);
    const u = await generateUnique(existsFn);
    expect(existsFn).toHaveBeenCalledTimes(1);
    expect(u).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]+$/);
    expect(isReserved(u)).toBe(false);
  });

  it('generateUnique retries past taken candidates', async () => {
    const existsFn = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const u = await generateUnique(existsFn);
    expect(existsFn).toHaveBeenCalledTimes(3);
    expect(u).toBeTruthy();
  });
});

describe('reservedUsernames', () => {
  it('flags route names case-insensitively', () => {
    expect(isReserved('login')).toBe(true);
    expect(isReserved('Dashboard')).toBe(true);
    expect(isReserved('admin')).toBe(true);
    expect(isReserved('api')).toBe(true);
    expect(isReserved('u')).toBe(true);
  });
  it('allows ordinary generated handles', () => {
    expect(isReserved('slow-bolt-nigr0')).toBe(false);
    expect(isReserved('black-panther-x4k9')).toBe(false);
  });
  it('treats empty/nullish as reserved (defensive)', () => {
    expect(isReserved('')).toBe(true);
    expect(isReserved(null)).toBe(true);
  });
});
