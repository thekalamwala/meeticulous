/* Evidence harness for the /api/auth/me 13s investigation.
 * Reproduces the EXACT two awaits the endpoint performs, against the real
 * Supabase project, timing cold (first) vs warm (subsequent) calls.
 * Read-only except for minting a throwaway magiclink session (no email sent).
 * Run:  node scripts/measure-me.js  (from server/)  — kill is automatic.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { supabaseAdmin, mintSessionForEmail } = require('../config/supabase');

const EMAIL = process.argv[2] || 'sndatarkar@gmail.com';
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);

(async () => {
  const rows = [];

  // 0. Mint a real access token (same token type the client sends).
  let t = process.hrtime.bigint();
  const session = await mintSessionForEmail(EMAIL);
  rows.push(['mintSessionForEmail (setup)', ms(t)]);
  const token = session.access_token;

  // Inspect token signing algorithm — decides which fix is valid.
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
  const claims = jwt.decode(token);
  console.log(`\nToken alg=${header.alg}  kid=${header.kid || '(none)'}  sub=${claims.sub}`);
  console.log(`SUPABASE_JWT_SECRET present: ${!!process.env.SUPABASE_JWT_SECRET}\n`);

  // 1. Local JWT decode (no verify) — baseline cost of stateless parse.
  t = process.hrtime.bigint();
  jwt.decode(token);
  rows.push(['jwt.decode (local, no net)', ms(t)]);

  // 2. supabase.auth.getUser — run 4x to see cold vs warm.
  for (let i = 0; i < 4; i++) {
    t = process.hrtime.bigint();
    const { error } = await supabaseAdmin.auth.getUser(token);
    rows.push([`auth.getUser #${i + 1}${i === 0 ? ' (cold)' : ''}${error ? ' ERR:' + error.message : ''}`, ms(t)]);
  }

  // 3. profiles.select('*').single() — run 4x.
  for (let i = 0; i < 4; i++) {
    t = process.hrtime.bigint();
    const { error } = await supabaseAdmin.from('profiles').select('*').eq('id', claims.sub).single();
    rows.push([`profiles.select #${i + 1}${i === 0 ? ' (cold)' : ''}${error ? ' ERR:' + error.message : ''}`, ms(t)]);
  }

  // Report
  console.log('STEP'.padEnd(40), 'ms');
  console.log('-'.repeat(50));
  for (const [k, v] of rows) console.log(k.padEnd(40), v);
  process.exit(0);
})().catch((e) => { console.error('measure failed:', e); process.exit(1); });
