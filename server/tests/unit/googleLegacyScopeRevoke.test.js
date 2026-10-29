/**
 * Legacy Google scope retirement (unverified-app screen fix).
 *
 * 1. The consent URL must never carry include_granted_scopes=true — that is what
 *    re-attaches the removed full `auth/calendar` scope and triggers Google's
 *    "This app isn't verified" screen.
 * 2. revokeToken() must POST the token to Google's revoke endpoint and stay
 *    non-fatal (already-revoked → 400 is success; network error → false).
 */
process.env.GOOGLE_CLIENT_ID = 'cid';
process.env.GOOGLE_CLIENT_SECRET = 'secret';
process.env.GOOGLE_REDIRECT_URI = 'https://example.test/cb';

const { getAuthUrl, revokeToken } = require('../../config/google');

describe('getAuthUrl — scopes actually requested', () => {
  const url = new URL(getAuthUrl('state-token'));
  const scopes = (url.searchParams.get('scope') || '').split(' ');

  it('does not enable incremental authorization', () => {
    // Absent or "false" both work; "true" is the bug.
    expect(url.searchParams.get('include_granted_scopes')).not.toBe('true');
  });

  it('never requests the removed full calendar scope', () => {
    expect(scopes).not.toContain('https://www.googleapis.com/auth/calendar');
  });

  it('still requests the three granular calendar scopes', () => {
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.freebusy');
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.settings.readonly');
  });

  it('omits prompt by default (returning-host login skips the consent screen)', () => {
    expect(url.searchParams.get('prompt')).toBeNull();
  });

  it('forces consent when requested (signup / calendar reconnect → fresh refresh token)', () => {
    const consentUrl = new URL(getAuthUrl('state-token', { prompt: 'consent' }));
    expect(consentUrl.searchParams.get('prompt')).toBe('consent');
  });
});

describe('revokeToken', () => {
  afterEach(() => { delete global.fetch; });

  it('posts the token to Google and reports success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await expect(revokeToken('old-refresh')).resolves.toBe(true);
    const [endpoint, opts] = global.fetch.mock.calls[0];
    expect(endpoint).toBe('https://oauth2.googleapis.com/revoke');
    expect(opts.body).toBe('token=old-refresh');
  });

  it('treats an already-revoked token (400) as success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    await expect(revokeToken('stale')).resolves.toBe(true);
  });

  it('never throws when Google is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(revokeToken('x')).resolves.toBe(false);
  });

  it('no-ops on a missing token', async () => {
    global.fetch = jest.fn();
    await expect(revokeToken(null)).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
