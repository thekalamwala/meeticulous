const {
  baseFromEmail, generateCandidate, generateUnique, randomSuffix,
} = require('../../utils/usernameGenerator');
const { isReserved } = require('../../utils/reservedUsernames');

describe('usernameGenerator', () => {
  it('uses the email handle + 4 random base36 chars', () => {
    for (let i = 0; i < 50; i++) {
      const u = generateCandidate('Priya.Sharma+work@gmail.com');
      expect(u).toMatch(/^priya-sharma-[a-z0-9]{4}$/);
    }
  });

  it('two people with the same handle get different usernames', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(generateCandidate('priya@gmail.com'));
    expect(seen.size).toBeGreaterThan(45);
  });

  it('baseFromEmail strips junk, caps length, falls back to "user"', () => {
    expect(baseFromEmail('a_b__c@x.com')).toBe('a-b-c');
    expect(baseFromEmail('ab@x.com')).toBe('user');          // too short
    expect(baseFromEmail('admin@x.com')).toBe('user');       // reserved
    expect(baseFromEmail(undefined)).toBe('user');           // phone-only / no email
    expect(baseFromEmail('---@x.com')).toBe('user');
    expect(baseFromEmail(`${'abcd'.repeat(10)}@x.com`)).toHaveLength(25);
    expect(generateCandidate(`${'abcd'.repeat(10)}@x.com`).length).toBeLessThanOrEqual(30);
  });

  it('randomSuffix is lowercase base36 of the requested length', () => {
    const s = randomSuffix(4);
    expect(s).toHaveLength(4);
    expect(s).toMatch(/^[a-z0-9]+$/);
  });

  it('generateUnique returns the first candidate not already used', async () => {
    const existsFn = jest.fn().mockResolvedValue(false);
    const u = await generateUnique(existsFn, 'rahul@gmail.com');
    expect(existsFn).toHaveBeenCalledTimes(1);
    expect(u).toMatch(/^rahul-[a-z0-9]{4}$/);
    expect(isReserved(u)).toBe(false);
  });

  it('generateUnique retries past taken candidates', async () => {
    const existsFn = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const u = await generateUnique(existsFn, 'rahul@gmail.com');
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
    expect(isReserved('priya-sharma-x4k9')).toBe(false);
    expect(isReserved('black-panther-x4k9')).toBe(false);
  });
  it('treats empty/nullish as reserved (defensive)', () => {
    expect(isReserved('')).toBe(true);
    expect(isReserved(null)).toBe(true);
  });
});
