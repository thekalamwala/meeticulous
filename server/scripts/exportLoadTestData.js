'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.meeticulous.local';
const DATA_DIR = path.resolve(__dirname, '../../performance/jmeter/data');

(async () => {
  assertNotProd('exportLoadTestData');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const { data: vendors } = await supabaseAdmin.from('profiles').select('id, username').like('username', 'loadtest-%');
  const ids = (vendors || []).map((v) => v.id);
  const { data: services } = ids.length
    ? await supabaseAdmin.from('services').select('id, host_id, slug, price').in('host_id', ids)
    : { data: [] };

  fs.writeFileSync(path.join(DATA_DIR, 'vendors.csv'),
    ['vendor_id,username', ...(vendors || []).map((v) => `${v.id},${v.username}`)].join('\n'));
  fs.writeFileSync(path.join(DATA_DIR, 'services.csv'),
    ['service_id,host_id,slug,price', ...(services || []).map((s) => `${s.id},${s.host_id},${s.slug},${s.price}`)].join('\n'));

  const guests = ['guest_email,guest_name,guest_phone'];
  for (let i = 1; i <= 200; i++) {
    guests.push(`loadtest+${i}${TAG_DOMAIN},LoadGuest ${i},+9190000${String(i).padStart(5, '0')}`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'guests.csv'), guests.join('\n'));

  console.log('Wrote vendors.csv, services.csv, guests.csv to', DATA_DIR);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
