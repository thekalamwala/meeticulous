const sources = {
  profiles: [
    { id: 'u1', email: 'Vendor@x.test', name: 'Vee', phone: '9990001111', role: 'host', plan: 'explorer' },
    { id: 'u2', email: 'guest@x.test',  name: 'Gee', role: 'guest', plan: null },
  ],
  bookings: [
    { guest_email: 'guest@x.test', guest_name: 'Gee', guest_phone: '9991112222', scheduled_at: '2026-05-01T10:00:00Z' },
    { guest_email: 'walkin@x.test', guest_name: 'Walk', guest_phone: '9000000000', scheduled_at: '2026-05-02T10:00:00Z' },
  ],
  product_purchases: [
    { buyer_email: 'buyer@x.test', buyer_name: 'Buy', buyer_phone: '8000000000' },
  ],
};
const upserted = [];
const existing = [
  { id: 'c-old', email: 'guest@x.test', email_suppressed: true, whatsapp_opt_in: false }, // must be preserved
];

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (t) => ({
      select: () => Promise.resolve({ data: sources[t] ?? (t === 'contacts' ? existing : []), error: null }),
      upsert: (rows) => { upserted.push(...[].concat(rows)); return { select: () => Promise.resolve({ data: [].concat(rows), error: null }) }; },
    }),
  },
  supabase: {},
}));

const contactsService = require('../../services/contactsService');

beforeEach(() => { upserted.length = 0; });

test('dedups by email and unions all three sources', async () => {
  const r = await contactsService.sync();
  const emails = upserted.map((c) => c.email.toLowerCase());
  // vendor@, guest@, walkin@, buyer@ = 4 unique
  expect(new Set(emails).size).toBe(4);
  expect(r.upserted).toBe(4);
});

test('classifies contact_type from source', async () => {
  await contactsService.sync();
  const byEmail = Object.fromEntries(upserted.map((c) => [c.email.toLowerCase(), c]));
  expect(byEmail['vendor@x.test'].contact_type).toBe('vendor');
  expect(byEmail['walkin@x.test'].contact_type).toBe('guest');
  expect(byEmail['buyer@x.test'].contact_type).toBe('buyer');
});

test('captures vendor phone from profiles (enables WhatsApp targeting)', async () => {
  await contactsService.sync();
  const v = upserted.find((c) => c.email.toLowerCase() === 'vendor@x.test');
  expect(v.phone).toBe('9990001111');
  expect(v.contact_type).toBe('vendor');
});

test('preserves existing suppression / opt-out flags', async () => {
  await contactsService.sync();
  const g = upserted.find((c) => c.email.toLowerCase() === 'guest@x.test');
  expect(g.email_suppressed).toBe(true);
  expect(g.whatsapp_opt_in).toBe(false);
});
