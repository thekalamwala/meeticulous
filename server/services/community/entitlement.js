'use strict';
// Membership entitlement — the SINGLE source of truth for "who can see what" (brief §3).
// Every surface (common feed, membership feed, membership space, single post) MUST call
// isUnlocked() before serving a post, and postToTeaser() when it is locked. Never ship a
// post body/media/comments the viewer is not entitled to.
//
// Audience ladder (ranks are comparable integers; higher = more access):
//   public viewer .......... 0
//   free subscriber ........ 1
//   paid tier .............. 1000 + price_inr   (all paid tiers sit above any free tier;
//                                                 price orders the paid tiers)
// A post is unlocked iff viewerMaxRank >= requiredRank(post).
// ponytail: paid tiers ranked by price — two paid tiers at the SAME price rank equal and
// unlock each other. Add an explicit tier_level column if a host ever prices two tiers equally.

const FREE_RANK = 1;
const PAID_BASE = 1000;

/** Rank a tier row ({ type, price_inr }). Unknown/null -> public floor. */
function tierRank(tier) {
  if (!tier) return 0;
  if (tier.type === 'free') return FREE_RANK;
  if (tier.type === 'paid') return PAID_BASE + (tier.price_inr || 0);
  return 0;
}

/**
 * Required rank to unlock a post.
 * @param {object} post            community_posts row: { audience, audience_tier_id }
 * @param {Map|object} tierById    lookup from tier id -> tier row (for 'tier' audience)
 */
function requiredRank(post, tierById) {
  const aud = post.audience || 'public';
  if (aud === 'public') return 0;
  if (aud === 'free_subscribers') return FREE_RANK;
  if (aud === 'tier') {
    const get = tierById instanceof Map ? (k) => tierById.get(k) : (k) => tierById && tierById[k];
    const tier = get(post.audience_tier_id);
    // A gated post whose tier is missing/deleted fails closed (nobody but rank>=PAID_BASE... ) —
    // use the paid floor so it can never leak to free/public. ponytail: fail-closed on missing tier.
    return tier ? tierRank(tier) : PAID_BASE;
  }
  return PAID_BASE; // unknown audience -> fail closed
}

/** True when the viewer may see the full post. */
function isUnlocked(post, viewerMaxRank, tierById) {
  return viewerMaxRank >= requiredRank(post, tierById);
}

/**
 * Viewer's highest rank for one host, from their current (active|past_due) subscriptions.
 * Reads the DB; the branch-y logic above is unit-tested, this is a thin query.
 * @returns {Promise<number>} 0 if public / no current subscription.
 */
async function maxTierRank(supabaseAdmin, { hostId, viewerId }) {
  if (!viewerId || !hostId) return 0;
  const { data, error } = await supabaseAdmin
    .from('community_membership_subscriptions')
    .select('tier:community_membership_tiers(type,price_inr)')
    .eq('member_id', viewerId)
    .eq('host_id', hostId)
    .in('status', ['active', 'past_due']);
  if (error || !data?.length) return 0; // fail closed: no proof of entitlement -> public rank
  return Math.max(0, ...data.map((r) => tierRank(r.tier)));
}

/**
 * Turn an already-serialized post into a locked teaser: body/media/comments withheld,
 * a short preview and the lock chip kept (brief §4). `requiredTier` = { name } for the CTA.
 * The CTA/link itself is rendered client-side from `lock`.
 */
function postToTeaser(item, { requiredTier = null, teaserLine = null } = {}) {
  const preview = teaserLine
    || (item.body ? String(item.body).slice(0, 140) : '');
  return {
    ...item,
    locked: true,
    body: '',            // no body text
    media: [],           // no real media bytes
    comment_count: item.comment_count, // count is fine; contents are fetched separately and gated there
    teaser: preview,
    lock: {
      audience: item.audience || 'tier',
      tier_name: requiredTier?.name || null,
    },
  };
}

module.exports = { tierRank, requiredRank, isUnlocked, maxTierRank, postToTeaser, FREE_RANK, PAID_BASE };
