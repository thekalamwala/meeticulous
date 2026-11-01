/**
 * tests/unit/communicationEngine.test.js
 * Engine queue/immediate/test/retry — mocked Supabase + provider.
 */
'use strict';

const db = {
  email_settings: { id: 1, provider: 'smtp', from_name: 'Meeticulous', support_email: 's@x.test', website_url: 'https://x.test', brand_color: '#FE5100' },
  email_templates: [
    { id: 't1', event_key: 'BOOKING_CONFIRMED_CUSTOMER', audience: 'all', status: 'active',
      subject: 'Confirmed: {{service_name}}', preview_text: 'hi', html_content: '<p>Hi {{first_name}}</p>', cta_label: '', cta_url: '' },
    { id: 't2', event_key: 'BOOKING_OTP', audience: 'all', status: 'active',
      subject: 'Code {{otp}}', preview_text: '', html_content: '<p>{{otp}}</p>', cta_label: '', cta_url: '' },
    { id: 't3', event_key: 'BADGE_UNLOCKED', audience: 'all', status: 'active',
      subject: 'Badge!', preview_text: '', html_content: '<p>nice</p>', cta_label: '', cta_url: '' },
  ],
  email_logs: [],
  email_unsubscribes: [], // list of opted-out emails
  notification_logs: [], // cross-channel summary rows (back-filled by the worker)
};

// jsonb path getter for the test mock: 'payload->>logId' → row.payload.logId
const getPath = (row, col) => {
  const m = /^([a-z_]+)->>([a-zA-Z]+)$/.exec(col);
  return m ? row[m[1]]?.[m[2]] : row[col];
};

let mockProviderState = { success: true };

jest.mock('../../config/supabase', () => {
  const make = (table) => {
    const filters = [];
    const api = {
      select() { return api; },
      eq(c, v) { filters.push(['eq', c, v]); return api; },
      lte(c, v) { filters.push(['lte', c, v]); return api; },
      order() { return api; },
      limit() { return api; },
      maybeSingle() {
        if (table === 'email_settings') return Promise.resolve({ data: db.email_settings, error: null });
        if (table === 'email_unsubscribes') {
          const f = filters.find((x) => x[0] === 'eq' && x[1] === 'email');
          const email = f && f[2];
          const hit = db.email_unsubscribes.includes(email);
          return Promise.resolve({ data: hit ? { email } : null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: null, error: null });
      },
      insert(row) {
        const store = db[table] || db.email_logs;
        const rows = [].concat(row).map((r, i) => ({ id: `log${store.length + i + 1}`, ...r }));
        store.push(...rows);
        return { select: () => ({ single: () => Promise.resolve({ data: { id: rows[0].id }, error: null }) }) };
      },
      update(changes) {
        // Chainable: collect eq/filter predicates, apply to the matching rows on
        // terminal await. Supports the worker's .update().eq().filter() back-fill.
        const preds = [];
        const store = db[table] || db.email_logs;
        const apply = () => {
          for (const r of store) if (preds.every(([c, v]) => getPath(r, c) === v)) Object.assign(r, changes);
          return { error: null };
        };
        const chain = {
          eq(c, v) { preds.push([c, v]); return chain; },
          filter(c, _op, v) { preds.push([c, v]); return chain; },
          then(resolve) { return resolve(apply()); },
        };
        return chain;
      },
      then(resolve) {
        // terminal: used for .select() list reads
        if (table === 'email_templates') return resolve({ data: db.email_templates, error: null });
        if (table === 'email_logs') {
          // queue read: status=queued and next_attempt_at<=now
          const due = db.email_logs.filter((r) => r.status === 'queued');
          return resolve({ data: due, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return api;
  };
  return { supabaseAdmin: { from: (t) => make(t) }, supabase: {} };
});

jest.mock('../../services/email/providers', () => ({
  getProvider: () => ({ name: 'smtp', sendEmail: async () => (mockProviderState.success ? { success: true, id: 'm1' } : { success: false, error: 'smtp down' }) }),
}));

jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));

const engine = require('../../services/email/communicationEngine');
const { adminAlert } = require('../../utils/adminAlert');

beforeEach(() => { db.email_logs = []; db.email_unsubscribes = []; db.notification_logs = []; mockProviderState = { success: true }; engine.clearCache(); adminAlert.mockClear(); });

describe('communicationEngine.send', () => {
  test('queues a normal email (status queued, not yet sent)', async () => {
    const r = await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'SEO' }, user: { name: 'Asha Verma' } });
    expect(r.status).toBe('queued');
    expect(db.email_logs).toHaveLength(1);
    expect(db.email_logs[0].status).toBe('queued');
    expect(db.email_logs[0].subject).toBe('Confirmed: SEO');
    expect(db.email_logs[0].html).toContain('Hi Asha');
  });

  test('OTP sends immediately (status sent)', async () => {
    const r = await engine.send({ event: 'BOOKING_OTP', to: 'a@x.test', immediate: true, data: { otp: '123456' } });
    expect(r.status).toBe('sent');
    expect(db.email_logs[0].status).toBe('sent');
    expect(db.email_logs[0].subject).toBe('Code 123456');
  });

  test('immediate send failure falls back to queued for retry', async () => {
    mockProviderState.success = false;
    const r = await engine.send({ event: 'BOOKING_OTP', to: 'a@x.test', immediate: true, data: { otp: '1' } });
    expect(r.status).toBe('queued');
    expect(db.email_logs[0].status).toBe('queued');
  });

  test('test send is marked TEST and delivered', async () => {
    const r = await engine.send({ event: 'BOOKING_OTP', to: 'a@x.test', isTest: true, data: { otp: '1' } });
    expect(r.status).toBe('test');
    expect(db.email_logs[0].is_test).toBe(true);
    expect(db.email_logs[0].status).toBe('test');
  });

  test('unknown event → no template, logs a no_template row + alerts (E4)', async () => {
    const r = await engine.send({ event: 'NOPE', to: 'a@x.test' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_template');
    // E4: was previously untraced — now a queryable row + one throttled alert.
    expect(db.email_logs).toHaveLength(1);
    expect(db.email_logs[0].status).toBe('no_template');
    expect(adminAlert).toHaveBeenCalledTimes(1);
    expect(adminAlert.mock.calls[0][0].key).toMatch(/^email_no_template:NOPE/);
  });

  test('unresolved placeholder → still queues but alerts (E1)', async () => {
    // BOOKING_CONFIRMED_CUSTOMER template needs {{service_name}}; omit it.
    const r = await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: {}, user: { name: 'Asha' } });
    expect(r.status).toBe('queued');            // content still ships (blank token)
    expect(adminAlert).toHaveBeenCalledTimes(1);
    const call = adminAlert.mock.calls[0][0];
    expect(call.key).toBe('email_missing:BOOKING_CONFIRMED_CUSTOMER:service_name');
    expect(call.lines.join(' ')).toContain('service_name');
  });

  test('fully-resolved placeholders → no missing alert', async () => {
    await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'SEO' }, user: { name: 'Asha' } });
    expect(adminAlert).not.toHaveBeenCalled();
  });
});

describe('communicationEngine — marketing unsubscribe', () => {
  test('marketing event to an opted-out address is suppressed (not queued)', async () => {
    db.email_unsubscribes = ['opted@x.test'];
    const r = await engine.send({ event: 'BADGE_UNLOCKED', to: 'opted@x.test', data: {}, user: {} });
    expect(r.status).toBe('suppressed');
    expect(db.email_logs[0].status).toBe('suppressed');
  });

  test('marketing event to a subscribed address still queues', async () => {
    const r = await engine.send({ event: 'BADGE_UNLOCKED', to: 'ok@x.test', data: {}, user: {} });
    expect(r.status).toBe('queued');
    expect(db.email_logs[0].status).toBe('queued');
  });

  test('transactional event to an opted-out address still sends (carve-out)', async () => {
    db.email_unsubscribes = ['opted@x.test'];
    const r = await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'opted@x.test', data: { service_name: 'X' }, user: {} });
    expect(r.status).toBe('queued');
    expect(db.email_logs[0].status).toBe('queued');
  });

  test('isMarketing flags lifecycle + campaigns, not transactional', () => {
    expect(engine.isMarketing('BADGE_UNLOCKED')).toBe(true);
    expect(engine.isMarketing('CAMPAIGN:abc')).toBe(true);
    expect(engine.isMarketing('BOOKING_CONFIRMED_CUSTOMER')).toBe(false);
    expect(engine.isMarketing('BOOKING_OTP')).toBe(false);
  });

  test('queued marketing email embeds an unsubscribe token in the customer footer', async () => {
    const r = await engine.send({ event: 'BADGE_UNLOCKED', to: 'ok@x.test', audience: 'customer', data: {}, user: {} });
    expect(r.status).toBe('queued');
    expect(db.email_logs[0].html).toMatch(/\/unsubscribe\?u=[\w.\-]+/);
  });
});

describe('communicationEngine.renderEmail — recipient-driven layout', () => {
  const settings = { brand_color: '#FE5100', website_url: 'https://x.test', support_email: 's@x.test', from_name: 'Meeticulous', logo_url: 'https://cdn.test/bas.png' };
  const template = { subject: 'Hi', html_content: '<p>body {{first_name}}</p>', cta_label: '', cta_url: '', email_category: 'Booking', preview_text: '' };

  test("audience 'vendor' → minimal Powered-by footer (constant logo header)", () => {
    const { html } = engine.renderEmail(template, {
      settings, audience: 'vendor', user: { name: 'Asha' },
      data: { company_logo: 'https://cdn.test/host.png', company_name: 'Asha Studio' },
    });
    expect(html).toContain('images/email/meeticulous-wordmark-full-color.png'); // constant logo, both audiences
    expect(html).toMatch(/Powered by/i);
    expect(html).not.toMatch(/My Bookings/i);
    expect(html).toContain('body Asha'); // same body resolves regardless of shell
  });

  test("audience 'customer'/'all' MARKETING event → customer shell with unsubscribe", () => {
    const mkt = { ...template, event_key: 'BADGE_UNLOCKED' }; // in MARKETING_EVENTS
    for (const audience of ['customer', 'all', undefined]) {
      const { html } = engine.renderEmail(mkt, { settings, audience, user: { name: 'Asha' }, data: {} });
      expect(html).toContain('images/email/meeticulous-wordmark-full-color.png'); // constant logo, both audiences
      expect(html).toMatch(/My Bookings/i);
      expect(html).toMatch(/Unsubscribe/i);
      expect(html).not.toMatch(/Powered by/i);
    }
  });

  test("TRANSACTIONAL event on customer shell → NO unsubscribe/nav (Primary-inbox)", () => {
    const txn = { ...template, event_key: 'BOOKING_CONFIRMED_CUSTOMER' }; // not marketing
    const { html } = engine.renderEmail(txn, { settings, audience: 'customer', user: { name: 'Asha' }, data: {} });
    expect(html).not.toMatch(/My Bookings/i);
    expect(html).not.toMatch(/Unsubscribe/i);
  });
});

describe('communicationEngine.processQueue — retry backoff', () => {
  test('successful send marks the row sent', async () => {
    await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'X' }, user: { name: 'A' } });
    const r = await engine.processQueue();
    expect(r.sent).toBe(1);
    expect(db.email_logs[0].status).toBe('sent');
  });

  test('back-fills the pending notification_logs row on delivery (matched by payload.logId)', async () => {
    const r0 = await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'X' }, user: { name: 'A' } });
    // notificationEngine writes this cross-channel summary row as 'pending' at enqueue.
    db.notification_logs.push({ channel: 'email', status: 'pending', payload: { logId: r0.logId } });
    await engine.processQueue();
    expect(db.notification_logs[0].status).toBe('sent');
  });

  test('back-fills notification_logs to failed after retries are exhausted', async () => {
    const r0 = await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'X' }, user: { name: 'A' } });
    db.notification_logs.push({ channel: 'email', status: 'pending', payload: { logId: r0.logId } });
    mockProviderState.success = false;
    for (let i = 0; i < 4; i++) await engine.processQueue(); // 3 retries then permanent fail
    expect(db.email_logs[0].status).toBe('failed');
    expect(db.notification_logs[0].status).toBe('failed');
  });

  test('failures retry 3 times (5m/30m/2h) then fail permanently', async () => {
    // Provide all tokens so the E1 "missing placeholder" alert doesn't fire —
    // this test isolates the E2 permanent-failure alert.
    await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'X' }, user: { name: 'A' } });
    mockProviderState.success = false;

    // try #1 → attempts 1, requeued
    let r = await engine.processQueue();
    expect(r.retried).toBe(1);
    expect(db.email_logs[0].attempts).toBe(1);
    expect(db.email_logs[0].status).toBe('queued');

    // try #2 → attempts 2, requeued
    r = await engine.processQueue();
    expect(db.email_logs[0].attempts).toBe(2);
    expect(db.email_logs[0].status).toBe('queued');

    // try #3 → attempts 3, requeued (last retry slot)
    r = await engine.processQueue();
    expect(db.email_logs[0].attempts).toBe(3);
    expect(db.email_logs[0].status).toBe('queued');

    // try #4 → exhausted, permanent fail + admin alert (E2)
    r = await engine.processQueue();
    expect(r.failed).toBe(1);
    expect(db.email_logs[0].attempts).toBe(4);
    expect(db.email_logs[0].status).toBe('failed');
    expect(adminAlert).toHaveBeenCalledTimes(1);
    expect(adminAlert.mock.calls[0][0].key).toBe('email_fail:BOOKING_CONFIRMED_CUSTOMER');
  });

  test('a retry (not yet exhausted) does NOT alert (E2)', async () => {
    await engine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'a@x.test', data: { service_name: 'X' }, user: {} });
    mockProviderState.success = false;
    await engine.processQueue();               // attempt 1 → requeued
    expect(adminAlert).not.toHaveBeenCalled();
  });
});
