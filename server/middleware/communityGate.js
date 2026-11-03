/**
 * Community access layer.
 *   reads : optionalProtect, communityGate
 *   writes: protect, communityGate, requireWrites, requireTerms
 * Flags `community` / `community_writes` are FAIL-CLOSED (services/featureFlags.js).
 * While a flag is off, early-access members and staff/official badges still pass
 * (pre-launch testing). The member row is loaded at most once per request and
 * cached on req.communityMember (null = no row / table not migrated yet).
 */
const rateLimit = require('express-rate-limit');
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('../services/featureFlags');
const { makeRateLimitStore } = require('./rateLimitStore');
const { skipWhenOpen } = require('./security');

const CURRENT_TERMS_VERSION = '2026-11-v1';
const BADGED = ['official', 'staff'];

const loadMember = async (req) => {
  if (req.communityMember !== undefined) return req.communityMember;
  let member = null;
  if (req.user?.id) {
    // Error (incl. "relation does not exist" before the migration) -> null: fail closed.
    const { data } = await supabaseAdmin
      .from('community_members')
      .select('user_id, terms_version, terms_accepted_at, badge, banned_until, early_access, links_allowed, email_replies, post_count, comment_count')
      .eq('user_id', req.user.id)
      .maybeSingle();
    member = data || null;
  }
  req.communityMember = member;
  return member;
};

const hasEarlyAccess = (m) => !!m && (!!m.early_access || BADGED.includes(m.badge));

const isEarlyAccess = async (userId) => hasEarlyAccess(await loadMember({ user: { id: userId } }));

const communityGate = async (req, res, next) => {
  try {
    if (await isFeatureEnabled('community')) return next();
    if (hasEarlyAccess(await loadMember(req))) return next();
  } catch (_) { /* fail closed */ }
  return res.status(404).json({ message: 'Not found' });
};

const requireWrites = async (req, res, next) => {
  try {
    if (await isFeatureEnabled('community_writes')) return next();
    if (hasEarlyAccess(await loadMember(req))) return next();
  } catch (_) { /* fail closed */ }
  return res.status(503).json({
    message: 'This feature is currently turned off. Please try again later.',
    feature_disabled: 'community_writes',
  });
};

const requireTerms = async (req, res, next) => {
  try {
    const m = await loadMember(req);
    // NULL terms_version (trigger-created row) or no row = terms not accepted.
    if (!m || m.terms_version !== CURRENT_TERMS_VERSION) {
      return res.status(403).json({ code: 'COMMUNITY_TERMS_REQUIRED', terms_version: CURRENT_TERMS_VERSION });
    }
    if (m.banned_until && new Date(m.banned_until).getTime() > Date.now()) {
      return res.status(403).json({ code: 'COMMUNITY_BANNED' });
    }
    return next();
  } catch (_) {
    return res.status(403).json({ code: 'COMMUNITY_TERMS_REQUIRED', terms_version: CURRENT_TERMS_VERSION });
  }
};

// Per-account hourly caps (same shape as uploadLimiter; `protect` runs first).
const hourly = (name, max, message) => rateLimit({
  store: makeRateLimitStore(name),
  windowMs: 60 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message },
  skip: skipWhenOpen,
});

const postLimiter = hourly('community_post', 10, 'You are posting too fast. Please try again later.');
const commentLimiter = hourly('community_comment', 60, 'You are commenting too fast. Please try again later.');
const reactionLimiter = hourly('community_reaction', 300, 'Too many reactions. Please try again later.');
const reportLimiter = hourly('community_report', 20, 'Too many reports. Please try again later.');

module.exports = {
  CURRENT_TERMS_VERSION,
  communityGate,
  requireWrites,
  requireTerms,
  isEarlyAccess,
  postLimiter,
  commentLimiter,
  reactionLimiter,
  reportLimiter,
};
