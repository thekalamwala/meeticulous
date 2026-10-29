'use strict';
/**
 * attribution.js — connect a lead to its Book A Sloth account and revenue.
 *
 * Two passes (run hourly by cron, or on demand):
 *   1. link  — leads with no profile_id are matched to a profiles row by phone
 *              then email, so a lead we cold-outreached and who later signed up
 *              gets stitched to their account.
 *   2. refresh — for linked leads, compute BAS revenue attributable to that
 *              account (paid subscription charges + platform fee on their paid
 *              bookings) into leads.revenue_paise, stamp converted_at on first
 *              money, and advance status to 'paid' once revenue exists.
 *
 * Revenue is stored in paise (integer minor units) to avoid float drift.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { normalizePhone } = require('../aisensyService');
const contactsService = require('../contactsService');
const rules = require('./lifecycleRules');

const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);
const PAGE = 200;

// Non-paying base tiers. Anything else is a paid subscription plan.
const FREE_PLANS = new Set(['free', 'starter', 'starter_legacy', 'explorer']);

// Subscription-payment statuses that represent money actually kept. A row with
// any OTHER explicit status (e.g. a future 'refunded'/'failed') is excluded. A
// NULL status is treated as success — legacy/backfill rows carry no status.
const SUB_SUCCESS = new Set(['paid', 'captured', 'success', 'active', 'authenticated']);
// Booking dispositions whose platform fee is NOT earned revenue — a cancelled or
// no-show booking keeps payment_status='paid' but the fee is refunded/voided.
const DEAD_BOOKING = new Set(['cancelled', 'no_show', 'refunded']);

/**
 * Pure: attributable revenue in paise + the subscription payment timestamps.
 * Refund-aware — drops non-success subscription rows and dead-disposition
 * bookings so a cancelled/no-show/refunded charge never inflates lead revenue.
 * @param {{subs?:Array, bookings?:Array}}
 * @returns {{ paise:number, subTimes:string[] }}
 */
function computeRevenuePaise({ subs = [], bookings = [] } = {}) {
  let paise = 0;
  const subTimes = [];
  for (const s of subs) {
    if (s.status && !SUB_SUCCESS.has(String(s.status).toLowerCase())) continue;
    paise += toPaise(s.total_charged);
    if (s.paid_at) subTimes.push(s.paid_at);
  }
  for (const b of bookings) {
    if (b.status && DEAD_BOOKING.has(String(b.status).toLowerCase())) continue;
    paise += toPaise(b.platform_fee_amount);
  }
  return { paise, subTimes };
}

/**
 * Pure: pick the profile whose normalized phone matches `last10` EXACTLY.
 * The DB pre-filter is a loose `%last10%` substring (index-friendly, tolerant of
 * +91 prefixes); this refinement rejects the substring collisions that filter
 * lets through (a 10-digit run embedded in a longer, different number).
 */
function matchByPhone(candidates = [], last10) {
  if (!last10) return null;
  return candidates.find((p) => (normalizePhone(p.phone) || '').slice(-10) === last10) || null;
}

// WON = the host signed up AND paid for a subscription. Detected robustly: a
// successful subscription payment, an active Razorpay mandate, OR a paid-tier
// plan. The plan check is essential — most paying hosts here are legacy/annual
// subscribers (v3.8 backfill) with NO subscription_payments row, so a
// payment-row-only test would miss them. Guest-booking commission is revenue
// but NOT a subscription, so it never wins a lead on its own.
function isPaidSubscriber(profile, hasSubPayment) {
  if (hasSubPayment) return true;
  if (!profile) return false;
  if (profile.razorpay_subscription_id) return true;
  const plan = String(profile.plan || '').toLowerCase();
  return !!plan && !FREE_PLANS.has(plan);
}

// Pure: converted_at backfill only. Lead STATUS is owned by the lifecycle engine
// + real-time resolver (services/crm/lifecycleRules.resolveAccountStatus) and the
// churn hook — a single writer. Attribution used to promote/demote status too,
// which would now regress the new downstream money states (won/sloth/…) back to
// 'paid' every hour. It no longer touches status: it only stamps converted_at on a
// won lead that reached a money state without one.
function conversionPatch({ won, status, convertedAt, wonAt }) {
  const patch = {};
  if (won && rules.MONEY.has(status) && !convertedAt && wonAt) patch.converted_at = wonAt;
  return patch;
}

// Pass 1 — stitch unlinked leads to profiles.
async function linkLeadsToProfiles() {
  let linked = 0, from = 0;
  for (;;) {
    const { data: leads } = await supabaseAdmin.from('leads')
      .select('id, phone, email').is('profile_id', null)
      .range(from, from + PAGE - 1);
    if (!leads?.length) break;

    for (const l of leads) {
      let profile = null;
      const phone = normalizePhone(l.phone);
      if (phone) {
        const last10 = phone.slice(-10);
        // Loose substring pre-filter, then exact last-10 match in JS to avoid
        // linking a lead to a profile that merely contains the digits.
        const { data: cands } = await supabaseAdmin.from('profiles').select('id, phone, created_at').ilike('phone', `%${last10}%`).limit(10);
        profile = matchByPhone(cands || [], last10);
      }
      if (!profile && l.email) {
        ({ data: profile } = await supabaseAdmin.from('profiles').select('id, created_at').eq('email', l.email).limit(1).maybeSingle());
      }
      if (profile) {
        await supabaseAdmin.from('leads').update({ profile_id: profile.id, updated_at: new Date().toISOString() }).eq('id', l.id);
        linked++;
      }
    }
    if (leads.length < PAGE) break;
    from += PAGE;
  }
  return linked;
}

// Pass 2 — recompute revenue for linked leads.
async function refreshRevenue() {
  let updated = 0, from = 0;
  for (;;) {
    const { data: leads } = await supabaseAdmin.from('leads')
      .select('id, profile_id, status, converted_at').not('profile_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (!leads?.length) break;

    for (const l of leads) {
      const [{ data: subs }, { data: bks }, { data: profile }] = await Promise.all([
        supabaseAdmin.from('subscription_payments').select('total_charged, paid_at, status').eq('vendor_id', l.profile_id),
        supabaseAdmin.from('bookings').select('platform_fee_amount, status').eq('host_id', l.profile_id).eq('payment_status', 'paid'),
        supabaseAdmin.from('profiles').select('plan, razorpay_subscription_id, plan_activated_at').eq('id', l.profile_id).maybeSingle(),
      ]);

      // Total attributed revenue (subscriptions + booking commission) — kept for
      // pipeline value. Refund-aware: cancelled/no-show/refunded charges dropped.
      // The WIN, though, is gated on subscription only (below).
      const { paise, subTimes } = computeRevenuePaise({ subs, bookings: bks });

      const won = isPaidSubscriber(profile, subTimes.length > 0);
      const wonAt = subTimes.sort()[0] || profile?.plan_activated_at || null;

      const patch = {
        revenue_paise: paise,
        updated_at: new Date().toISOString(),
        ...conversionPatch({ won, status: l.status, convertedAt: l.converted_at, wonAt }),
      };

      await supabaseAdmin.from('leads').update(patch).eq('id', l.id);
      updated++;
    }
    if (leads.length < PAGE) break;
    from += PAGE;
  }
  return updated;
}

async function run() {
  const linked = await linkLeadsToProfiles();
  const updated = await refreshRevenue();
  // Mirror email-bearing leads into the marketing contacts table so campaigns
  // can reach them. Best-effort — never let it fail the attribution pass.
  let contacts = { upserted: 0, linked: 0 };
  try { contacts = await contactsService.syncLeads(); }
  catch (e) { console.error('[crm] leads→contacts sync failed:', e.message); }
  return { linked, updated, contactsUpserted: contacts.upserted, contactsLinked: contacts.linked };
}

module.exports = { run, linkLeadsToProfiles, refreshRevenue, toPaise, isPaidSubscriber, conversionPatch, computeRevenuePaise, matchByPhone };
