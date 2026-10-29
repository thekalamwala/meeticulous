-- v3.142 — repair the impossible-state rows behind audit F11.
--
-- The stale-hold reaper used to set only status='cancelled', leaving reaped holds
-- at settlement_status='pending_completion' — a "cancelled but still awaiting
-- completion" state that shouldn't exist. The code fix (reaper now stamps
-- settlement_status='cancelled') stops NEW ones; this repairs the existing rows.
--
-- Universal invariant: a cancelled booking is never settle-able, so every
-- status='cancelled' row must read settlement_status='cancelled'. Condition-scoped
-- and idempotent (a second run matches nothing). Apply on BOTH DBs.

UPDATE bookings
   SET settlement_status = 'cancelled',
       updated_at        = now()
 WHERE status = 'cancelled'
   AND settlement_status IS DISTINCT FROM 'cancelled';
