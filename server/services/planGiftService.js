'use strict';

/**
 * planGiftService.js — complimentary Pro gifts from the Meeticulous team.
 *
 * Plan: docs/superpowers/plans/2026-11-04-gifted-pro.md (v3.190 plan_gifts).
 *
 * A gift IS plain `premium` on the profile with plan_expires_at = the gift's
 * ends_at. Access ending is NOT this module's job: planService.resolveVendorPlan
 * already reads an expired plan as Starter, so a gift ends on time even if the
 * cron is late. This module grants / extends / revokes, closes the row when the
 * gift runs out or the host starts paying, and sends the lifecycle notices.
 *
 * Founder rules (2026-11-04):
 *   - super admin only (enforced at the route);
 *   - NEVER gift a paying customer — checked here, not only in the UI;
 *   - a host who starts paying mid-gift is charged now and the gift ends
 *     (endOnPaid, called from both paid-activation paths);
 *   - revoking tells the host, with the same notice as a natural end.
 *
 * Schema-fallback safe: without the plan_gifts table every read is "no gift",
 * grants fail with GIFTS_UNAVAILABLE and the cron is a no-op.
 */

const { supabaseAdmin } = require('../config/supabase');
const planService = require('./planService');
const NotificationEngine = require('./notificationEngine');
const { audit } = require('./auditService');

const TENURES = [1, 2, 6, 12, 24, 60]; // months
const GIFT_PLAN = 'premium';
const MAX_BATCH = 200;
const ENDING_DAYS = [7, 1];
const DAY_MS = 86400000;

// Any live or in-flight mandate = a paying customer → never gifted.
const MANDATE_STATES = new Set(['active', 'authenticated', 'pending', 'halted']);
// Narrower: the host is actually being charged (used when a gift closes, so an
// abandoned pending checkout doesn't swallow the "gift expired" notice).
const CHARGING_STATES = new Set(['active', 'authenticated']);

const PROFILE_COLS = 'id, name, email, role, is_host, plan, plan_expires_at, subscription_status, razorpay_subscription_id, onboarding_completed, created_at';

class GiftError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const isMissingTable = (e) =>
  !!e && /plan_gifts|does not exist|Could not find the/i.test(e.message || '');

const nowIso = () => new Date().toISOString();
const sameInstant = (a, b) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

/** Calendar months, clamping the day (31 Jan + 1 month → end of Feb). */
function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

const tenureLabel = (m) =>
  m % 12 === 0 ? `${m / 12} year${m === 12 ? '' : 's'}` : `${m} month${m === 1 ? '' : 's'}`;

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
});

// Pay-it-forward link code: 10 chars, no look-alikes (0/O, 1/I/L). ~50 bits.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const mintForwardCode = () =>
  Array.from(require('crypto').randomBytes(10), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

// Share-to-extend: a public post on one of these networks (https only).
const SHARE_HOSTS = ['linkedin.com', 'instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'threads.net'];
function isShareUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return SHARE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch (_) {
    return false;
  }
}

const isPaying = (p) => !!p?.razorpay_subscription_id && MANDATE_STATES.has(p.subscription_status);

/**
 * Why this host can't get (or extend) a gift — null when they can.
 * Paying hosts are blocked in both modes. A grant also needs a free resolved
 * plan, which blocks Supreme, the legacy paid tiers and manual assignPlan comps.
 */
function ineligibleReason(profile, activeGift, { extend = false } = {}) {
  if (!profile) return 'host not found';
  if (profile.role !== 'host' && !profile.is_host) return 'not a host';
  if (isPaying(profile)) return 'paying customer';
  // markCancelled keeps razorpay_subscription_id, and every gift profile write
  // is guarded on it being null — so a churned host can't actually be gifted.
  // Say so here, so the preview matches the grant. (Founder to decide whether
  // churned hosts should become giftable; that needs the write guards changed too.)
  if (profile.razorpay_subscription_id) return 'has a past mandate';
  if (extend) return activeGift ? null : 'no active gift';
  if (activeGift) return 'already gifted (extend instead)';
  if (!planService.isFreeSlug(planService.resolveVendorPlan(profile))) return 'on a paid or comped plan';
  return null;
}

/** The host's active gift, or null. A missing table reads as "no gift"; any
 *  other DB error throws so a blip never looks like "eligible". */
async function getActiveGift(hostId) {
  if (!hostId) return null;
  const { data, error } = await supabaseAdmin
    .from('plan_gifts').select('*').eq('host_id', hostId).eq('status', 'active').maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return data || null;
}

/** Fail-soft variant for the session payload: never throws. */
async function giftForSession(profile) {
  // Only an un-mandated premium host can be gifted — skip the read for everyone else.
  if (!profile || profile.plan !== GIFT_PLAN || profile.razorpay_subscription_id) return null;
  try {
    const g = await getActiveGift(profile.id);
    if (!g || new Date(g.ends_at) <= new Date()) return null;
    return {
      ends_at: g.ends_at, months: g.months + (g.extended_months || 0), note: g.note || null,
      // Share-to-extend: null = not submitted yet; pending / approved / rejected after.
      share_status: g.share_status || null,
      // Pay-it-forward: only gifts the team granted carry a code (a forwarded gift doesn't).
      forward: g.forward_code ? { code: g.forward_code, redeemed: !!g.forward_redeemed_by } : null,
    };
  } catch (_) {
    return null;
  }
}

/** host_ids (from `ids`) that hold an active gift. Never throws (→ empty set). */
async function giftedHostIds(ids) {
  if (!ids || !ids.length) return new Set();
  try {
    const { data, error } = await supabaseAdmin
      .from('plan_gifts').select('host_id').eq('status', 'active').in('host_id', ids);
    if (error) return new Set();
    return new Set((data || []).map((r) => r.host_id));
  } catch (_) {
    return new Set();
  }
}

async function loadProfile(hostId) {
  const { data, error } = await supabaseAdmin.from('profiles').select(PROFILE_COLS).eq('id', hostId).maybeSingle();
  if (error) throw error;
  return data || null;
}

// ── Notices ────────────────────────────────────────────────────────────────

async function notify(event, profile, gift, { inApp, emailData = {} }) {
  if (!profile) return;
  const base = process.env.CLIENT_URL || 'https://meeticulous.com';
  // ponytail: no phone/templateParams yet — WhatsApp is off for these events
  // until the AiSensy templates are approved; add them with the template.
  await NotificationEngine.send({
    event,
    data: {
      email: profile.email, name: profile.name, recipientUserId: profile.id,
      emailUser: { name: profile.name, email: profile.email },
      emailData: {
        first_name: (profile.name || '').split(' ')[0] || 'there',
        tenure: tenureLabel((gift.months || 0) + (gift.extended_months || 0)),
        end_date: fmtDate(gift.ends_at),
        gift_note: gift.note || '',
        upgrade_url: `${base}/dashboard/upgrade`,
        ...emailData,
      },
      inApp,
    },
  });
}

function resolveEndingNotice(hostId) {
  require('../utils/inAppNotify').resolveInApp({ userId: hostId, type: 'PLAN_GIFT_ENDING' });
}

async function crmEvent(hostId, type, title, meta) {
  try {
    // Timeline only: a gift is never money, so never promoteToPaid.
    await require('./crm/leadService').recordAccountEvent({ profileId: hostId, type, title, meta });
  } catch (e) {
    console.error('[gift] crm event failed (non-fatal):', e.message);
  }
}

const receivedNotice = (profile, gift, extended, headline = null) => notify('PLAN_GIFT_RECEIVED', profile, gift, {
  emailData: { gift_headline: headline || (extended ? "I've extended your gifted Pro" : "I'm gifting you Pro") },
  inApp: {
    title: extended ? 'Your gifted Pro was extended' : 'You got Pro, on us',
    body: `Complimentary Pro from the Meeticulous team until ${fmtDate(gift.ends_at)}.`,
    link: '/dashboard/upgrade',
  },
});

const endedNotice = (profile, gift) => notify('PLAN_GIFT_ENDED', profile, gift, {
  inApp: {
    title: 'Your gifted Pro has expired',
    body: 'To keep using the Pro benefits, go Pro.',
    link: '/dashboard/upgrade',
  },
});

// ── Profile writes ─────────────────────────────────────────────────────────

/**
 * Put a gifted host back on Starter — guarded so it only touches a host who is
 * still exactly on this gift (premium, no mandate, expiry = gift end). A host
 * who started paying in the meantime is never downgraded.
 */
async function downgradeIfStillGifted(gift) {
  const ts = nowIso();
  await supabaseAdmin.from('profiles')
    .update({ plan: planService.FREE_PLAN, plan_expires_at: null, plan_updated_at: ts, updated_at: ts })
    .eq('id', gift.host_id).eq('plan', GIFT_PLAN)
    .is('razorpay_subscription_id', null)
    .eq('plan_expires_at', gift.ends_at);
}

/** Close an active gift. Returns the closed row, or null if it was no longer
 *  active (a concurrent close won) — so callers never double-notify. */
async function closeGift(giftId, status, { by = null, reason = null } = {}) {
  const ts = nowIso();
  const { data, error } = await supabaseAdmin.from('plan_gifts')
    .update({ status, closed_at: ts, closed_by: by, close_reason: reason, updated_at: ts })
    .eq('id', giftId).eq('status', 'active')
    .select('*').maybeSingle();
  if (error) throw error;
  return data || null;
}

// ── Admin actions ──────────────────────────────────────────────────────────

/** Dry run for the bulk preview: who would receive a gift, who is skipped and why. */
async function checkEligibility(hostIds) {
  const eligible = [], skipped = [];
  for (const hostId of uniqueIds(hostIds)) {
    const profile = await loadProfile(hostId);
    const why = ineligibleReason(profile, await getActiveGift(hostId));
    if (why) skipped.push({ host_id: hostId, name: profile?.name || null, reason: why });
    else eligible.push({ host_id: hostId, name: profile.name, email: profile.email });
  }
  return { eligible, skipped };
}

const uniqueIds = (ids) => [...new Set((ids || []).filter(Boolean).map(String))].slice(0, MAX_BATCH);

/**
 * Gift Pro to one or many hosts. Never fails the whole batch for one host:
 * returns { granted: [{host_id, gift_id, ends_at}], skipped: [{host_id, reason}] }.
 */
async function grantGift(req, { hostIds, months, reason, note = null, campaign = null, forwardedFrom = null, headline = null }) {
  const granted = [], skipped = [];
  for (const hostId of uniqueIds(hostIds)) {
    try {
      const profile = await loadProfile(hostId);
      const why = ineligibleReason(profile, await getActiveGift(hostId));
      if (why) { skipped.push({ host_id: hostId, reason: why }); continue; }

      const start = new Date();
      const endsAt = addMonths(start, months).toISOString();
      const { data: gift, error } = await supabaseAdmin.from('plan_gifts').insert({
        host_id: hostId, months, starts_at: start.toISOString(), ends_at: endsAt,
        reason, note, campaign, granted_by: req?.admin?.id || null,
        // Pay-it-forward: a team gift carries one link to pass on; a forwarded
        // gift carries none, so the chain stays one level deep.
        forward_code: forwardedFrom ? null : mintForwardCode(),
        forwarded_from: forwardedFrom,
      }).select('*').single();
      if (error) {
        if (isMissingTable(error)) throw new GiftError('GIFTS_UNAVAILABLE', 'Gifts are not set up yet (apply v3.190).');
        // uniq_plan_gifts_active: a concurrent grant got there first.
        if (/uniq_plan_gifts_active/i.test(error.message)) { skipped.push({ host_id: hostId, reason: 'already gifted (extend instead)' }); continue; }
        throw error;
      }

      // Guarded on "no mandate" so a checkout that landed in between is never
      // overwritten with the (possibly shorter) gift end.
      const ts = nowIso();
      const { data: updated, error: upErr } = await supabaseAdmin.from('profiles')
        .update({ plan: GIFT_PLAN, plan_expires_at: endsAt, plan_activated_at: ts, plan_updated_at: ts, updated_at: ts })
        .eq('id', hostId).is('razorpay_subscription_id', null)
        .select('id');
      if (upErr || !updated || !updated.length) {
        await supabaseAdmin.from('plan_gifts').delete().eq('id', gift.id);
        skipped.push({ host_id: hostId, reason: upErr ? 'profile update failed' : 'paying customer' });
        continue;
      }

      await audit(req, {
        action: 'plan.gift.grant', resource_type: 'profile', resource_id: hostId,
        before: { plan: profile.plan, plan_expires_at: profile.plan_expires_at },
        after: { plan: GIFT_PLAN, plan_expires_at: endsAt, gift_id: gift.id, months, campaign, reason },
      });
      await receivedNotice(profile, gift, false, headline);
      await crmEvent(hostId, 'gift_granted', `Gifted Pro — ${tenureLabel(months)}`, { gift_id: gift.id, months, campaign });
      granted.push({ host_id: hostId, gift_id: gift.id, ends_at: endsAt });
    } catch (e) {
      if (e instanceof GiftError) throw e;
      console.error('[gift] grant failed for', hostId, e.message);
      skipped.push({ host_id: hostId, reason: 'error' });
    }
  }
  return { granted, skipped };
}

async function loadActiveGiftById(giftId) {
  const { data, error } = await supabaseAdmin.from('plan_gifts').select('*').eq('id', giftId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new GiftError('GIFTS_UNAVAILABLE', 'Gifts are not set up yet (apply v3.190).');
    throw error;
  }
  if (!data) throw new GiftError('NOT_FOUND', 'Gift not found.');
  if (data.status !== 'active') throw new GiftError('NOT_ACTIVE', `This gift is already ${data.status}.`);
  return data;
}

/** Add `months` to an active gift (from its end, or from now if it has lapsed). */
async function extendGift(req, giftId, months) {
  const gift = await loadActiveGiftById(giftId);
  const profile = await loadProfile(gift.host_id);
  const why = ineligibleReason(profile, gift, { extend: true });
  if (why) throw new GiftError('INELIGIBLE', `Can't extend: ${why}.`);

  const from = new Date(Math.max(Date.now(), new Date(gift.ends_at).getTime()));
  const endsAt = addMonths(from, months).toISOString();
  const ts = nowIso();
  const { data: next, error } = await supabaseAdmin.from('plan_gifts')
    .update({ ends_at: endsAt, extended_months: (gift.extended_months || 0) + months, ending_notified_days: [], updated_at: ts })
    .eq('id', gift.id).eq('status', 'active')
    .select('*').maybeSingle();
  if (error) throw error;
  if (!next) throw new GiftError('NOT_ACTIVE', 'This gift is no longer active.');

  const { data: updated, error: upErr } = await supabaseAdmin.from('profiles')
    .update({ plan: GIFT_PLAN, plan_expires_at: endsAt, plan_updated_at: ts, updated_at: ts })
    .eq('id', gift.host_id).is('razorpay_subscription_id', null)
    .select('id');
  if (upErr || !updated || !updated.length) {
    // A checkout landed between the check and the write: put the gift row back
    // so no extension (and no "extended" email) exists without the access.
    await supabaseAdmin.from('plan_gifts')
      .update({ ends_at: gift.ends_at, extended_months: gift.extended_months || 0, ending_notified_days: gift.ending_notified_days || [], updated_at: nowIso() })
      .eq('id', gift.id).eq('ends_at', endsAt);
    if (upErr) throw upErr;
    throw new GiftError('INELIGIBLE', "Can't extend: checkout in progress.");
  }

  await audit(req, {
    action: 'plan.gift.extend', resource_type: 'profile', resource_id: gift.host_id,
    before: { gift_id: gift.id, ends_at: gift.ends_at },
    after: { gift_id: gift.id, ends_at: endsAt, added_months: months },
  });
  resolveEndingNotice(gift.host_id);
  await receivedNotice(profile, next, true);
  await crmEvent(gift.host_id, 'gift_extended', `Gifted Pro extended — +${tenureLabel(months)}`, { gift_id: gift.id, months });
  return next;
}

/** End a gift now. The host drops to Starter and gets the "gift has expired" notice. */
async function revokeGift(req, giftId, reason) {
  const gift = await loadActiveGiftById(giftId);
  const closed = await closeGift(gift.id, 'revoked', { by: req?.admin?.id || null, reason });
  if (!closed) throw new GiftError('NOT_ACTIVE', 'This gift is no longer active.');
  await downgradeIfStillGifted(gift);
  await audit(req, {
    action: 'plan.gift.revoke', resource_type: 'profile', resource_id: gift.host_id,
    before: { gift_id: gift.id, ends_at: gift.ends_at, plan: GIFT_PLAN },
    after: { gift_id: gift.id, status: 'revoked', plan: planService.FREE_PLAN, reason },
  });
  resolveEndingNotice(gift.host_id);
  await endedNotice(await loadProfile(gift.host_id), gift);
  await crmEvent(gift.host_id, 'gift_revoked', 'Gifted Pro revoked', { gift_id: gift.id });
  return closed;
}

/** Gifts for the admin table, newest first, with the host's name/email. */
async function listGifts({ status = 'active', page = 1, pageSize = 50 } = {}) {
  const from = (Math.max(1, page) - 1) * pageSize;
  let q = supabaseAdmin.from('plan_gifts')
    .select('*, host:profiles!plan_gifts_host_id_fkey(id, name, email, username)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  // 'share_pending' = the review queue for share-to-extend.
  if (status === 'share_pending') q = q.eq('status', 'active').eq('share_status', 'pending');
  else if (status && status !== 'all') q = q.eq('status', status);
  const { data, error, count } = await q;
  if (error) {
    if (isMissingTable(error)) throw new GiftError('GIFTS_UNAVAILABLE', 'Gifts are not set up yet (apply v3.190).');
    throw error;
  }
  return { gifts: data || [], total: count || 0 };
}

// ── Share-to-extend ────────────────────────────────────────────────────────

/** Host pastes the link to their public post about Meeticulous. Once per gift;
 *  a super admin checks the post and approves it for +1 month (reviewShare). */
async function submitShare(hostId, url) {
  if (!isShareUrl(url)) throw new GiftError('BAD_URL', 'Paste the https link to your public post on LinkedIn, Instagram, X, Facebook or Threads.');
  const gift = await getActiveGift(hostId);
  if (!gift) throw new GiftError('NOT_ACTIVE', 'You have no active gifted Pro.');
  if (gift.share_status) throw new GiftError('ALREADY_SHARED', 'You already sent a post for this gift.');
  const { data, error } = await supabaseAdmin.from('plan_gifts')
    .update({ share_url: String(url).trim().slice(0, 500), share_status: 'pending', updated_at: nowIso() })
    .eq('id', gift.id).eq('status', 'active').is('share_status', null)
    .select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new GiftError('ALREADY_SHARED', 'You already sent a post for this gift.');
  require('../utils/adminAlert').adminAlert({
    key: `gift_share:${gift.id}`,
    subject: 'Gifted Pro: a share is waiting for review',
    lines: [`Host ${hostId} posted about Meeticulous.`, `Post: ${data.share_url}`, 'Approve it in Admin → Plans → Gifted Pro to add 1 month.'],
  }).catch(() => {});
  return data;
}

/** Super admin verdict on a pending share. Approve = +1 month (the host gets the
 *  "I've extended your gifted Pro" email); reject = no extension, no resubmit. */
async function reviewShare(req, giftId, approve) {
  const gift = await loadActiveGiftById(giftId);
  if (gift.share_status !== 'pending') throw new GiftError('NOT_PENDING', 'This gift has no share waiting for review.');
  // Claim the verdict first (conditional update = one winner), so a double
  // click / two admins can't both extend.
  const { data: claimed, error } = await supabaseAdmin.from('plan_gifts')
    .update({ share_status: approve ? 'approved' : 'rejected', share_reviewed_at: nowIso(), updated_at: nowIso() })
    .eq('id', gift.id).eq('share_status', 'pending')
    .select('*').maybeSingle();
  if (error) throw error;
  if (!claimed) throw new GiftError('NOT_PENDING', 'This gift has no share waiting for review.');
  let data = claimed;
  if (approve) {
    try {
      data = await extendGift(req, gift.id, 1);
    } catch (e) {
      // Extend failed: back to pending so it can be reviewed again.
      await supabaseAdmin.from('plan_gifts')
        .update({ share_status: 'pending', share_reviewed_at: null, updated_at: nowIso() })
        .eq('id', gift.id).eq('share_status', 'approved');
      throw e;
    }
  }
  await audit(req, {
    action: approve ? 'plan.gift.share_approve' : 'plan.gift.share_reject',
    resource_type: 'profile', resource_id: gift.host_id,
    after: { gift_id: gift.id, share_url: gift.share_url },
  });
  return data;
}

// ── Pay-it-forward ─────────────────────────────────────────────────────────

const FORWARD_MONTHS = 1;
const SYSTEM_REQ = { admin: { id: null, email: 'system:pay-it-forward', role: 'system' } };

/**
 * A new host who signed up through a gifted host's link gets 1 month of Pro,
 * once their onboarding is complete. The original super-admin gift is the
 * approval (founder, 2026-11-04). Returns { redeemed, reason?, keep? } —
 * keep=true means "try again later" (onboarding not finished yet).
 */
async function redeemForward(hostId, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { redeemed: false, reason: 'invalid code' };
  const { data: source, error } = await supabaseAdmin.from('plan_gifts')
    .select('id, host_id, status, created_at, forward_redeemed_by').eq('forward_code', code).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { redeemed: false, reason: 'unavailable' };
    throw error;
  }
  if (!source) return { redeemed: false, reason: 'invalid code' };
  // ponytail: only `revoked` is refused; founder to decide on ended/converted codes.
  if (source.status === 'revoked') return { redeemed: false, reason: 'gift revoked' };
  if (source.forward_redeemed_by) return { redeemed: false, reason: 'already used' };
  if (source.host_id === hostId) return { redeemed: false, reason: 'own code' };

  const profile = await loadProfile(hostId);
  if (!profile) return { redeemed: false, reason: 'host not found' };
  if (!profile.onboarding_completed) return { redeemed: false, reason: 'finish onboarding first', keep: true };
  // New hosts only: the account must postdate the link.
  if (profile.created_at && new Date(profile.created_at) < new Date(source.created_at)) return { redeemed: false, reason: 'not a new host' };
  const why = ineligibleReason(profile, await getActiveGift(hostId));
  if (why) return { redeemed: false, reason: why };

  // Claim the code first (conditional update = one winner under a race).
  const { data: claimed } = await supabaseAdmin.from('plan_gifts')
    .update({ forward_redeemed_by: hostId, forward_redeemed_at: nowIso(), updated_at: nowIso() })
    .eq('id', source.id).is('forward_redeemed_by', null)
    .select('id').maybeSingle();
  if (!claimed) return { redeemed: false, reason: 'already used' };

  const giver = await loadProfile(source.host_id);
  const giverFirst = (giver?.name || '').split(' ')[0] || 'A friend';
  const out = await grantGift(SYSTEM_REQ, {
    hostIds: [hostId], months: FORWARD_MONTHS, campaign: 'pay-it-forward',
    reason: `Pay-it-forward from gift ${source.id}`, forwardedFrom: source.id,
    headline: `${giverFirst} sent you a month of Pro`,
  });
  if (!out.granted.length) {
    // Grant didn't land: release the code so it isn't burnt.
    await supabaseAdmin.from('plan_gifts')
      .update({ forward_redeemed_by: null, forward_redeemed_at: null, updated_at: nowIso() })
      .eq('id', source.id).eq('forward_redeemed_by', hostId);
    return { redeemed: false, reason: out.skipped[0]?.reason || 'error' };
  }
  return { redeemed: true, ends_at: out.granted[0].ends_at };
}

// ── Paid activation ────────────────────────────────────────────────────────

/**
 * The host just started paying: close their active gift as `converted` and
 * return it (null when there was none). Founder rule: charge now, gift ends —
 * the caller must not carry the gift's end date over the paid period.
 * Never throws: a failure here must not fail a real payment.
 */
async function endOnPaid(hostId) {
  try {
    const ts = nowIso();
    const { data, error } = await supabaseAdmin.from('plan_gifts')
      .update({ status: 'converted', closed_at: ts, close_reason: 'started paying', updated_at: ts })
      .eq('host_id', hostId).eq('status', 'active')
      .select('*').maybeSingle();
    if (error) {
      if (!isMissingTable(error)) console.error('[gift] endOnPaid failed (non-fatal):', error.message);
      return null;
    }
    if (data) {
      resolveEndingNotice(hostId);
      await crmEvent(hostId, 'gift_converted', 'Gifted Pro → paid Pro', { gift_id: data.id });
    }
    return data || null;
  } catch (e) {
    console.error('[gift] endOnPaid failed (non-fatal):', e.message);
    return null;
  }
}

// ── Cron ───────────────────────────────────────────────────────────────────

/**
 * Hourly. (A) T-7 / T-1 "ends soon" notices, once each per gift.
 * (B) Gifts past their end: close, put the host back on Starter, "expired" notice.
 * Access already ended at ends_at via resolveVendorPlan — this only tidies and
 * notifies, so a late run is harmless. Never throws.
 */
async function processGiftExpiry() {
  const out = { ending: 0, ended: 0, converted: 0 };
  try {
    const now = Date.now();
    const { data: rows, error } = await supabaseAdmin.from('plan_gifts')
      .select('*').eq('status', 'active')
      .lte('ends_at', new Date(now + 8 * DAY_MS).toISOString())
      .order('ends_at', { ascending: true }).limit(500);
    if (error) {
      if (!isMissingTable(error)) console.error('[gift] expiry scan:', error.message);
      return out;
    }

    for (const gift of rows || []) {
      try {
        const profile = await loadProfile(gift.host_id);
        // Started paying but endOnPaid didn't land (or the profile moved on):
        // close quietly — never tell a payer their "gift expired".
        const movedOn = !profile
          || (profile.razorpay_subscription_id && CHARGING_STATES.has(profile.subscription_status))
          || !sameInstant(profile.plan_expires_at, gift.ends_at);

        if (new Date(gift.ends_at).getTime() <= now) {
          if (movedOn) {
            if (await closeGift(gift.id, 'converted', { reason: 'profile moved on' })) out.converted++;
            continue;
          }
          if (!(await closeGift(gift.id, 'ended'))) continue;
          await downgradeIfStillGifted(gift);
          resolveEndingNotice(gift.host_id);
          await endedNotice(profile, gift);
          await crmEvent(gift.host_id, 'gift_ended', 'Gifted Pro ended', { gift_id: gift.id });
          out.ended++;
          continue;
        }

        if (movedOn) continue;
        const daysLeft = Math.ceil((new Date(gift.ends_at).getTime() - now) / DAY_MS);
        const done = gift.ending_notified_days || [];
        if (!ENDING_DAYS.includes(daysLeft) || done.includes(daysLeft)) continue;
        // Mark before sending: a failed mark must not turn into an hourly resend.
        // ponytail: no compare-and-set — runIfDue's lease means one runner at a time.
        const { data: claimed } = await supabaseAdmin.from('plan_gifts')
          .update({ ending_notified_days: [...done, daysLeft], updated_at: nowIso() })
          .eq('id', gift.id).eq('status', 'active')
          .select('id').maybeSingle();
        if (!claimed) continue;
        await notify('PLAN_GIFT_ENDING', profile, gift, {
          emailData: { days_left: daysLeft, ends_in: daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days` },
          inApp: {
            title: daysLeft === 1 ? 'Your gifted Pro ends tomorrow' : `Your gifted Pro ends in ${daysLeft} days`,
            body: `It ends on ${fmtDate(gift.ends_at)}. Go Pro to keep everything you have now.`,
            link: '/dashboard/upgrade',
          },
        });
        out.ending++;
      } catch (e) {
        console.error('[gift] expiry failed for gift', gift.id, e.message);
      }
    }
    if (out.ending || out.ended || out.converted) {
      console.log(`Gifted Pro: ${out.ending} ending notice(s), ${out.ended} ended, ${out.converted} closed as converted`);
    }
  } catch (e) {
    console.error('[gift] expiry (non-fatal):', e.message);
  }
  return out;
}

module.exports = {
  TENURES, MAX_BATCH, ENDING_DAYS, GiftError,
  addMonths, tenureLabel, ineligibleReason,
  getActiveGift, giftForSession, giftedHostIds,
  checkEligibility, grantGift, extendGift, revokeGift, listGifts,
  submitShare, reviewShare, isShareUrl, redeemForward, mintForwardCode,
  endOnPaid, processGiftExpiry,
};
