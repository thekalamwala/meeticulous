jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
const otp = require('../../utils/otpStore');

describe('otpStore.generate in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('returns fixed "000000" in load mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    expect(otp.generate()).toBe('000000');
  });

  test('returns a random 6-digit code when flag off', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    expect(otp.generate()).toMatch(/^\d{6}$/);
  });
});
