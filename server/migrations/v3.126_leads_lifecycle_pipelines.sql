-- ============================================================
-- v3.126 — Lead lifecycle pipelines (Presale / Relations / Marketing / Exit)
-- Run on STAGING (Tokyo xwvciqkayammbvsidqig) first, verify, then
-- PROD (Mumbai ayjhlwyzszykqtnaktpb). Apply via Supabase SQL Editor or MCP.
--
-- Additive + a widened CHECK. Idempotent (safe to re-run).
--
-- What changes (see server/services/crm/lifecycleRules.js — the code source of truth):
--   * ADD downstream money states won/sloth/retained/ambassador/enterprised/champion
--     and structured exits not_reachable/not_interested/disqualified/churned.
--   * KEEP the two live money keys `paid` (relabelled "Subscribed" in the UI) and
--     `activated` ("Onboarded"). We deliberately do NOT rename them — dozens of
--     unrelated call sites read booking/subscription 'paid'/'activated'; renaming the
--     lead-status keys would risk them. UI relabelling (client salesConstants) is safe.
--   * RETIRE `trial` (dead: no time-boxed trial in this product) and fold
--     `demo_scheduled` → `demo`. Existing rows are migrated BEFORE the CHECK tightens.
--   * lead_type: guests are excluded from the host pipeline (source='guest_booking').
--   * verified_at: KYC-approved badge, backfilled from kyc_submissions.
--
-- Downstream states (won/sloth/…) are NOT backfilled here — the lifecycle engine
-- (crm-lifecycle-engine cron, every 15 min) and the real-time hooks resolve them
-- from account facts on the next tick. This migration only has to make the values legal.
-- ============================================================

-- 1. Migrate rows OFF the values we are removing, BEFORE tightening the CHECK.
UPDATE leads SET status = 'demo'      WHERE status = 'demo_scheduled';
UPDATE leads SET status = 'qualified' WHERE status = 'trial';   -- handful; admins re-review

-- 1b. Legacy 'activated' was set for ANY onboarded host (free included). Relations is
--     now subscription-only, so an UNPAID onboarded host belongs in Presale (O-1).
--     Move unpaid 'activated' leads → 'qualified' (their onboarding badges stay live;
--     the engine re-promotes them to activated the moment they pay). Leads with no
--     linked profile are left untouched (can't determine paid status).
UPDATE leads l SET status = 'qualified', updated_at = now()
  FROM profiles p
 WHERE l.profile_id = p.id
   AND l.status = 'activated'
   AND COALESCE(NULLIF(p.razorpay_subscription_id, ''), NULL) IS NULL
   AND LOWER(COALESCE(p.plan, 'starter')) IN ('free', 'starter', 'starter_legacy', 'explorer');

-- 2. Widen the status CHECK to the full board set. EXPAND-PHASE: the two retired
--    values `demo_scheduled` and `trial` remain ALLOWED here (no rows use them —
--    step 1 migrated them off) so the still-deployed old admin UI, which can still
--    drag a lead to the old Demo/Trial columns, does not hit a CHECK violation
--    before this PR ships. A follow-up CONTRACT migration drops them once the new
--    board UI (P2) is live everywhere.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  -- Presale
  'new', 'contacted', 'replied', 'qualified', 'demo',
  -- Customer Relations (paid = Subscribed, activated = Onboarded)
  'paid', 'activated', 'won', 'sloth',
  -- Marketing
  'retained', 'ambassador', 'enterprised', 'champion',
  -- Exit
  'not_reachable', 'not_interested', 'disqualified', 'lost', 'churned',
  -- Orthogonal send-gate
  'do_not_contact',
  -- Retired, transitional-only (drop in the contract migration): keep old-UI writes legal.
  'demo_scheduled', 'trial'
));

-- 3. lead_type — guests are tracked as bookings, not host pipeline leads.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'host';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_chk;
ALTER TABLE leads ADD CONSTRAINT leads_lead_type_chk
  CHECK (lead_type IN ('host', 'guest', 'enterprise'));
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads (lead_type);

-- Existing guest-origin leads → lead_type='guest' (hidden from host boards).
UPDATE leads SET lead_type = 'guest'
  WHERE lead_type = 'host' AND source = 'guest_booking';

-- 4. verified_at — KYC-approved badge (not a pipeline column).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Backfill from approved KYC submissions (match on the linked profile).
UPDATE leads l
   SET verified_at = k.reviewed_at
  FROM kyc_submissions k
 WHERE l.profile_id = k.user_id
   AND k.status = 'approved'
   AND l.verified_at IS NULL;

-- ============================================================
-- End v3.126
-- ============================================================
