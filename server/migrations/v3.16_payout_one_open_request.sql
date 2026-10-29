-- v3.16_payout_one_open_request.sql
-- Close the payout TOCTOU race: requestPayout reads the available balance, checks
-- it, then inserts — two concurrent requests can both pass the check and both
-- insert, over-claiming beyond the available balance. This partial unique index
-- enforces at MOST ONE open (pending or approved) payout request per vendor at
-- the DB level, so the second concurrent insert is rejected atomically. Each
-- allowed request is still validated against `available` in the controller.
-- Idempotent. (Verified live: no vendor currently has >1 open request.)
CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_open_per_host
  ON payout_requests (host_id)
  WHERE status IN ('pending', 'approved');
