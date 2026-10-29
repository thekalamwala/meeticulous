-- v3.143 — webhook_events: an append-only forensic log of received provider
-- webhooks (audit F21).
--
-- Razorpay events were verified, dispatched and discarded. When a payment went
-- wrong, "did the webhook arrive, what did it say, was it a redelivery?" was
-- unanswerable without the Razorpay dashboard, and there was no way to tell
-- "never got it" from "got it and mishandled it". Per-handler idempotency (the
-- conditional writes in paymentController) still guards EFFECTS; this is the record.
--
-- event_id is Razorpay's per-delivery id (x-razorpay-event-id header), or a sha256
-- of the raw body when absent. UNIQUE(event_id) makes a redelivery a no-op insert,
-- so each distinct event is logged once. RLS-on / no policy: written by the server
-- (service_role) only, never read from the browser. Apply on BOTH DBs. Idempotent.

CREATE TABLE IF NOT EXISTS webhook_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text        NOT NULL DEFAULT 'razorpay',
  event_id    text        NOT NULL,
  event_type  text,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type     ON webhook_events (event_type, received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policy → only service_role (which bypasses RLS) can read/write. The public
-- anon/authenticated roles get nothing, matching the other server-only tables.
