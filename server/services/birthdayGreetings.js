'use strict';
/**
 * birthdayGreetings.js — the daily "happy birthday" send (v3.138).
 *
 * Wires the long-seeded-but-dead BIRTHDAY email. Sends to any profile (host OR guest)
 * whose date_of_birth month/day is today and who hasn't been greeted this calendar
 * year. Delivery goes through NotificationEngine (BIRTHDAY is a MARKETING event, so
 * email unsubscribe is honored); birthday_greeted_at stamps the send so the cron —
 * which ticks several times a day — greets exactly once per year.
 *
 * Kill-switch: the `birthday_greetings` feature flag. Off → nothing sends.
 * Best-effort throughout — a birthday send must never break the tick.
 */
const { supabaseAdmin } = require('../config/supabase');
const featureFlags = require('./featureFlags');
const NotificationEngine = require('./notificationEngine');
const governor = require('./crm/touchGovernor');

// Month/day in UTC — DOB is a date-only value stored/parsed as UTC midnight, so both
// sides of the comparison use the same frame.
const mmdd = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

async function processBirthdays(now = Date.now()) {
  const out = { sent: 0, skipped: 0 };
  if (!(await featureFlags.isFeatureEnabled('birthday_greetings'))) return out;

  const today = new Date(now);
  const todayMMDD = mmdd(today);
  const thisYear = today.getUTCFullYear();

  // Bounded scan of the DOB-bearing subset (indexed). Month/day filtered in JS because
  // a to_char/EXTRACT filter isn't expressible through PostgREST.
  // ponytail: move to an EXTRACT(month/day) RPC if this base ever grows past a few thousand.
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, date_of_birth, birthday_greeted_at')
    .not('date_of_birth', 'is', null);
  if (error) { console.warn('[birthday] query failed:', error.message); return out; }

  for (const p of data || []) {
    try {
      const dob = new Date(`${p.date_of_birth}T00:00:00Z`);
      if (Number.isNaN(dob.getTime()) || mmdd(dob) !== todayMMDD) continue;         // not today
      const greetedYear = p.birthday_greeted_at ? new Date(p.birthday_greeted_at).getUTCFullYear() : null;
      if (greetedYear === thisYear) { out.skipped += 1; continue; }                 // already greeted this year
      if (!p.email) { out.skipped += 1; continue; }

      // Global touch cap: a birthday counts against the same per-person ceiling as
      // CRM/milestone touches (hosts resolve to their lead ledger; a pure guest with
      // no ledger fails open until PR-9). Capped → skip WITHOUT stamping, so the next
      // tick retries once the window clears rather than losing the birthday for a year.
      const gate = await governor.canTouch({ type: 'profile', id: p.id }, now);
      if (!gate.ok) { out.skipped += 1; continue; }

      await NotificationEngine.send({
        event: 'BIRTHDAY',
        data: {
          email: p.email,
          name: p.name,
          emailData: { first_name: (p.name || '').split(' ')[0] || 'there', name: p.name },
          emailUser: { name: p.name, email: p.email },
          recipientUserId: p.id,
        },
      });
      await supabaseAdmin.from('profiles')
        .update({ birthday_greeted_at: new Date(now).toISOString() }).eq('id', p.id);
      // Record onto the governor's ledger so this birthday counts toward the cap.
      await governor.recordTouch({ type: 'profile', id: p.id }, { channel: 'email', event: 'BIRTHDAY' });
      out.sent += 1;
    } catch (e) {
      console.error(`[birthday] profile ${p.id} failed:`, e.message);
    }
  }
  return out;
}

module.exports = { processBirthdays };
