-- v3.144 — job_runs: persisted last-run schedule for long-interval crons (F4).
--
-- Every scheduled job was a setInterval in the web process, and setInterval fires
-- FIRST after a full interval. Render cycles the pod, resetting the timer on every
-- restart — so a 60-min+ job whose pod doesn't survive a full interval NEVER runs.
-- Observed live: ledger-reconcile, otp-cleanup, referral-release, rate-limit-cleanup
-- and the daily digests were all starved (job_locks leases expired under dead pods,
-- never re-acquired). This table lets the runner decide DUE-ness durably: a job runs
-- when now - last_run_at >= its interval, regardless of pod churn.
--
-- Server-only (service_role); RLS-on / no policy, like job_locks + webhook_events.
-- Apply on BOTH DBs. Idempotent.

CREATE TABLE IF NOT EXISTS job_runs (
  name        text        PRIMARY KEY,
  last_run_at timestamptz,
  last_outcome text,
  last_error  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
