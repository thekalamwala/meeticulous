jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} generateAuthUrl() { return ''; } async getToken() { return { tokens: {} }; } } },
    calendar: () => ({}), // no freebusy/events → real paths throw against this mock
  },
}));
const googleCfg = require('../../config/google');

describe('google calendar stubs in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('createCalendarEvent is stubbed (no API) in load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const r = await googleCfg.createCalendarEvent('a', 'b', { title: 'T', startTime: 'x', endTime: 'y' });
    expect(r.eventId).toContain('loadtest');
    expect(r.meetLink).toContain('loadtest');
  });

  test('getFreeBusy is NOT stubbed — still attempts the real path', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    // mock calendar() returns {} → .freebusy is undefined → throws. Proves no short-circuit.
    await expect(googleCfg.getFreeBusy('a', 'b', 't1', 't2')).rejects.toBeDefined();
  });
});
