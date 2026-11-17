// Memberships — host-side program + tier management (M2).
// One membership program per host, up to 3 tiers (<=1 free), monthly billing.
// Entitlement/teaser gating lives in services/community/entitlement.js (M1); this
// file is pure CRUD + the publish guard. Paid joins (Razorpay) are M6.
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const store = require('../services/community/store');
const razorpayConfig = require('../services/razorpayConfig');
const { fetchSubscription } = require('../services/razorpaySubscriptions');
const billing = require('../services/membershipBillingService');
const membershipNotify = require('../services/community/membershipNotify');

const MAX_TIERS = 3;

const publicTier = (t) => ({
  id: t.id, name: t.name, type: t.type, price_inr: t.price_inr,
  billing_period: t.billing_period, perks: Array.isArray(t.perks) ? t.perks : [],
});

// ponytail: schema-fallback — if v3.218 isn't applied yet, Supabase returns a
// "relation does not exist" error. Reads degrade to "no program", writes soft-503,
// so a missing migration never 500s. (Same convention as courseController.)
const MISSING_TABLE_RE = /relation .* does not exist|Could not find the table|schema cache/i;
const isMissingTable = (err) => err && MISSING_TABLE_RE.test(err.message || '');
// Postgres unique_violation — hit when a 2nd free tier races the uq_membership_free_tier index.
const isUniqueViolation = (err) => err && (err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || ''));

const sanitizePerks = (perks) =>
  Array.isArray(perks) ? perks.map((p) => String(p).slice(0, 200)).filter(Boolean).slice(0, 12) : [];

// ── GET /api/memberships/mine ─────────────────────────────────
// Host's own program + tiers (draft or live). Returns { program: null } when none.
const getMyMembership = async (req, res) => {
  try {
    const { data: program, error } = await supabaseAdmin
      .from('community_membership_programs')
      .select('*, tiers:community_membership_tiers(*)')
      .eq('host_id', req.user.id)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return res.json({ program: null });
      return safeError(res, error);
    }
    if (program?.tiers) program.tiers.sort((a, b) => (a.position || 0) - (b.position || 0));
    res.json({ program: program || null });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships ─────────────────────────────────────
// Create OR update the caller's one program (idempotent on host_id).
const upsertProgram = async (req, res) => {
  try {
    const { name, blurb, cover_url } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    const row = {
      host_id: req.user.id,
      name: String(name).slice(0, 120),
      blurb: blurb ? String(blurb).slice(0, 600) : null,
      cover_url: cover_url || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin
      .from('community_membership_programs')
      .upsert(row, { onConflict: 'host_id' })
      .select('*, tiers:community_membership_tiers(*)')
      .single();
    if (error) {
      if (isMissingTable(error)) return res.status(503).json({ message: 'Memberships are not available yet.' });
      return safeError(res, error);
    }
    res.status(201).json({ program: data });
  } catch (error) { safeError(res, error); }
};

// Load the caller's program id, or null. Used to scope tier writes to the owner.
const callerProgramId = async (hostId) => {
  const { data } = await supabaseAdmin
    .from('community_membership_programs').select('id').eq('host_id', hostId).maybeSingle();
  return data?.id || null;
};

// ── POST /api/memberships/tiers ───────────────────────────────
const addTier = async (req, res) => {
  try {
    const programId = await callerProgramId(req.user.id);
    if (!programId) return res.status(400).json({ message: 'Create your membership program first.' });

    const { name, type, price_inr, perks } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    if (!['free', 'paid'].includes(type)) return res.status(400).json({ message: 'type must be free or paid' });
    const price = type === 'paid' ? Math.round(Number(price_inr)) : null;
    if (type === 'paid' && !(price > 0)) return res.status(400).json({ message: 'paid tier needs a price' });

    // Cap: <=3 tiers per program.
    const { count } = await supabaseAdmin
      .from('community_membership_tiers')
      .select('id', { count: 'exact', head: true }).eq('program_id', programId);
    if ((count || 0) >= MAX_TIERS) return res.status(400).json({ message: `A program can have at most ${MAX_TIERS} tiers.` });

    const { data, error } = await supabaseAdmin.from('community_membership_tiers').insert({
      program_id: programId, name: String(name).slice(0, 80), type,
      price_inr: price, perks: sanitizePerks(perks), position: count || 0, status: 'draft',
    }).select().single();
    if (error) {
      if (isUniqueViolation(error)) return res.status(400).json({ message: 'You can have only one free tier.' });
      if (isMissingTable(error)) return res.status(503).json({ message: 'Memberships are not available yet.' });
      return safeError(res, error);
    }
    res.status(201).json({ tier: data });
  } catch (error) { safeError(res, error); }
};

// Guard a tier write to a tier the caller owns; returns the tier's program_id or null.
const ownedTier = async (hostId, tierId) => {
  const { data } = await supabaseAdmin
    .from('community_membership_tiers')
    .select('id, program:community_membership_programs!inner(host_id)')
    .eq('id', tierId).maybeSingle();
  return data && data.program?.host_id === hostId ? data.id : null;
};

// ── PUT /api/memberships/tiers/:id ────────────────────────────
const updateTier = async (req, res) => {
  try {
    if (!(await ownedTier(req.user.id, req.params.id))) return res.status(404).json({ message: 'Tier not found.' });
    const { name, price_inr, perks, status } = req.body;
    const patch = {};
    if (name != null) patch.name = String(name).slice(0, 80);
    if (price_inr != null) patch.price_inr = Math.round(Number(price_inr)) || null; // only meaningful for paid
    if (perks != null) patch.perks = sanitizePerks(perks);
    if (status && ['draft', 'live'].includes(status)) patch.status = status;
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'nothing to update' });
    const { data, error } = await supabaseAdmin
      .from('community_membership_tiers').update(patch).eq('id', req.params.id).select().single();
    if (error) return safeError(res, error);
    res.json({ tier: data });
  } catch (error) { safeError(res, error); }
};

// ── DELETE /api/memberships/tiers/:id ─────────────────────────
const deleteTier = async (req, res) => {
  try {
    if (!(await ownedTier(req.user.id, req.params.id))) return res.status(404).json({ message: 'Tier not found.' });
    const { error } = await supabaseAdmin.from('community_membership_tiers').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships/publish ─────────────────────────────
// Toggle program live/draft. Going live requires >=1 live tier (nothing to join otherwise).
const setPublished = async (req, res) => {
  try {
    const live = !!req.body.live;
    const programId = await callerProgramId(req.user.id);
    if (!programId) return res.status(400).json({ message: 'Create your membership program first.' });
    if (live) {
      const { count } = await supabaseAdmin
        .from('community_membership_tiers')
        .select('id', { count: 'exact', head: true }).eq('program_id', programId).eq('status', 'live');
      if (!(count > 0)) return res.status(400).json({ message: 'Publish at least one tier before going live.' });
    }
    const { data, error } = await supabaseAdmin
      .from('community_membership_programs')
      .update({ status: live ? 'live' : 'draft', updated_at: new Date().toISOString() })
      .eq('id', programId).select().single();
    if (error) return safeError(res, error);
    res.json({ program: data });
  } catch (error) { safeError(res, error); }
};

// ── GET /api/memberships/space/:username ──────────────────────
// Public membership space: live program + live tiers + recent posts as (gated) teasers.
// 404 when the host has no live program. optionalProtect -> viewer rank unlocks in place.
const getPublicSpace = async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase().trim();
    if (!username) return res.status(404).json({ message: 'Not found' });
    const { data: host } = await supabaseAdmin
      .from('profiles').select('id, username, name, profile_image').eq('username', username).maybeSingle();
    if (!host) return res.status(404).json({ message: 'Not found' });

    const { data: program, error } = await supabaseAdmin
      .from('community_membership_programs')
      .select('*, tiers:community_membership_tiers(*)')
      .eq('host_id', host.id).eq('status', 'live').maybeSingle();
    if (error) {
      if (isMissingTable(error)) return res.status(404).json({ message: 'Not found' });
      return safeError(res, error);
    }
    if (!program) return res.status(404).json({ message: 'Not found' });

    const tiers = (program.tiers || [])
      .filter((t) => t.status === 'live').sort((a, b) => (a.position || 0) - (b.position || 0)).map(publicTier);

    // Recent posts as teasers (hydrateItems gates per viewer). Soft-fail if community isn't live.
    let posts = [];
    try {
      const rows = await store.listAuthorPosts({ authorId: host.id, limit: 10 });
      posts = await store.hydrateItems(rows, req.user?.id || null);
    } catch (_) { posts = []; }

    // Viewer's current membership for this host (drives "you're a member" state).
    let viewerMembership = null;
    if (req.user?.id) {
      const { data: sub } = await supabaseAdmin
        .from('community_membership_subscriptions')
        .select('tier_id, status')
        .eq('member_id', req.user.id).eq('host_id', host.id).in('status', ['active', 'past_due']).maybeSingle();
      viewerMembership = sub || null;
    }

    res.json({
      host: { username: host.username, name: host.name, avatar_url: host.profile_image || null },
      program: { name: program.name, blurb: program.blurb, cover_url: program.cover_url },
      tiers, posts, viewer_membership: viewerMembership,
    });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships/join ────────────────────────────────
// Free-tier join: instant, no payment. Paid joins go through Razorpay (M6).
const joinFree = async (req, res) => {
  try {
    const { tier_id: tierId } = req.body || {};
    if (!tierId) return res.status(400).json({ message: 'tier_id is required' });
    const { data: tier, error } = await supabaseAdmin
      .from('community_membership_tiers')
      .select('id, name, type, status, program:community_membership_programs!inner(host_id, status)')
      .eq('id', tierId).maybeSingle();
    if (error) {
      if (isMissingTable(error)) return res.status(503).json({ message: 'Memberships are not available yet.' });
      return safeError(res, error);
    }
    if (!tier || tier.type !== 'free' || tier.status !== 'live' || tier.program?.status !== 'live') {
      return res.status(400).json({ message: 'This tier is not open to join.' });
    }
    const hostId = tier.program.host_id;
    if (hostId === req.user.id) return res.status(400).json({ message: 'You cannot join your own membership.' });

    const { data: sub, error: insErr } = await supabaseAdmin
      .from('community_membership_subscriptions')
      .insert({ member_id: req.user.id, host_id: hostId, tier_id: tier.id, status: 'active' })
      .select().single();
    if (insErr) {
      if (isUniqueViolation(insErr)) return res.status(409).json({ message: 'You are already a member.' });
      return safeError(res, insErr);
    }
    membershipNotify.newMember({ hostId, tierName: tier.name });
    res.status(201).json({ subscription: sub });
  } catch (error) { safeError(res, error); }
};

// Load a joinable paid tier for the caller, or answer + return null.
const loadJoinablePaidTier = async (req, res, tierId) => {
  if (!tierId) { res.status(400).json({ message: 'tier_id is required' }); return null; }
  const { data: tier, error } = await supabaseAdmin
    .from('community_membership_tiers')
    .select('id, name, type, status, price_inr, razorpay_plan_id_monthly, program:community_membership_programs!inner(host_id, status)')
    .eq('id', tierId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) res.status(503).json({ message: 'Memberships are not available yet.' });
    else safeError(res, error);
    return null;
  }
  if (!tier || tier.type !== 'paid' || tier.status !== 'live' || tier.program?.status !== 'live') {
    res.status(400).json({ message: 'This tier is not open to join.' }); return null;
  }
  if (tier.program.host_id === req.user.id) { res.status(400).json({ message: 'You cannot join your own membership.' }); return null; }
  return tier;
};

// ── POST /api/memberships/subscribe ───────────────────────────
// Start a paid membership: mint/verify the tier's Razorpay plan + a subscription.
// The webhook (notes.kind === 'membership') grants entitlement on charge.
const createPaidSubscription = async (req, res) => {
  try {
    const tier = await loadJoinablePaidTier(req, res, req.body?.tier_id);
    if (!tier) return;
    const hostId = tier.program.host_id;

    const { data: current } = await supabaseAdmin
      .from('community_membership_subscriptions').select('id')
      .eq('member_id', req.user.id).eq('host_id', hostId).in('status', ['active', 'past_due']).maybeSingle();
    if (current) return res.status(409).json({ message: 'You already have a membership with this host.' });

    const sub = await billing.startPaidSubscription({ tier, memberId: req.user.id, hostId });
    res.status(201).json({ subscription_id: sub.id, key: await razorpayConfig.getKeyId() });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships/subscription/sync ───────────────────
// On-return fallback when the webhook lags: fetch the subscription and activate if live.
const syncPaidSubscription = async (req, res) => {
  try {
    const { subscription_id: subId } = req.body || {};
    if (!subId) return res.status(400).json({ message: 'subscription_id is required' });
    const rzpSub = await fetchSubscription(subId);
    if (rzpSub?.notes?.member_id !== req.user.id) return res.status(403).json({ message: 'Not your subscription.' });
    if (['active', 'authenticated', 'charged'].includes(rzpSub.status)) {
      await billing.activateFromSubscription({ rzpSub });
    }
    const { data: sub } = await supabaseAdmin
      .from('community_membership_subscriptions').select('tier_id, status')
      .eq('razorpay_subscription_id', subId).maybeSingle();
    res.json({ membership: sub || null });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships/cancel ──────────────────────────────
// Cancel at cycle end (access continues until period end). { host_id }.
const cancelSubscription = async (req, res) => {
  try {
    const hostId = req.body?.host_id;
    if (!hostId) return res.status(400).json({ message: 'host_id is required' });
    const r = await billing.cancelForMember({ memberId: req.user.id, hostId });
    if (!r.canceled) return res.status(404).json({ message: 'No active membership to cancel.' });
    res.json({ ok: true });
  } catch (error) { safeError(res, error); }
};

// Batch-load minimal public profile fields for a set of ids (never leak email/phone).
const loadProfiles = async (ids) => {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await supabaseAdmin
    .from('profiles').select('id, name, first_name, username, profile_image').in('id', uniq);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
};

// ── GET /api/memberships/members ──────────────────────────────
// Host dashboard: subscribers + MRR snapshot + status/tier counts.
const getHostMembers = async (req, res) => {
  try {
    const programId = await callerProgramId(req.user.id);
    if (!programId) return res.json({ members: [], mrr: 0, counts: {} });
    const { data: subs, error } = await supabaseAdmin
      .from('community_membership_subscriptions')
      .select('id, member_id, status, current_period_end, started_at, tier:community_membership_tiers(name, type, price_inr)')
      .eq('host_id', req.user.id).order('started_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) return res.json({ members: [], mrr: 0, counts: {} });
      return safeError(res, error);
    }
    const profiles = await loadProfiles((subs || []).map((s) => s.member_id));
    const current = (subs || []).filter((s) => ['active', 'past_due'].includes(s.status));
    const mrr = current.reduce((sum, s) => sum + (s.tier?.type === 'paid' ? (s.tier.price_inr || 0) : 0), 0);
    const counts = (subs || []).reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
    const members = (subs || []).map((s) => ({
      id: s.id, status: s.status, current_period_end: s.current_period_end, started_at: s.started_at,
      tier: s.tier ? { name: s.tier.name, type: s.tier.type, price_inr: s.tier.price_inr } : null,
      member: (() => { const p = profiles[s.member_id]; return p ? { name: p.first_name || p.name || 'Member', avatar_url: p.profile_image || null } : { name: 'Member', avatar_url: null }; })(),
    }));
    res.json({ members, mrr, counts, member_count: current.length });
  } catch (error) { safeError(res, error); }
};

// ── GET /api/memberships/my-subscriptions ─────────────────────
// Member surface: my memberships across hosts (tier, renewal, status) + cancel target.
const getMySubscriptions = async (req, res) => {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('community_membership_subscriptions')
      .select('id, host_id, status, current_period_end, started_at, razorpay_subscription_id, tier:community_membership_tiers(name, type, price_inr)')
      .eq('member_id', req.user.id).order('started_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) return res.json({ subscriptions: [] });
      return safeError(res, error);
    }
    const profiles = await loadProfiles((subs || []).map((s) => s.host_id));
    const subscriptions = (subs || []).map((s) => {
      const h = profiles[s.host_id];
      return {
        id: s.id, host_id: s.host_id, status: s.status,
        current_period_end: s.current_period_end, started_at: s.started_at,
        paid: !!s.razorpay_subscription_id,
        host: h ? { name: h.name || h.username || 'Host', username: h.username, avatar_url: h.profile_image || null } : null,
        tier: s.tier ? { name: s.tier.name, type: s.tier.type, price_inr: s.tier.price_inr } : null,
      };
    });
    res.json({ subscriptions });
  } catch (error) { safeError(res, error); }
};

module.exports = {
  getMyMembership, upsertProgram, addTier, updateTier, deleteTier, setPublished,
  getPublicSpace, joinFree, createPaidSubscription, syncPaidSubscription, cancelSubscription,
  getHostMembers, getMySubscriptions,
};
