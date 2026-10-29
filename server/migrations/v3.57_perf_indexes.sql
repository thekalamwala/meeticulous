-- v3.57_perf_indexes.sql — OPTIONAL, forward-scaling index tuning.
--
-- STATUS: NOT auto-applied. Apply only when the dashboard/transaction reads
-- actually show up slow (via /metrics slow-request counter or EXPLAIN ANALYZE on
-- prod data). At today's data volume the planner is fine without these; they are
-- prep for growth, not a fix for a current problem.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY must run OUTSIDE a transaction block and
-- one statement at a time. In the Supabase SQL editor, run each statement on its
-- own. Do NOT wrap in BEGIN/COMMIT. Apply to BOTH DBs (prod Mumbai + staging
-- Tokyo) per the project's migration workflow.
--
-- ── What these serve ─────────────────────────────────────────────────────────
-- Vendors ONLY ever read their PAID bookings (payment_status='paid' is a hard
-- filter in getHostBookings and getTransactions). Partial indexes on that subset
-- are small and exactly match the query shape:
--
--   getTransactions  — .eq(host_id).eq(payment_status,'paid').order(created_at).range()
--     No existing index orders a host's paid bookings by created_at, so the
--     planner sorts. This is the strongest candidate.
--   getHostBookings  — .eq(host_id).eq(payment_status,'paid').order(scheduled_at)
--     Partly served today by idx_bookings_host_scheduled(host_id, scheduled_at);
--     the partial just skips the non-paid rows. Moderate.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_host_paid_created
  ON public.bookings (host_id, created_at)
  WHERE payment_status = 'paid';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_host_paid_scheduled
  ON public.bookings (host_id, scheduled_at)
  WHERE payment_status = 'paid';

-- ── Deliberately NOT added (analysed, rejected) ──────────────────────────────
-- * services(host_id) alone — REDUNDANT. services_host_slug_idx(host_id, slug)
--   already serves WHERE host_id = ? via its leftmost prefix.
-- * bookings(guest_email) / bookings(guest_phone) — the only place they're
--   searched is getTransactions' `.or(guest_name.ilike, guest_email.ilike)`;
--   ILIKE '%term%' cannot use a plain btree index (would need pg_trgm GIN, not
--   justified at this scale).
-- * profiles(plan) — low cardinality (3-4 values); a btree rarely helps and the
--   admin lists that touch it are already paginated/bounded.
-- * bookings(payment_status) alone — low cardinality; only useful combined with
--   host_id, which the partial indexes above already encode.
