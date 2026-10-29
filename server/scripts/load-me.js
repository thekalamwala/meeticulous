/* Fires N sequential GET /api/auth/me at a running server and prints per-request
 * wall-clock. Proves whether express-slow-down's progressive delay is the 13s.
 * Usage: node scripts/load-me.js <baseURL> <count>
 */
require('dotenv').config();
const { mintSessionForEmail } = require('../config/supabase');

const BASE = process.argv[2] || 'http://127.0.0.1:5055';
const COUNT = parseInt(process.argv[3] || '60', 10);
const EMAIL = process.argv[4] || 'sndatarkar@gmail.com';

(async () => {
  const { access_token } = await mintSessionForEmail(EMAIL);
  const headers = { Authorization: `Bearer ${access_token}` };
  const samples = [];
  for (let i = 1; i <= COUNT; i++) {
    const t = process.hrtime.bigint();
    const res = await fetch(`${BASE}/api/auth/me`, { headers });
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    samples.push({ i, ms, status: res.status });
    // Log every request once we near/cross the slow-down threshold.
    if (i <= 3 || i >= 48) console.log(`#${i} ${res.status} ${ms.toFixed(0)}ms`);
  }
  const max = samples.reduce((a, b) => (b.ms > a.ms ? b : a));
  const first = samples[0].ms, last = samples[samples.length - 1].ms;
  console.log(`\nfirst=${first.toFixed(0)}ms  last=${last.toFixed(0)}ms  MAX=#${max.i} ${max.ms.toFixed(0)}ms`);
  process.exit(0);
})().catch((e) => { console.error('load failed:', e.message); process.exit(1); });
