/**
 * Unit tests for the server-side conversion fan-out (utils/trackServer).
 * Network paths are gated off under NODE_ENV=test, so these cover the pure
 * mapping/hashing logic + the guarantee that PostHog capture always runs.
 */
const crypto = require('crypto');

// Mock PostHog so we can assert trackServer forwards to it unchanged.
jest.mock('../../utils/posthog', () => ({ capture: jest.fn() }));
const { capture: phCapture } = require('../../utils/posthog');
const { trackServer, CONVERSIONS, _internal } = require('../../utils/trackServer');

beforeEach(() => jest.clearAllMocks());

describe('trackServer → PostHog forwarding', () => {
  test('always forwards distinctId/event/properties to PostHog capture', () => {
    trackServer('user-1', 'booking_paid', { booking_id: 'b1' }, { value: 500 });
    expect(phCapture).toHaveBeenCalledWith('user-1', 'booking_paid', { booking_id: 'b1' });
  });

  test('forwards non-conversion events to PostHog too', () => {
    trackServer('user-1', 'host_profile_viewed', { slug: 'x' });
    expect(phCapture).toHaveBeenCalledWith('user-1', 'host_profile_viewed', { slug: 'x' });
  });

  test('never throws on missing args', () => {
    expect(() => trackServer()).not.toThrow();
  });
});

describe('CONVERSIONS map', () => {
  test('covers every money/acquisition event with ga4 + meta names', () => {
    for (const key of ['booking_paid', 'product_purchased', 'subscription_purchased',
                       'subscription_renewed', 'booking_created', 'user_registered']) {
      expect(CONVERSIONS[key]).toEqual({ ga4: expect.any(String), meta: expect.any(String) });
    }
  });
  test('lead_captured maps to Meta Lead / GA4 generate_lead', () => {
    expect(CONVERSIONS.lead_captured).toEqual({ ga4: 'generate_lead', meta: 'Lead' });
  });
});

describe('metaMatchFromReq (Meta EMQ match keys)', () => {
  test('pulls fbp/fbc/user-agent/ip from a browser request', () => {
    const req = {
      headers: { cookie: '_fbp=fb.1.111.222; _fbc=fb.1.333.abc', 'user-agent': 'UA/1' },
      query: {}, body: {}, ip: '1.2.3.4',
    };
    const m = _internal.metaMatchFromReq(req);
    expect(m.fbp).toBe('fb.1.111.222');
    expect(m.fbc).toBe('fb.1.333.abc');
    expect(m.userAgent).toBe('UA/1');
    expect(m.ip).toBe('1.2.3.4');
  });
  test('reconstructs fbc from fbclid when the _fbc cookie is absent', () => {
    const m = _internal.metaMatchFromReq({ headers: {}, query: { fbclid: 'XYZ' }, body: {} });
    expect(m.fbc).toMatch(/^fb\.1\.\d+\.XYZ$/);
  });
  test('returns {} when no request is supplied (webhook/reconciler paths)', () => {
    expect(_internal.metaMatchFromReq(undefined)).toEqual({});
  });
});

describe('sha256 (Meta CAPI user_data normalization)', () => {
  test('lowercases + trims + sha256-hex hashes', () => {
    const expected = crypto.createHash('sha256').update('jane@x.com').digest('hex');
    expect(_internal.sha256('  Jane@X.com ')).toBe(expected);
  });
  test('returns undefined for empty input', () => {
    expect(_internal.sha256('')).toBeUndefined();
    expect(_internal.sha256(undefined)).toBeUndefined();
  });
});

describe('normPhone (Meta phone format)', () => {
  test('strips punctuation and prefixes country code for bare 10-digit', () => {
    expect(_internal.normPhone('98765 43210')).toBe('919876543210');
    expect(_internal.normPhone('9876543210')).toBe('919876543210');
  });
  test('keeps an existing country code', () => {
    expect(_internal.normPhone('+91 98765-43210')).toBe('919876543210');
  });
  test('drops a leading 0 and prefixes 91', () => {
    expect(_internal.normPhone('09876543210')).toBe('919876543210');
  });
});

describe('buildCrmLeadPayload (Meta CRM Lead offline event)', () => {
  test('produces the documented CRM Lead shape with hashed em/ph and raw lead_id', () => {
    const p = _internal.buildCrmLeadPayload({
      email: 'Jane@X.com', phone: '+91 98765 43210', leadId: 1234567890123456,
      eventId: 'crm_lead_42', ts: 1673035686,
    });
    const ev = p.data[0];
    expect(ev.action_source).toBe('system_generated');
    expect(ev.event_name).toBe('Lead');
    expect(ev.event_time).toBe(1673035686);
    expect(ev.custom_data).toEqual({ event_source: 'crm', lead_event_source: 'Book A Sloth' });
    expect(ev.event_id).toBe('crm_lead_42');
    expect(ev.user_data.em).toEqual([_internal.sha256('jane@x.com')]);
    expect(ev.user_data.ph).toEqual([_internal.sha256('919876543210')]);
    expect(ev.user_data.lead_id).toBe(1234567890123456);       // raw integer, NOT hashed
  });
  test('omits lead_id and unmatched keys when absent', () => {
    const ud = _internal.buildCrmLeadPayload({ email: 'a@b.com' }).data[0].user_data;
    expect(ud.em).toHaveLength(1);
    expect(ud.ph).toBeUndefined();
    expect(ud.lead_id).toBeUndefined();
  });
});

describe('ga4ClientId', () => {
  test('uses the browser _ga client_id when provided', () => {
    expect(_internal.ga4ClientId('user-1', 'GA1.1.123.456')).toBe('GA1.1.123.456');
  });
  test('synthesizes a stable id from distinctId when absent', () => {
    const a = _internal.ga4ClientId('user-1');
    const b = _internal.ga4ClientId('user-1');
    expect(a).toBe(b);                       // deterministic
    expect(a).toMatch(/^\d+\.\d+$/);         // GA client_id shape
  });
});
