jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { cleanBackgroundKey } = require('../controllers/hostController');
describe('cleanBackgroundKey', () => {
  it('nulls everything (no backgrounds registered)', () => {
    expect(cleanBackgroundKey('lines')).toBeNull();
    expect(cleanBackgroundKey('dotgrid')).toBeNull();
    expect(cleanBackgroundKey('')).toBeNull();
    expect(cleanBackgroundKey(undefined)).toBeNull();
  });
});
