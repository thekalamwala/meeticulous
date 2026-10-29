/* Prints a JSON session blob for a vendor (Google-auth accounts have no password).
 * Used only to inject an authenticated session into the browser for E2E testing.
 */
require('dotenv').config();
const { mintSessionForEmail } = require('../config/supabase');
const EMAIL = process.argv[2] || 'sndatarkar@gmail.com';
(async () => {
  const s = await mintSessionForEmail(EMAIL);
  process.stdout.write(JSON.stringify({ token: s.access_token, refresh_token: s.refresh_token }));
})().catch((e) => { console.error(e.message); process.exit(1); });
