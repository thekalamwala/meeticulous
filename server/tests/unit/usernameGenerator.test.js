const {
  baseFromEmail, baseFromName, baseFor, generateUnique,
} = require('../../utils/usernameGenerator');
const { isReserved } = require('../../utils/reservedUsernames');

// Usernames are public URLs: readable, from the name, -2/-3 on a clash, never random.
const takenSet = (...taken) => jest.fn(async (slug) => taken.includes(slug));

describe('usernameGenerator', () => {
  it('derives the base from the NAME first', () => {
    expect(baseFor({ name: 'Mohini Daf', email: 'mohinidaf5@gmail.com' })).toBe('mohini-daf');
    expect(baseFromName('José  Álvarez')).toBe('jose-alvarez');
    expect(baseFromName('Dr. Asha R. Rao')).toBe('dr-asha-r-rao');
  });

  it('falls back to the email handle, then "user"', () => {
    expect(baseFor({ name: 'Guest', email: 'Priya.Sharma+work@gmail.com' })).toBe('priya-sharma');
    expect(baseFor({ name: '', email: 'rahul@gmail.com' })).toBe('rahul');
    expect(baseFor({ name: 'Al', email: 'ab@x.com' })).toBe('user'); // both too short
    expect(baseFor({})).toBe('user');
  });

  it('baseFromEmail strips junk, caps length, rejects reserved/short', () => {
    expect(baseFromEmail('a_b__c@x.com')).toBe('a-b-c');
    expect(baseFromEmail('ab@x.com')).toBeNull();
    expect(baseFromEmail('admin@x.com')).toBeNull();
    expect(baseFromEmail(undefined)).toBeNull();
    expect(baseFromEmail('---@x.com')).toBeNull();
    expect(baseFromEmail(`${'abcd'.repeat(10)}@x.com`)).toHaveLength(26);
  });

  it('a reserved or placeholder name never becomes the base', () => {
    expect(baseFromName('Admin')).toBeNull();
    expect(baseFromName('Guest')).toBeNull();
    expect(baseFromName('someone@example.com')).toBeNull();
  });

  it('generateUnique returns the bare base when it is free', async () => {
    const existsFn = takenSet();
    const u = await generateUnique(existsFn, { name: 'Mohini Daf', email: 'mohinidaf5@gmail.com' });
    expect(u).toBe('mohini-daf');
    expect(existsFn).toHaveBeenCalledTimes(1);
    expect(isReserved(u)).toBe(false);
  });

  it('collisions take -2, -3 … (digits only, no random characters)', async () => {
    expect(await generateUnique(takenSet('mohini-daf'), { name: 'Mohini Daf' })).toBe('mohini-daf-2');
    expect(await generateUnique(takenSet('mohini-daf', 'mohini-daf-2'), { name: 'Mohini Daf' })).toBe('mohini-daf-3');
  });

  it('the no-name/no-email fallback starts at user-2', async () => {
    expect(await generateUnique(takenSet(), {})).toBe('user-2');
  });

  it('every candidate fits the 3–30 char username format', async () => {
    const u = await generateUnique(takenSet(), { name: 'A'.repeat(60) });
    expect(u.length).toBeLessThanOrEqual(30);
    expect(u).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
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
