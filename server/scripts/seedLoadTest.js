'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.meeticulous.local';
const PASSWORD = process.env.LOADTEST_VENDOR_PASSWORD || 'LoadTest!2026';
const VENDORS = [
  { key: 'rules', username: 'loadtest-vendor-rules', gcal: false },
  { key: 'gcal', username: 'loadtest-vendor-gcal', gcal: true },
];
const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const wideOpen = () => Object.fromEntries(WEEK.map((d) => [d, [{ start: '09:00', end: '21:00' }]]));

async function ensureVendor(v) {
  const email = `${v.username}${TAG_DOMAIN}`;
  let userId;
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const found = (list.users || []).find((u) => u.email === email);
    if (!found) throw error;
    userId = found.id;
  } else {
    userId = created.user.id;
  }

  const hasGoogle = v.gcal && !!process.env.TEST_VENDOR_GOOGLE_REFRESH_TOKEN;
  // ponytail: google_access_token/google_refresh_token moved off `profiles` to
  // `profile_private` in the v3.23 security remediation — writing them here 42703s.
  // The gcal vendor's freebusy plan is already best-effort/skipped without tokens,
  // and the same-slot test only uses the rules vendor, so we just don't seed them.
  const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    name: `LoadTest ${v.key}`,
    email,
    role: 'host',
    username: v.username,
    plan: 'professional',
    google_calendar_connected: hasGoogle,
  }, { onConflict: 'id' });
  if (profErr) throw new Error(`profiles upsert failed (${v.username}): ${profErr.message}`);

  const { error: avErr } = await supabaseAdmin.from('availability').upsert({
    host_id: userId,
    weekly_schedule: wideOpen(),
    blocked_dates: [],
    timezone: 'Asia/Kolkata',
    buffer_minutes: 0,
  }, { onConflict: 'host_id' });
  if (avErr) throw new Error(`availability upsert failed (${v.username}): ${avErr.message}`);

  // NOTE: live `services` has a GLOBAL unique index on slug (services_slug_unique_idx),
  // not (host_id, slug) as docs/database-schema.md claims — so slugs are per-vendor unique.
  const services = [
    { slug: `loadtest-${v.key}-free`, title: 'LoadTest Free Session', duration: 30, price: 0 },
    { slug: `loadtest-${v.key}-paid`, title: 'LoadTest Paid Session', duration: 30, price: 500 },
  ];
  for (const s of services) {
    const { error: svcErr } = await supabaseAdmin.from('services').upsert({
      host_id: userId, title: s.title, slug: s.slug, duration: s.duration, price: s.price,
      currency: 'INR', meeting_mode: 'online',
      grace_period_minutes: 10, is_active: true,
    }, { onConflict: 'slug' });
    if (svcErr) throw new Error(`services upsert failed (${s.slug}): ${svcErr.message}`);
  }
  return { key: v.key, userId, username: v.username, email, google: hasGoogle };
}

(async () => {
  assertNotProd('seedLoadTest');
  const out = [];
  for (const v of VENDORS) out.push(await ensureVendor(v));
  console.log(JSON.stringify({ vendors: out, password: PASSWORD, tagDomain: TAG_DOMAIN }, null, 2));
  if (!process.env.TEST_VENDOR_GOOGLE_REFRESH_TOKEN) {
    console.log('NOTE: TEST_VENDOR_GOOGLE_REFRESH_TOKEN not set -> freebusy-cache plan will be skipped (not faked).');
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
