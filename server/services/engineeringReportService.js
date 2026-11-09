'use strict';
/**
 * engineeringReportService.js — READ-ONLY engineering health numbers for the SUTRA
 * agent network (YANTRA). Served by GET /api/agents/reports/engineering (ASH-35).
 *
 * Reads the EXISTING job/queue/payout tables, changes nothing:
 *   job_runs + job_locks (cron health), email_logs, crm_messages, campaign_recipients
 *   (outbound queues), bookings.transfer_status (Route payouts), contacts (audience
 *   size + consent counts — the opt-out integrity check from the ASH-35 audit).
 *
 * Contract:
 *   • COUNTS ONLY. No recipients, emails, phones, names, ids, message bodies or error
 *     text are returned. job_runs.last_error is deliberately NOT selected (it can hold
 *     an address). Job NAMES are code identifiers, not data, so they are returned.
 *   • No writes, no new tables, no migration.
 *   • Schema-fallback: a metric whose table/column is missing reports null, never 500s.
 */
const { supabaseAdmin } = require('../config/supabase');

const MIN = 60 * 1000;
const STUCK_MS = 30 * MIN; // matches the CRM stuck-processing sweep

// Exported so the PII test checks the exact strings the queries use.
const COLS = {
  job_runs: 'name, last_run_at, last_outcome, updated_at',
  job_locks: 'name, expires_at',
};

const missingSchema = (e) => /does not exist|could not find|schema cache/i.test(e?.message || '')
  || ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e?.code);

// head:true count; `build(q)` adds filters. null when the table/column is missing.
async function count(table, build = (q) => q) {
  const { count: n, error } = await build(supabaseAdmin.from(table).select('*', { count: 'exact', head: true }));
  if (error) { if (missingSchema(error)) return null; throw error; }
  return n || 0;
}

async function rows(table, cols) {
  const { data, error } = await supabaseAdmin.from(table).select(cols).limit(500);
  if (error) { if (missingSchema(error)) return null; throw error; }
  return data || [];
}

/** Pure: per-job health from job_runs + job_locks rows. Exported for tests. */
function aggregateJobs(runs, locks, now) {
  const t = now.getTime();
  const jobs = (runs || []).map((r) => ({
    name: r.name,
    last_outcome: r.last_outcome || null,
    minutes_since_success: r.last_run_at ? Math.round((t - Date.parse(r.last_run_at)) / MIN) : null,
    minutes_since_attempt: r.updated_at ? Math.round((t - Date.parse(r.updated_at)) / MIN) : null,
  })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    tracked: jobs.length,
    erroring: jobs.filter((j) => j.last_outcome === 'error').map((j) => j.name),
    jobs,
    locks: locks === null ? null : {
      held: locks.filter((l) => Date.parse(l.expires_at) >= t).length,
      expired: locks.filter((l) => Date.parse(l.expires_at) < t).length,
    },
  };
}

async function buildEngineeringReport({ now = new Date() } = {}) {
  const iso = (ms) => new Date(now.getTime() - ms).toISOString();
  const day = iso(24 * 60 * MIN);
  const week = iso(7 * 24 * 60 * MIN);
  const stuck = iso(STUCK_MS);

  const [
    runs, locks,
    emailQueued, emailSending, emailFailed24h, emailFailed7d, emailSent24h,
    crmQueued, crmStuck, crmFailed7d,
    campSending, campFailed7d,
    xferCreating, xferFailed, xferPending,
    contactsTotal, contactsOptedOut, contactsSuppressed,
  ] = await Promise.all([
    rows('job_runs', COLS.job_runs),
    rows('job_locks', COLS.job_locks),
    count('email_logs', (q) => q.eq('status', 'queued')),
    count('email_logs', (q) => q.eq('status', 'sending')),
    count('email_logs', (q) => q.eq('status', 'failed').gte('updated_at', day)),
    count('email_logs', (q) => q.eq('status', 'failed').gte('updated_at', week)),
    count('email_logs', (q) => q.eq('status', 'sent').gte('updated_at', day)),
    count('crm_messages', (q) => q.eq('status', 'queued')),
    count('crm_messages', (q) => q.eq('status', 'processing').lt('updated_at', stuck)),
    count('crm_messages', (q) => q.eq('status', 'failed').gte('updated_at', week)),
    count('campaign_recipients', (q) => q.eq('status', 'sending')),
    count('campaign_recipients', (q) => q.eq('status', 'failed').gte('updated_at', week)),
    count('bookings', (q) => q.eq('transfer_status', 'creating')),
    count('bookings', (q) => q.eq('transfer_status', 'failed')),
    count('bookings', (q) => q.eq('transfer_status', 'pending')),
    count('contacts'),
    count('contacts', (q) => q.eq('email_opt_in', false)),
    count('contacts', (q) => q.eq('email_suppressed', true)),
  ]);

  return {
    report: 'engineering',
    version: 1,
    as_of: now.toISOString(),
    definitions: {
      jobs: 'job_runs (runIfDue crons only; setInterval workers write no row). minutes_since_success from last_run_at, minutes_since_attempt from updated_at; erroring = last_outcome error',
      locks: 'job_locks rows: held = lease not yet expired, expired = stale lease left by a dead pod',
      email: 'email_logs by status; failed/sent windows by updated_at',
      crm: 'crm_messages; stuck = processing for over 30 min (the sweep marks these failed)',
      campaigns: 'campaign_recipients; sending = claimed mid-send',
      payouts: 'bookings.transfer_status: creating = Route transfer claim in flight, failed = needs retry/attention, pending = held at Razorpay',
      contacts: 'contacts table size + consent counts. Above 1,000 rows the pre-ASH-35 sync reset opt-outs, so watch opted_out/suppressed for unexpected drops',
      null: 'table or column not present on this DB',
    },
    jobs: runs === null ? null : aggregateJobs(runs, locks, now),
    email: { queued: emailQueued, sending: emailSending, failed_24h: emailFailed24h, failed_7d: emailFailed7d, sent_24h: emailSent24h },
    crm: { queued: crmQueued, stuck_processing: crmStuck, failed_7d: crmFailed7d },
    campaigns: { sending: campSending, failed_7d: campFailed7d },
    payouts: { transfer_creating: xferCreating, transfer_failed: xferFailed, transfer_pending: xferPending },
    contacts: { total: contactsTotal, email_opted_out: contactsOptedOut, email_suppressed: contactsSuppressed },
  };
}

module.exports = { buildEngineeringReport, aggregateJobs, COLS };
