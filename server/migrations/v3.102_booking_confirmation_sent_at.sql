-- v3.102 — booking confirmation re-drive flag (P1-02)
--
-- WHY: after a booking's payment is captured, sendBookingConfirmation() fires the
-- calendar event + Meet link + BOOKING_CONFIRMED messages as a best-effort
-- BACKGROUND task. If that task is lost (process restart between the capture and
-- the setImmediate, or an early throw), NOTHING re-drives it — the webhook and
-- reconciler both skip the booking because it is already `paid`. The guest has
-- paid but never receives a calendar invite, Meet link, or confirmation.
--
-- This column records when the confirmation side-effects completed. A new
-- confirmation reconciler (services/confirmationReconciler.js) scans paid,
-- confirmed bookings where it is still NULL (and old enough that the primary
-- background send should have finished) and re-fires the confirmation. The code
-- keeps a schema fallback (strips this column on "column does not exist"), so
-- this migration can be applied at leisure on both DBs; until then the reconciler
-- simply no-ops.
--
-- Additive + idempotent. Run on BOTH prod (Mumbai) and staging (Tokyo).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- Partial index for the reconciler's hot path: paid + confirmed + not-yet-confirmed.
CREATE INDEX IF NOT EXISTS idx_bookings_unconfirmed
  ON public.bookings (paid_at)
  WHERE payment_status = 'paid' AND confirmation_sent_at IS NULL;

-- Existing paid bookings predate this flag; treat them as already confirmed so the
-- reconciler doesn't re-send historical confirmations on first run.
UPDATE public.bookings
  SET confirmation_sent_at = COALESCE(paid_at, updated_at, created_at)
  WHERE payment_status = 'paid' AND confirmation_sent_at IS NULL;
