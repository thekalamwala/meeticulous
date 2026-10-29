// Distributed leader-election for the in-process cron jobs.
//
// WHY: the API runs all scheduled work (reminders, the email/campaign queue
// workers, badge eval, OTP cleanup, the ledger/subscription/booking reconcilers)
// via setInterval inside the web process. On a single instance that is fine. The
// moment a second instance runs — the prerequisite for horizontal scaling and for
// the shared rate-limit store (see middleware/rateLimitStore.js) — every cron
// fires on BOTH instances, double-sending emails/reminders/campaigns and racing
// the reconcilers.
//
// runLocked() wraps a job in a short Postgres lease: only the instance that holds
// a fresh lease for a given job name runs it; the others skip that tick. The
// holder renews its lease on every tick; if the holder dies, the lease expires
// and another instance takes over. Backed by the job_locks table +
// try_acquire_job_lock RPC (migrations/v3.25_job_locks.sql).
//
// FAIL-OPEN: if the lock cannot be evaluated (migration not yet applied, transient
// DB error) acquire() returns true so the job still runs. This keeps today's
// single-instance behaviour byte-for-byte and lets the migration be applied at
// leisure. On >1 instance a persistent lock-DB outage would re-introduce double
// execution, but in that state the jobs (which all hit the same DB) are already
// degraded — so failing open is strictly better than silently halting all crons.

const os = require('os');
const crypto = require('crypto');

// Stable per-process identity so a holder can recognise and renew its own lease.
const HOLDER = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString('hex')}`;

let warnedFallback = false;

/**
 * Try to acquire/renew the lease for `name` for `leaseMs`. Returns true if this
 * process now holds it (and should run the job), false if another live instance
 * holds it. Fail-open: returns true on any error.
 * @param {string} name
 * @param {number} leaseMs
 * @returns {Promise<boolean>}
 */
async function acquire(name, leaseMs) {
  try {
    // Lazy require so importing this module has no side effects (and tests that
    // never run a cron don't touch the Supabase client).
    const { supabaseAdmin } = require('../config/supabase');
    const { data, error } = await supabaseAdmin.rpc('try_acquire_job_lock', {
      p_name: name,
      p_holder: HOLDER,
      p_lease_ms: leaseMs,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    if (!warnedFallback) {
      warnedFallback = true; // warn once, not every tick
      console.warn(
        `[jobLock] lock unavailable (${err.message}); running jobs unlocked. ` +
        'Apply migrations/v3.25_job_locks.sql to enable multi-instance safety.'
      );
    }
    // Fail-open is SAFE on a single instance but re-introduces double execution on
    // >1 (duplicate emails/reminders, reconcilers racing on money rows). When the
    // lock DB is unreachable — or the migration is simply missing, exactly how this
    // stayed invisible in production — surface it instead of only a one-time warn.
    // adminAlert throttles per key (15 min), so a persistent outage re-pings rather
    // than spamming; best-effort, never breaks the job path.
    try {
      require('./adminAlert').adminAlert({
        key: 'joblock_fail_open',
        subject: 'Cron leader-election unavailable — jobs running unlocked',
        lines: [
          `try_acquire_job_lock failed: ${err.message}`,
          'Every instance is now running every scheduled job (fail-open). Harmless on a single instance; on more than one this double-sends emails/reminders and races the reconcilers.',
          'Check that migrations/v3.25_job_locks.sql is applied and the database is reachable.',
        ],
      });
    } catch (_) { /* alerting must never break the job path */ }
    return true; // fail-open — preserve single-instance behaviour
  }
}

// In-process re-entrancy guard. The Postgres lease renews for the SAME holder on
// every tick, so it does NOT stop a slow run of a job from overlapping the next
// tick of that same job on THIS process (e.g. reminders/email-queue running every
// 60s–5min while a run is still draining a backlog). Overlap double-sends. This
// Set makes a job skip its own tick while a previous one is still in flight.
const _inFlight = new Set();

/**
 * Run `fn` only if this instance currently holds the lease for `name` AND no
 * previous run of `name` is still executing in this process; otherwise skip this
 * tick. `leaseMs` should comfortably exceed the job's interval (the schedulers in
 * server.js pass 2x the interval) so the holder always renews before expiry.
 * Returns fn()'s result, or undefined when the tick was skipped.
 * @param {string} name
 * @param {() => any} fn
 * @param {{ leaseMs?: number }} [opts]
 */
async function runLocked(name, fn, { leaseMs } = {}) {
  if (_inFlight.has(name)) return undefined; // previous tick still running here
  const got = await acquire(name, leaseMs || 60 * 1000);
  if (!got) return undefined;
  _inFlight.add(name);
  try {
    return await fn();
  } finally {
    _inFlight.delete(name);
  }
}

module.exports = { runLocked, acquire, HOLDER };
