-- ============================================================
-- v3.218 — Community Memberships (M1: model + entitlement)
-- ------------------------------------------------------------
-- One membership program per host, up to 3 tiers (<=1 free), monthly billing.
-- Audience ladder: Public -> Free subscriber -> Paid tier (ranked by price).
-- Adds the post.audience gate columns to community_posts.
-- All new tables: RLS on, NO policy (service_role / supabaseAdmin only),
-- matching the v3.185 community convention.
-- APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS community_membership_programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live')),
  name        text NOT NULL,
  blurb       text,
  cover_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_membership_tiers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     uuid NOT NULL REFERENCES community_membership_programs(id) ON DELETE CASCADE,
  name           text NOT NULL,
  type           text NOT NULL CHECK (type IN ('free','paid')),
  price_inr      int  CHECK (price_inr IS NULL OR price_inr > 0),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly')),
  perks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  position       int  NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live')),
  -- Razorpay Plan id, minted lazily on first paid join (reuses the ensureRazorpayPlan pattern).
  razorpay_plan_id_monthly text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- paid tiers must carry a price; free tiers must not.
  CONSTRAINT tier_price_matches_type CHECK (
    (type = 'paid' AND price_inr IS NOT NULL) OR (type = 'free' AND price_inr IS NULL)
  )
);
-- At most one free tier per program.
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_free_tier
  ON community_membership_tiers (program_id) WHERE type = 'free';
CREATE INDEX IF NOT EXISTS idx_membership_tiers_program
  ON community_membership_tiers (program_id, position);

CREATE TABLE IF NOT EXISTS community_membership_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id                 uuid NOT NULL REFERENCES community_membership_tiers(id) ON DELETE CASCADE,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','past_due','canceled','expired')),
  razorpay_subscription_id text,  -- NULL for a free-tier subscription
  current_period_end      timestamptz,
  started_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
-- One live relationship per (member, host): active OR past_due (grace) is current.
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_sub_current
  ON community_membership_subscriptions (member_id, host_id)
  WHERE status IN ('active','past_due');
-- Entitlement read path: "my active subs to this host".
CREATE INDEX IF NOT EXISTS idx_membership_sub_entitlement
  ON community_membership_subscriptions (member_id, host_id, status);
-- Webhook lookups by Razorpay subscription id.
CREATE INDEX IF NOT EXISTS idx_membership_sub_rzp
  ON community_membership_subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- post.audience gate on the existing community_posts table.
-- 'tier' requires audience_tier_id; 'public'/'free_subscribers' forbid it.
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public'
    CHECK (audience IN ('public','free_subscribers','tier'));
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS audience_tier_id uuid REFERENCES community_membership_tiers(id) ON DELETE SET NULL;
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS teaser_line text;  -- host-authored line shown to the locked-out viewer
DO $$ BEGIN
  ALTER TABLE community_posts ADD CONSTRAINT community_posts_audience_tier_req
    CHECK ((audience = 'tier') = (audience_tier_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Feed filter by audience (gated posts still surface as teasers; this just helps the query).
CREATE INDEX IF NOT EXISTS idx_community_posts_audience
  ON community_posts (audience) WHERE audience <> 'public';

ALTER TABLE community_membership_programs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_membership_tiers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_membership_subscriptions ENABLE ROW LEVEL SECURITY;
