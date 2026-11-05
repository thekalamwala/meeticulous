// Persisted-schedule runner for long-interval crons (audit F4).
//
// THE BUG: every scheduled job was a setInterval inside the web process, and
// setInterval fires FIRST after a full interval. Render cycles the pod (deploys,
// and platform churn), so a 60-min+ job's timer is reset on every restart and, if
// the pod doesn't survive a full interval, its first tick NEVER arrives. Observed
// in prod: ledger-reconcile, otp-cleanup, referral-release, rate-limit-cleanup,
// the daily digests — all starved, their job_locks leases sitting expired under
// dead pods, never re-acquired. Money bugs' "self-healing" reconciler was among them.
//
// THE FIX: drive long jobs off a PERSISTED last_run_at (job_runs table) checked on
// a SHORT tick (every few minutes). A job runs when `now - last_run_at >= interval`
// regardless of how often the pod restarts — a fresh pod's first short tick is only
// minutes away, so due work is picked up immediately instead of waiting a full long
// interval that a churning pod never reaches. runLocked still guards multi-instance
// + in-process overlap; this only decides DUE-ness durably.
//
// FAIL-OPEN (matches jobLock): if job_runs can't be read (pre-migration, DB blip)
// the job is treated as due, preserving "it runs" over "it silently doesn't".

const { supabaseAdmin } = require('../config/supabase');
const { runLocked } = require('./jobLock');

let _warnedSchema = false;

// A FAILED run does not count as a run: it is retried after this delay (or after
// its own interval, if shorter) instead of waiting a full interval. ASH-35 S2-5:
// a daily job that errored used to sit until the next day.
const RETRY_AFTER_ERROR_MS = 15 * 60 * 1000;
// The lease is released when a run ends (jobLock.release), so it only needs to
// outlast one run. Capped so a pod killed mid-run can't block a daily job for 48h.
const MAX_LEASE_MS = 30 * 60 * 1000;

// Record an attempt's outcome. Best-effort; persistence failure must not break the
// job. Only ever called from INSIDE runLocked's fn, so it stamps only when THIS
// instance actually ran (a lease-loser never reaches here). An error keeps the
// previous last_run_at (the job is still due); updated_at times the retry.
async function stampRun(name, outcome, error) {
  const now = new Date().toISOString();
  try {
    await supabaseAdmin.from('job_runs').upsert({
      name,
      ...(outcome === 'ok' ? { last_run_at: now } : {}),
      last_outcome: outcome,
      last_error: error ? String(error).slice(0, 500) : null,
      updated_at: now,
    }, { onConflict: 'name' });
  } catch (err) {
    if (!_warnedSchema && /Could not find|does not exist|relation .* does not exist/i.test(err.message || '')) {
      _warnedSchema = true;
      console.warn('[jobRunner] job_runs table missing; apply migrations/v3.144_job_runs.sql. Running on interval only until then.');
    }
  }
}

/**
 * Run `fn` iff it is DUE per the persisted last_run_at, and this instance wins the
 * lease. Stamps the run (success or failure) so the next due-check is durable.
 * @param {string}   name        job name (shared with job_locks + job_runs)
 * @param {number}   intervalMs  minimum spacing between runs
 * @param {()=>any}  fn
 * @param {{ leaseMs?: number }} [opts]
 * @returns {Promise<any|undefined>} fn's result, or undefined when skipped/not due
 */
async function runIfDue(name, intervalMs, fn, { leaseMs } = {}) {
  let due = true;
  try {
    const { data, error } = await supabaseAdmin
      .from('job_runs').select('last_run_at, last_outcome, updated_at').eq('name', name).maybeSingle();
    if (error) throw error;
    if (data && data.last_outcome === 'error' && data.updated_at) {
      due = (Date.now() - new Date(data.updated_at).getTime()) >= Math.min(RETRY_AFTER_ERROR_MS, intervalMs);
    } else if (data && data.last_run_at) {
      due = (Date.now() - new Date(data.last_run_at).getTime()) >= intervalMs;
    }
  } catch (_) {
    // Fail-open: can't read schedule → treat as due (better to run than to stall).
    due = true;
  }
  if (!due) return undefined;

  return runLocked(name, async () => {
    let outcome = 'ok';
    let errMsg = null;
    try {
      return await fn();
    } catch (e) {
      outcome = 'error';
      errMsg = e && e.message;
      throw e;
    } finally {
      await stampRun(name, outcome, errMsg);
    }
  }, { leaseMs: leaseMs || Math.min(intervalMs * 2, MAX_LEASE_MS), release: true });
}

module.exports = { runIfDue, stampRun, RETRY_AFTER_ERROR_MS, MAX_LEASE_MS };
