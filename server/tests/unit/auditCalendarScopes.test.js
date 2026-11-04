// Smoke test for the one-off audit script (never touches a real DB or Google).
jest.mock('dotenv', () => ({ config: jest.fn() }));
const mockGetTokenInfo = jest.fn();
const mockGetAccessToken = jest.fn();
jest.mock('googleapis', () => ({
  google: { auth: { OAuth2: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(), getAccessToken: mockGetAccessToken, getTokenInfo: mockGetTokenInfo,
  })) } },
}));
jest.mock('../../utils/profileSecrets', () => ({ getGoogleTokens: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));
jest.mock('../../config/supabase', () => {
  const state = { hosts: [], selects: [] };
  // Read chain ends at the 2nd .order(); the update chain is awaited after the 2nd .eq().
  const from = jest.fn(() => {
    const c = { orders: 0, eqs: 0 };
    c.select = jest.fn((cols) => { state.selects.push(cols); return c; });
    c.order = jest.fn(() => (++c.orders === 2 ? Promise.resolve({ data: state.hosts, error: null }) : c));
    c.update = jest.fn(() => c);
    c.eq = jest.fn(() => (c.update.mock.calls.length && ++c.eqs === 2 ? Promise.resolve({ error: null }) : c));
    return c;
  });
  return { __state: state, supabaseAdmin: { from } };
});

const supa = require('../../config/supabase');
const { getGoogleTokens } = require('../../utils/profileSecrets');
const { main, auditHost, classifyError } = require('../../scripts/auditCalendarScopes');

const updaters = () =>
  supa.supabaseAdmin.from.mock.results.map((r) => r.value).filter((c) => c.update.mock.calls.length);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  supa.__state.hosts = [{ id: 'h1', email: 'a@x.com' }];
  supa.__state.selects.length = 0;
  getGoogleTokens.mockResolvedValue({ google_refresh_token: 'rt' });
  mockGetAccessToken.mockResolvedValue({ token: 'at' });
});
afterEach(() => console.log.mockRestore());

test('selects only id, email and reads tokens via getGoogleTokens (dry run writes nothing)', async () => {
  mockGetTokenInfo.mockResolvedValue({ scopes: ['https://www.googleapis.com/auth/calendar.events'] });
  await main(['node', 'x']);
  expect(supa.__state.selects).toEqual(['id, email']);
  expect(getGoogleTokens).toHaveBeenCalledWith('h1');
  expect(updaters()).toHaveLength(0);
});

test('invalid_grant is token_error; ECONNRESET / 503 are transient_error', async () => {
  mockGetAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));
  expect((await auditHost({ id: 'h1' })).status).toBe('token_error');
  mockGetAccessToken.mockRejectedValueOnce(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));
  expect(await auditHost({ id: 'h1' })).toEqual({ status: 'transient_error', reason: 'ECONNRESET' });
  expect(classifyError(new Error('Request failed with status code 503'))).toBe('transient_error');
});

test('--apply never flips a transient_error host', async () => {
  mockGetAccessToken.mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
  await main(['node', 'x', '--apply']);
  expect(updaters()).toHaveLength(0);
});

test('--apply flips a token_error host, guarded by connected=true', async () => {
  mockGetAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));
  await main(['node', 'x', '--apply']);
  const [u] = updaters();
  expect(u.update.mock.calls[0][0]).toMatchObject({ google_calendar_connected: false, calendar_skipped: false });
  expect(u.eq).toHaveBeenCalledWith('google_calendar_connected', true);
});
