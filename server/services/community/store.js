'use strict';
// Community data access: one function per DB action, all through run()/runCount(),
// which turn "table missing" (v3.185 not applied yet) into code COMMUNITY_UNAVAILABLE.
// Counters, last_activity_at and member counts are DB-trigger owned: never written here.

const { supabaseAdmin } = require('../../config/supabase');
const { computeIndexable } = require('./indexable');
const { bustSitemapCache } = require('../../utils/sitemapCache');

const MISSING = /relation .* does not exist|Could not find the table/i;
const PROFILE_COLS = 'id, is_host, is_verified, created_at, username, name, first_name, profile_image, is_banned';
const MEMBER_COLS = 'user_id, terms_version, terms_accepted_at, badge, banned_until, early_access, links_allowed, email_replies, post_count, comment_count';
const WEEK_MS = 7 * 24 * 3600 * 1000;

const db = (table) => supabaseAdmin.from(table);

function check(result) {
  const { error } = result;
  if (!error) return result;
  const e = new Error(error.message || 'Database error');
  e.code = error.code === '42P01' || MISSING.test(error.message || '') ? 'COMMUNITY_UNAVAILABLE' : error.code;
  throw e;
}
const run = async (query) => check(await query).data;
const runCount = async (query) => check(await query).count || 0;

const withEq = (query, eqs) => Object.entries(eqs).reduce((q, [k, v]) => q.eq(k, v), query);

// §10.3: links unlock for flagged members, verified hosts, or week-old accounts with >= 3 items.
function linksAllowed(profile, member) {
  if (member?.links_allowed) return true;
  if (profile?.is_host && profile?.is_verified) return true;
  const age = Date.now() - new Date(profile?.created_at).getTime();
  return age >= WEEK_MS && (member?.post_count || 0) + (member?.comment_count || 0) >= 3;
}

const getProfile = (id) => run(db('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle());
const getMember = (userId) => run(db('community_members').select(MEMBER_COLS).eq('user_id', userId).maybeSingle());

const acceptTerms = (userId, version) => run(db('community_members')
  .upsert({ user_id: userId, terms_version: version, terms_accepted_at: new Date().toISOString() }, { onConflict: 'user_id' })
  .select(MEMBER_COLS).single());

const getSpaceByKey = (key) => run(db('community_spaces').select('*').eq('key', key).eq('is_active', true).maybeSingle());
const getSpaceById = (id) => run(db('community_spaces').select('*').eq('id', id).maybeSingle());

async function insertPost(row, makeSlug) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run(db('community_posts').insert({ ...row, slug: makeSlug() }).select('*').single());
    } catch (e) {
      if (e.code !== '23505' || attempt > 0) throw e; // slug collision: retry once with a fresh suffix
    }
  }
}
const getPost = (id) => run(db('community_posts').select('*').eq('id', id).maybeSingle());
// `where` adds guard columns (e.g. {status:'visible'}) so racing writers can't clobber state.
const updatePost = (id, patch, where = {}) => run(withEq(db('community_posts').update(patch).eq('id', id), where).select('*').maybeSingle());

const insertMedia = (rows) => (rows.length ? run(db('community_media').insert(rows).select('*')) : []);
const listMedia = async (postId) => (await run(db('community_media').select('*').eq('post_id', postId).order('position'))) || [];

const resolveUsernames = async (usernames) => (usernames.length
  ? (await run(db('profiles').select('id, username').in('username', usernames))) || []
  : []);
const insertMentions = (rows) => (rows.length ? run(db('community_mentions').insert(rows)) : null);

const getComment = (id) => run(db('community_comments').select('*').eq('id', id).maybeSingle());
const insertComment = (row) => run(db('community_comments').insert(row).select('*').single());
const updateComment = (id, patch, where = {}) => run(withEq(db('community_comments').update(patch).eq('id', id), where).select('*').maybeSingle());

async function addReaction(userId, targetType, targetId) {
  try {
    await run(db('community_reactions').insert({ user_id: userId, target_type: targetType, target_id: targetId }));
  } catch (e) {
    if (e.code !== '23505') throw e; // already liked: idempotent
  }
}
const removeReaction = (userId, targetType, targetId) => run(db('community_reactions').delete()
  .eq('user_id', userId).eq('target_type', targetType).eq('target_id', targetId));

// true = new report, false = this reporter already reported this target.
async function insertReport(row) {
  try {
    await run(db('community_reports').insert(row));
    return true;
  } catch (e) {
    if (e.code === '23505') return false;
    throw e;
  }
}
const countOpenReports = (targetType, targetId) => runCount(db('community_reports')
  .select('id', { count: 'exact', head: true })
  .eq('target_type', targetType).eq('target_id', targetId).eq('status', 'open'));

async function authorBanned(authorId) {
  if (!authorId) return false;
  const [member, profile] = await Promise.all([
    run(db('community_members').select('banned_until').eq('user_id', authorId).maybeSingle()),
    run(db('profiles').select('is_banned').eq('id', authorId).maybeSingle()),
  ]);
  return !!profile?.is_banned || (!!member?.banned_until && new Date(member.banned_until).getTime() > Date.now());
}

// Context for visibility.canView: author ban + a block in either direction.
async function viewContext(viewerId, authorId) {
  const ctx = { viewerId, bannedAuthorIds: new Set(), blockedPairs: new Set() };
  if (!authorId) return ctx;
  if (await authorBanned(authorId)) ctx.bannedAuthorIds.add(authorId);
  if (viewerId && viewerId !== authorId) {
    const rows = await run(db('community_blocks').select('blocker_id, blocked_id')
      .or(`and(blocker_id.eq.${viewerId},blocked_id.eq.${authorId}),and(blocker_id.eq.${authorId},blocked_id.eq.${viewerId})`));
    for (const b of rows || []) ctx.blockedPairs.add(`${b.blocker_id}:${b.blocked_id}`);
  }
  return ctx;
}

// §7.5: recompute is_indexable from the stored row (comment_count = visible replies, trigger-kept).
async function refreshIndexable(postId) {
  const p = await getPost(postId);
  if (!p) return false;
  let others = db('community_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId).eq('status', 'visible');
  if (p.author_id) others = others.or(`author_id.is.null,author_id.neq.${p.author_id}`);
  const next = computeIndexable({
    ...p,
    authorBanned: await authorBanned(p.author_id),
    visibleReplies: p.comment_count || 0,
    otherVisibleReplies: p.kind === 'thread' ? await runCount(others) : 0,
  });
  if (next !== p.is_indexable) {
    await run(db('community_posts').update({ is_indexable: next }).eq('id', postId));
    bustSitemapCache();
  }
  return next;
}

module.exports = {
  linksAllowed, getProfile, getMember, acceptTerms, getSpaceByKey, getSpaceById,
  insertPost, getPost, updatePost, insertMedia, listMedia, resolveUsernames, insertMentions,
  getComment, insertComment, updateComment, addReaction, removeReaction,
  insertReport, countOpenReports, viewContext, refreshIndexable,
};
