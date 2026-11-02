/**
 * googleCalendarSmoke.js — live smoke-test for the googleapis@173 bump (PR #34).
 *
 * Exercises the real Google Calendar surfaces the app uses, against a real
 * connected vendor's stored (encrypted) tokens:
 *   1. settings.get        → calendar timezone           (read)
 *   2. freebusy.query      → slot availability           (read)
 *   3. events.insert       → book + Meet conferenceData  (WRITE, then deleted)
 *   4. events.delete       → cleanup the test event      (WRITE)
 *
 * The OAuth client auto-refreshes the access_token from the refresh_token on the
 * first call, so the auth/refresh path is covered implicitly.
 *
 * Run:  cd server && node scripts/googleCalendarSmoke.js
 * Needs: server/.env (GOOGLE_* creds + Supabase + TOKEN_ENC key) and at least one
 *        profile with google_calendar_connected = true.
 */
'use strict';

require('dotenv').config();
const { google } = require('googleapis');
const { supabaseAdmin } = require('../config/supabase');
const { decrypt: decryptToken } = require('../utils/cryptoTokens');
const {
  getCalendarTimezone,
  getFreeBusy,
  createCalendarEvent,
} = require('../config/google');

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

(async () => {
  console.log(`\ngoogleapis ${require('googleapis/package.json').version} — Calendar live smoke\n`);

  // 1. Find a connected vendor.
  const { data: hosts, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, google_access_token, google_refresh_token')
    .eq('google_calendar_connected', true)
    .not('google_refresh_token', 'is', null)
    .limit(1);

  if (error) { fail(`Supabase query failed: ${error.message}`); process.exit(1); }
  if (!hosts?.length) {
    fail('No vendor with google_calendar_connected=true. Connect a Google account first, then re-run.');
    process.exit(1);
  }
  const host = hosts[0];
  console.log(`Using vendor: ${host.name || host.username || host.id}\n`);

  const accessToken = decryptToken(host.google_access_token);
  const refreshToken = decryptToken(host.google_refresh_token);

  let passed = 0, failed = 0;

  // 2. Timezone (settings.get)
  try {
    const tz = await getCalendarTimezone(accessToken, refreshToken);
    ok(`settings.get  → timezone: ${tz}`);
    passed++;
  } catch (e) { fail(`settings.get  → ${e.message}`); failed++; }

  // 3. FreeBusy (freebusy.query) — next 7 days
  try {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 864e5);
    const busy = await getFreeBusy(accessToken, refreshToken, now.toISOString(), week.toISOString());
    ok(`freebusy.query → ${busy.length} busy interval(s) in next 7d`);
    passed++;
  } catch (e) { fail(`freebusy.query → ${e.message}`); failed++; }

  // 4. Create event + Meet link (events.insert), then delete it.
  let eventId = null;
  try {
    // ~1 year out so it can never collide with a real booking.
    const start = new Date(Date.now() + 365 * 864e5);
    const end = new Date(start.getTime() + 30 * 60000);
    const ev = await createCalendarEvent(accessToken, refreshToken, {
      title: '[SMOKE TEST — safe to ignore] Meeticulous googleapis bump',
      description: 'Automated smoke test for PR #34. Auto-deleted within seconds.',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      timezone: 'Asia/Kolkata',
      attendees: [], // no attendees → no notification emails
    });
    eventId = ev.eventId;
    ok(`events.insert → event ${eventId}, Meet: ${ev.meetLink ? 'yes' : 'NONE (conferenceData may be off)'}`);
    passed++;
  } catch (e) { fail(`events.insert → ${e.message}`); failed++; }

  // 5. Cleanup
  if (eventId) {
    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
      auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
      await google.calendar({ version: 'v3', auth })
        .events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' });
      ok(`events.delete → cleaned up test event`);
    } catch (e) { fail(`events.delete → ${e.message} (delete manually: ${eventId})`); }
  }

  console.log(`\n${failed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} — ${passed} ok, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('Smoke crashed:', e); process.exit(1); });
