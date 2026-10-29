-- v3.25 — distributed lease locks for the in-process cron jobs.
-- Idempotent. Apply via Supabase SQL Editor or `npm run migrate:<env>`.
--
-- Enables leader-election so scheduled work (reminders, reconcilers, the email/
-- campaign queue workers, badge eval, OTP cleanup) runs on exactly ONE API
-- instance at a time. This is the prerequisite for running >1 instance and for
-- the shared rate-limit store (v3.18). See server/utils/jobLock.js.

CREATE TABLE IF NOT EXISTS job_locks (
  name        text        PRIMARY KEY,
  holder      text        NOT NULL,
  locked_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Atomically claim or renew the lease for a job, returning true iff the caller
-- holds a fresh lease afterwards:
--   * no row yet                              -> insert, caller wins
--   * row exists but expired                  -> take it over, caller wins
--   * row already held by caller              -> renew lease, caller wins
--   * row held by someone else and still valid -> no change, caller loses
-- Concurrent callers on a fresh key race the INSERT; exactly one wins, the rest
-- hit DO UPDATE with a WHERE that is false for them and so do not steal the lock.
CREATE OR REPLACE FUNCTION try_acquire_job_lock(p_name text, p_holder text, p_lease_ms bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_holder text;
BEGIN
  INSERT INTO job_locks (name, holder, locked_at, expires_at)
    VALUES (p_name, p_holder, now(), now() + (p_lease_ms::bigint || ' milliseconds')::interval)
  ON CONFLICT (name) DO UPDATE
    SET holder = EXCLUDED.holder,
        locked_at = now(),
        expires_at = EXCLUDED.expires_at
    WHERE job_locks.expires_at < now()
       OR job_locks.holder = EXCLUDED.holder;

  SELECT holder INTO v_holder FROM job_locks WHERE name = p_name;
  RETURN v_holder = p_holder;
END;
$$;

-- Lock acquisition is server-only (called via the service-role client). Keep it
-- off the public PostgREST surface, mirroring post_journal_entry (v2.8).
REVOKE ALL ON FUNCTION try_acquire_job_lock(text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION try_acquire_job_lock(text, text, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION try_acquire_job_lock(text, text, bigint) TO service_role;
