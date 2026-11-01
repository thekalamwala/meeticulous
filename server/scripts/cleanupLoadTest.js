'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.meeticulous.local';

(async () => {
  assertNotProd('cleanupLoadTest');
  const { data: vendors } = await supabaseAdmin.from('profiles').select('id').like('username', 'loadtest-%');
  const ids = (vendors || []).map((v) => v.id);

  // Tagged guest bookings (FK-safe order: reviews -> bookings -> services -> availability)
  await supabaseAdmin.from('bookings').delete().like('guest_email', `%${TAG_DOMAIN}`);
  if (ids.length) {
    await supabaseAdmin.from('reviews').delete().in('host_id', ids);
    await supabaseAdmin.from('bookings').delete().in('host_id', ids);
    await supabaseAdmin.from('services').delete().in('host_id', ids);
    await supabaseAdmin.from('availability').delete().in('host_id', ids);
  }
  // Guest profiles created during load tests
  await supabaseAdmin.from('profiles').delete().like('email', `%${TAG_DOMAIN}`);
  // Vendor profiles + auth users
  for (const id of ids) {
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    try { await supabaseAdmin.auth.admin.deleteUser(id); } catch (_) { /* already gone */ }
  }
  console.log(`Cleaned ${ids.length} test vendor(s) + all rows tagged ${TAG_DOMAIN}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
