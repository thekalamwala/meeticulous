/**
 * postingService.js — the ONLY JS write path into the ledger.
 * Wraps the atomic Postgres RPC post_journal_entry(jsonb).
 * Idempotency lives in the DB (UNIQUE (source_type, source_id)) — calling
 * post twice for the same event returns the same entry id, posts nothing new.
 */
'use strict';

const { supabaseAdmin } = require('../../config/supabase');

/**
 * @param {object} args
 * @param {string} args.sourceType  ORDER_PAYMENT | SUBSCRIPTION_PAYMENT | BANK_TRANSFER | ADJUSTMENT | REVERSAL | BACKFILL | BACKFILL_SETTLEMENT | SETTLEMENT | REFUND
 * @param {string} args.sourceId    uuid of the source record (booking, subscription payment, …)
 * @param {object} args.template    { description, lines } from journalTemplates
 * @param {string} [args.journalDate] ISO date (defaults to today, UTC, in the DB)
 * @param {string} [args.createdBy]   admin_users.id for manual entries
 * @returns {Promise<string>} journal entry uuid
 */
async function post({ sourceType, sourceId, template, journalDate = null, createdBy = null }) {
  const { data, error } = await supabaseAdmin.rpc('post_journal_entry', {
    p: {
      source_type: sourceType,
      source_id: sourceId,
      journal_date: journalDate,
      description: template.description,
      created_by: createdBy,
      lines: template.lines,
    },
  });
  if (error) throw new Error(`ledger posting failed (${sourceType}/${sourceId}): ${error.message}`);
  return data;
}

// Dead-letter tracking: a captured payment must never fail because the ledger
// write failed (postSafe swallows it, the reconciler retries). But a row that can
// NEVER post — e.g. a non-postable amount that violates a DB CHECK — would retry
// forever in silence (this is exactly how the fee-only negative-payout bug hid for
// four weeks). Count consecutive failures per source and alert once a source keeps
// failing, so a permanently-poisoned entry surfaces instead of retrying invisibly.
// ponytail: in-process counter — resets on deploy. adminAlert's own 15-min keyed
// throttle bounds the noise, and a genuinely stuck row re-trips it every reconciler
// run; a durable count belongs in a dead_letter table if this ever needs auditing.
const _failCounts = new Map(); // `${sourceType}/${sourceId}` -> consecutive failures
const ALERT_AFTER = Number(process.env.LEDGER_POISON_ALERT_AFTER) || 2;

/**
 * Non-throwing variant for payment paths: a captured payment must never fail
 * because the ledger write failed. The reconciler cron self-heals transient
 * misses; a source that fails ALERT_AFTER times in a row raises an admin alert.
 * ONLY for source types the reconciler scans (ORDER_PAYMENT,
 * SUBSCRIPTION_PAYMENT) — all other flows must use post() and surface errors.
 */
async function postSafe(args) {
  const key = `${args?.sourceType}/${args?.sourceId}`;
  try {
    const id = await post(args);
    _failCounts.delete(key); // success clears the streak
    return id;
  } catch (err) {
    const n = (_failCounts.get(key) || 0) + 1;
    _failCounts.set(key, n);
    console.error(`LEDGER POSTING MISSED (attempt ${n}, reconciler will retry) ${key}:`, err.message);
    if (n >= ALERT_AFTER) {
      try {
        const { adminAlert } = require('../../utils/adminAlert');
        adminAlert({
          key: `ledger_poison:${key}`, // adminAlert throttles per key (15 min)
          category: 'Payment Receipt',
          subject: `Ledger entry won't post after ${n} tries — ${key}`,
          lines: [
            `The journal entry for ${key} has failed ${n} consecutive times.`,
            `Error: ${err.message}`,
            `The reconciler keeps retrying, but this entry may NEVER post — money moved without hitting the books. Inspect the source row for a non-postable amount (a negative or zero journal line).`,
          ],
        });
      } catch (_) { /* alerting must never break the payment path */ }
    }
    return null;
  }
}

module.exports = { post, postSafe };
