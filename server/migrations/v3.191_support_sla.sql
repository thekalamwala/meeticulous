-- v3.191 — Support SLA nudge (services/supportSlaNudge.js).
--
-- sla_waiting_since: when the thread last handed off to a human. Set by trigger so
-- every path into 'waiting' is covered and the app write path is unchanged.
-- assigned -> waiting is excluded: asking for a human again must not restart the wait.
-- sla_alerted_clock / sla_alerted_level: the wait that was last alerted on, and the
-- highest breach level sent for it. Durable "once per breach".
--
-- Additive + nullable. Until this is applied the job's SELECT fails and it sends
-- nothing; the rest of support chat doesn't read these columns.

ALTER TABLE support_threads
  ADD COLUMN IF NOT EXISTS sla_waiting_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_alerted_clock TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_alerted_level SMALLINT;

CREATE OR REPLACE FUNCTION support_thread_stamp_waiting() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.sla_waiting_since := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_thread_waiting ON support_threads;
CREATE TRIGGER trg_support_thread_waiting BEFORE UPDATE OF status ON support_threads
  FOR EACH ROW WHEN (NEW.status = 'waiting' AND OLD.status NOT IN ('waiting', 'assigned'))
  EXECUTE FUNCTION support_thread_stamp_waiting();
