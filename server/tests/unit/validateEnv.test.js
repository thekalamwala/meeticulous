const { validateEnv, CRITICAL, RECOMMENDED } = require('../../config/validateEnv');

// A full set of every critical var so the "happy path" has nothing missing.
const fullCritical = () =>
  CRITICAL.reduce((acc, [name]) => { acc[name] = 'x'; return acc; }, {});

describe('validateEnv', () => {
  const OLD = process.env;
  let warnSpy;

  beforeEach(() => {
    process.env = { ...OLD };
    // Wipe every var the validator inspects so each test starts from a known
    // empty baseline, then opt in to what it needs.
    [...CRITICAL, ...RECOMMENDED].forEach(([name]) => { delete process.env[name]; });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });
  afterAll(() => { process.env = OLD; });

  test('reports all critical vars missing when env is empty', () => {
    process.env.NODE_ENV = 'development';
    const { missingCritical } = validateEnv();
    expect(missingCritical).toEqual(CRITICAL.map(([n]) => n));
  });

  test('throws in production when a critical var is missing', () => {
    process.env.NODE_ENV = 'production';
    Object.assign(process.env, fullCritical());
    delete process.env.OAUTH_STATE_SECRET;
    expect(() => validateEnv()).toThrow(/OAUTH_STATE_SECRET/);
  });

  test('does NOT throw in dev even with critical vars missing (warns instead)', () => {
    process.env.NODE_ENV = 'development';
    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('treats empty-string and whitespace as missing', () => {
    process.env.NODE_ENV = 'development';
    Object.assign(process.env, fullCritical());
    process.env.CLIENT_URL = '   ';
    const { missingCritical } = validateEnv();
    expect(missingCritical).toContain('CLIENT_URL');
  });

  test('clean env: no critical missing, does not throw even in production', () => {
    process.env.NODE_ENV = 'production';
    Object.assign(process.env, fullCritical(), RECOMMENDED.reduce((a, [n]) => { a[n] = 'x'; return a; }, {}));
    let result;
    expect(() => { result = validateEnv(); }).not.toThrow();
    expect(result.missingCritical).toEqual([]);
    expect(result.missingRecommended).toEqual([]);
  });

  test('exitOnFail override forces throw even in non-prod', () => {
    process.env.NODE_ENV = 'test';
    expect(() => validateEnv({ exitOnFail: true })).toThrow(/CRITICAL/);
  });
});
