'use strict';
// Membership notifications (M8). In-app first (events seeded email/WhatsApp OFF).
// All fire-and-forget — NotificationEngine.send never throws; we also guard awaits.
const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../notificationEngine');
const { tierRank, requiredRank } = require('./entitlement');

const NEW_POST_FANOUT_CAP = 200; // ponytail: cap the per-post fan-out; move to a queue if programs grow large.

const safe = (p) => Promise.resolve(p).catch(() => {});

// New member joined (free or paid) → host.
function newMember({ hostId, tierName }) {
  if (!hostId) return;
  safe(NotificationEngine.send({
    event: 'MEMBERSHIP_NEW_MEMBER',
    data: {
      recipientUserId: hostId,
      inApp: { title: 'New member joined', body: tierName ? `Someone joined your ${tierName} tier.` : 'Someone joined your membership.', link: '/dashboard/memberships' },
    },
  }));
}

// Paid charge failed (subscription halted) → member, with a grace note.
function paymentFailed({ memberId }) {
  if (!memberId) return;
  safe(NotificationEngine.send({
    event: 'MEMBERSHIP_PAYMENT_FAILED',
    data: {
      recipientUserId: memberId,
      inApp: { title: 'Membership payment failed', body: 'Update your payment method to keep your access.', link: '/user/memberships' },
    },
  }));
}

// Renewal charged → member (low-frequency).
function renewed({ memberId }) {
  if (!memberId) return;
  safe(NotificationEngine.send({
    event: 'MEMBERSHIP_RENEWED',
    data: {
      recipientUserId: memberId,
      inApp: { title: 'Membership renewed', body: 'Your membership renewed for another month.', link: '/user/memberships' },
    },
  }));
}

// New members-only post → the tier's entitled members (batched by a per-post dedupe key).
// `post` = { id, audience, audience_tier_id, author_id, slug }.
async function newPost(post) {
  if (!post || !post.audience || post.audience === 'public') return;
  try {
    // Tier lookup for requiredRank.
    let tierById = {};
    if (post.audience_tier_id) {
      const { data } = await supabaseAdmin
        .from('community_membership_tiers').select('id, type, price_inr').eq('id', post.audience_tier_id).maybeSingle();
      if (data) tierById = { [data.id]: data };
    }
    const req = requiredRank({ audience: post.audience, audience_tier_id: post.audience_tier_id }, tierById);

    const { data: subs } = await supabaseAdmin
      .from('community_membership_subscriptions')
      .select('member_id, tier:community_membership_tiers(type, price_inr)')
      .eq('host_id', post.author_id).in('status', ['active', 'past_due']).limit(NEW_POST_FANOUT_CAP);

    const link = `/community/${post.kind === 'thread' ? 't' : 'p'}/${post.slug}`;
    for (const s of (subs || [])) {
      if (tierRank(s.tier) < req) continue; // only entitled members
      safe(NotificationEngine.send({
        event: 'MEMBERSHIP_NEW_POST',
        data: {
          recipientUserId: s.member_id,
          dedupeKey: `membership_new_post:${post.id}:${s.member_id}`,
          inApp: { title: 'New members-only post', body: 'A new post is waiting for members.', link },
        },
      }));
    }
  } catch (_) { /* never block a post on notifications */ }
}

module.exports = { newMember, paymentFailed, renewed, newPost };
