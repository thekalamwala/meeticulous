'use strict';
// Community data access: one function per DB action, all through run()/runCount(),
// which turn "table missing" (v3.185 not applied yet) into code COMMUNITY_UNAVAILABLE.
// Counters, last_activity_at and member counts are DB-trigger owned: never written here.

const { supabaseAdmin } = require('../../config/supabase');
const { computeIndexable } = require('./indexable');
const { bustSitemapCache } = require('../../utils/sitemapCache');
const { serializeItem, serializeComment } = require('./serialize');

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

// §10.3: links unlock for flagged members, verified hosts, or week-old accounts with >= 3
// VISIBLE posts/comments (member.post_count counts every status, so count live rows).
async function linksAllowed(profile, member) {
  if (member?.links_allowed) return true;
  if (profile?.is_host && profile?.is_verified) return true;
  if (!profile?.id || !(Date.now() - new Date(profile.created_at).getTime() >= WEEK_MS)) return false;
  let visible = 0;
  for (const table of ['community_posts', 'community_comments']) {
    visible += await runCount(db(table).select('id', { count: 'exact', head: true }).eq('author_id', profile.id).eq('status', 'visible'));
    if (visible >= 3) return true;
  }
  return false;
}

const getProfile = (id) => run(db('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle());
const getMember = (userId) => run(db('community_members').select(MEMBER_COLS).eq('user_id', userId).maybeSingle());

const acceptTerms = (userId, version) => run(db('community_members')
  .upsert({ user_id: userId, terms_version: version, terms_accepted_at: new Date().toISOString() }, { onConflict: 'user_id' })
  .select(MEMBER_COLS).single());

// Update a member's notification preferences (email on replies/mentions).
// Upsert so a reader who never posted can still set it (a member row is created).
const updateMemberPrefs = (userId, patch) => run(db('community_members')
  .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
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

// Host card stats for the community home left rail: lifetime bookings, active
// services, and the host's own rating (avg of reviews where they're the subject).
// Core tables (always present) queried directly; each count fails soft to 0/null
// so a hiccup never breaks the rail.
const hostCard = async (uid) => {
  const safe = (p) => Promise.resolve(p).then((r) => r || {}).catch(() => ({}));
  const [bk, sv, rv] = await Promise.all([
    safe(db('bookings').select('id', { count: 'exact', head: true }).eq('host_id', uid)),
    safe(db('services').select('id', { count: 'exact', head: true }).eq('host_id', uid)),
    safe(db('reviews').select('rating').eq('subject_id', uid)),
  ]);
  const ratings = (rv.data || []).map((r) => r.rating).filter((n) => Number.isFinite(n));
  const reviews = ratings.length;
  return {
    bookings: bk.count || 0,
    services: sv.count || 0,
    reviews,
    rating: reviews ? Math.round((ratings.reduce((s, n) => s + n, 0) / reviews) * 10) / 10 : null,
  };
};

// Taggable members for the @mention typeahead: hosts + the Meeticulous team
// (community_members.badge official/staff) + everyone who has joined the
// community (a community_members row). Empty `q` lists the first few.
// ponytail: fetch-then-filter in JS; fine at current scale. If the member set
// grows large, replace with an indexed OR-query / a materialised taggable view.
const searchMentionable = async (q, { limit = 8 } = {}) => {
  const term = String(q || '').trim().replace(/[^a-z0-9 ._-]/gi, '').slice(0, 30);
  const base = db('profiles')
    .select('id, username, name, first_name, profile_image, is_host')
    .eq('is_banned', false)
    .not('username', 'is', null);
  const [profiles, members] = await Promise.all([
    run(term ? base.or(`username.ilike.*${term}*,name.ilike.*${term}*`).limit(40) : base.limit(60)),
    run(db('community_members').select('user_id, badge')),
  ]);
  const badgeBy = new Map((members || []).map((m) => [m.user_id, m.badge]));
  const memberSet = new Set((members || []).map((m) => m.user_id));
  return (profiles || [])
    .filter((p) => p.is_host || memberSet.has(p.id))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      username: p.username,
      name: p.name || p.first_name || p.username,
      avatar_url: p.profile_image || null,
      role: badgeBy.get(p.id) ? 'staff' : (p.is_host ? 'host' : 'guest'),
    }));
};

const getComment = (id) => run(db('community_comments').select('*').eq('id', id).maybeSingle());
const insertComment = (row) => run(db('community_comments').insert(row).select('*').single());
// How many comments `authorId` has on a post — Tithi's first-responder dedup (0 = not yet replied).
const countCommentsByAuthorOnPost = (postId, authorId) => runCount(db('community_comments')
  .select('id', { count: 'exact', head: true }).eq('post_id', postId).eq('author_id', authorId));
// Tithi's comment-thread first-responder: dedup (replies by Tithi under a comment) and
// human-already-answered (any visible reply under a comment).
const countRepliesByAuthor = (commentId, authorId) => runCount(db('community_comments')
  .select('id', { count: 'exact', head: true }).eq('parent_id', commentId).eq('author_id', authorId));
const countReplies = (commentId) => runCount(db('community_comments')
  .select('id', { count: 'exact', head: true }).eq('parent_id', commentId).eq('status', 'visible'));
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

// Save / unsave a post (bookmark). PK (user_id, post_id) makes a double-save idempotent;
// save_count is DB-trigger owned. Returns the save_count the trigger left on the post.
async function addSave(userId, postId) {
  try { await run(db('community_saves').insert({ user_id: userId, post_id: postId })); }
  catch (e) { if (e.code !== '23505') throw e; } // already saved: idempotent
  return (await getPost(postId))?.save_count ?? null;
}
const removeSave = async (userId, postId) => {
  await run(db('community_saves').delete().eq('user_id', userId).eq('post_id', postId));
  return (await getPost(postId))?.save_count ?? null;
};
const savedIds = async (userId, postIds) => {
  if (!userId || !postIds.length) return new Set();
  const rows = await run(db('community_saves').select('post_id').eq('user_id', userId).in('post_id', postIds));
  return new Set((rows || []).map((r) => r.post_id));
};

// Block / unblock a member. PK (blocker_id, blocked_id); self-block and dup are no-ops.
async function addBlock(blockerId, blockedId) {
  if (!blockedId || blockerId === blockedId) return false;
  try { await run(db('community_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId })); return true; }
  catch (e) { if (e.code === '23505') return true; throw e; }
}
const removeBlock = (blockerId, blockedId) => run(db('community_blocks').delete()
  .eq('blocker_id', blockerId).eq('blocked_id', blockedId));

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

// ---- Reads (feed / spaces / detail / comments) ----
const uniq = (a) => [...new Set(a.filter(Boolean))];
const TTL = 60 * 1000;
const cache = { spaces: null, banned: null, pinned: null };
const fresh = (c) => c && Date.now() - c.at < TTL;
const resetReadCaches = () => { cache.spaces = null; cache.banned = null; cache.pinned = null; };

// All active spaces, cached 60s.
async function listSpaces() {
  if (fresh(cache.spaces)) return cache.spaces.v;
  const v = (await run(db('community_spaces').select('*').eq('is_active', true).order('position'))) || [];
  cache.spaces = { at: Date.now(), v };
  return v;
}

// Banned author ids (community ban window OR account ban), cached 60s. Ids only, never more.
async function bannedAuthorIds() {
  if (fresh(cache.banned)) return cache.banned.v;
  const [m, p] = await Promise.all([
    run(db('community_members').select('user_id').gt('banned_until', new Date().toISOString())),
    run(db('profiles').select('id').eq('is_banned', true)),
  ]);
  const v = new Set([...(m || []).map((r) => r.user_id), ...(p || []).map((r) => r.id)]);
  cache.banned = { at: Date.now(), v };
  return v;
}

// `cur` is a decodeCursor() result (strict ISO + UUID), so interpolating it here is safe.
const keyset = (q, cur, op, col = 'created_at') => (cur
  ? q.or(`${col}.${op}.${cur.ts},and(${col}.eq.${cur.ts},id.${op}.${cur.id})`)
  : q);

// Feed pages, newest first. spaceId = one space's threads; updates = updates space OR announcements.
// sortCol: 'created_at' (feed) or 'last_activity_at' (space threads); the cursor encodes that column.
async function listFeedRows({ cur, limit, spaceId, updates, updatesSpaceId, sortCol = 'created_at' }) {
  let q = db('community_posts').select('*').eq('status', 'visible');
  if (spaceId) q = q.eq('space_id', spaceId).eq('kind', 'thread');
  if (updates) {
    const scope = updatesSpaceId ? `or(space_id.eq.${updatesSpaceId},format.eq.announcement)` : 'format.eq.announcement';
    // One .or() so the scope and keyset groups are ANDed explicitly.
    q = cur
      ? q.or(`and(${scope},or(${sortCol}.lt.${cur.ts},and(${sortCol}.eq.${cur.ts},id.lt.${cur.id})))`)
      : q.or(scope);
  } else {
    q = keyset(q, cur, 'lt', sortCol);
  }
  return (await run(q.order(sortCol, { ascending: false }).order('id', { ascending: false }).limit(limit))) || [];
}

// Currently pinned posts, cached 60s (a pin expiring mid-window is fine for a minute).
async function listPinned(limit = 5) {
  if (fresh(cache.pinned)) return cache.pinned.v;
  const nowIso = new Date().toISOString();
  const v = (await run(db('community_posts').select('*').eq('status', 'visible').eq('is_pinned', true)
    .or(`pinned_until.is.null,pinned_until.gt.${nowIso}`)
    .order('created_at', { ascending: false }).limit(limit))) || [];
  cache.pinned = { at: Date.now(), v };
  return v;
}

const getPostBySlug = (slug) => run(db('community_posts').select('*').eq('slug', slug).maybeSingle());

// One author's visible posts / comments, newest first (public-profile Feed).
// Keyset-paged on created_at like the main feed; visibility (author ban) is
// applied by the caller via filterVisible, so we over-fetch at the controller.
async function listAuthorPosts({ authorId, cur, limit }) {
  const q = keyset(db('community_posts').select('*').eq('status', 'visible').eq('author_id', authorId), cur, 'lt');
  return (await run(q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit))) || [];
}
async function listAuthorComments({ authorId, cur, limit }) {
  const q = keyset(db('community_comments').select('*').eq('status', 'visible').eq('author_id', authorId), cur, 'lt');
  return (await run(q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit))) || [];
}

// Minimal parent-post context (slug/kind/title/status) for a set of comment
// post_ids, so the Feed can link "replied on <title>". Never leaks body.
async function postContexts(postIds) {
  const ids = uniq(postIds);
  if (!ids.length) return new Map();
  const rows = (await run(db('community_posts').select('id, slug, kind, title, status').in('id', ids))) || [];
  return new Map(rows.map((r) => [r.id, r]));
}

// Oldest first; tombstones (deleted/removed) are returned, visibility is applied by the caller.
async function listCommentRows(postId, cur, limit) {
  const q = keyset(db('community_comments').select('*').eq('post_id', postId), cur, 'gt');
  return (await run(q.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(limit))) || [];
}

// Recent top-level comments (parent_id null), newest first — the Phase 2 comment-sweep's
// candidate questions. We trust the comment's own 'visible' status; parent-post visibility
// is left to the caller. ponytail: a visible comment under a removed post is rare.
async function listRecentTopLevelComments({ limit = 20 } = {}) {
  const rows = await run(db('community_comments')
    .select('id, post_id, author_id, body, status, parent_id, created_at')
    .is('parent_id', null).eq('status', 'visible')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit));
  return rows || [];
}

// One profiles + one members query per page. Never selects phone/email.
// `dualIds` = host authors who have ALSO booked as a guest (bookings.guest_id),
// so the card can mark them 'host_guest'. One extra `.in()` on the host subset.
async function loadAuthors(ids) {
  const list = uniq(ids);
  if (!list.length) return { profiles: new Map(), members: new Map(), dualIds: new Set() };
  const [p, m] = await Promise.all([
    run(db('profiles').select('id, name, first_name, username, profile_image, is_host, is_banned').in('id', list)),
    run(db('community_members').select('user_id, badge').in('user_id', list)),
  ]);
  const hostIds = (p || []).filter((r) => r.is_host).map((r) => r.id);
  const dualRows = hostIds.length
    ? await run(db('bookings').select('guest_id').in('guest_id', hostIds))
    : [];
  return {
    profiles: new Map((p || []).map((r) => [r.id, r])),
    members: new Map((m || []).map((r) => [r.user_id, r])),
    dualIds: new Set((dualRows || []).map((r) => r.guest_id)),
  };
}

async function loadMediaByPost(postIds) {
  const map = new Map();
  if (!postIds.length) return map;
  for (const m of (await run(db('community_media').select('*').in('post_id', postIds).order('position'))) || []) {
    if (!map.has(m.post_id)) map.set(m.post_id, []);
    map.get(m.post_id).push(m);
  }
  return map;
}

// Exactly one query per call; anonymous viewers never reach the table.
async function likedIds(userId, targetType, ids) {
  if (!userId || !ids.length) return new Set();
  const rows = await run(db('community_reactions').select('target_id')
    .eq('user_id', userId).eq('target_type', targetType).in('target_id', ids));
  return new Set((rows || []).map((r) => r.target_id));
}

// Batch-hydrate rows -> serialized items: one query each for authors, members, media, likes (+ cached spaces).
async function hydrateItems(rows, viewerId) {
  const ids = rows.map((r) => r.id);
  const [{ profiles, members, dualIds }, spaces, media, liked, saved] = await Promise.all([
    loadAuthors(rows.map((r) => r.author_id)), listSpaces(), loadMediaByPost(ids),
    likedIds(viewerId, 'post', ids), savedIds(viewerId, ids),
  ]);
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  return rows.map((r) => serializeItem(r, {
    author: profiles.get(r.author_id) || null,
    member: members.get(r.author_id) || null,
    space: spaceById.get(r.space_id) || null,
    media: media.get(r.id) || [],
    viewer: { liked: liked.has(r.id), saved: saved.has(r.id) },
    dual: dualIds.has(r.author_id),
  }));
}

async function hydrateComments(rows, viewerId) {
  const [{ profiles, members, dualIds }, liked] = await Promise.all([
    loadAuthors(rows.map((r) => r.author_id)), likedIds(viewerId, 'comment', rows.map((r) => r.id)),
  ]);
  return rows.map((r) => serializeComment(r, {
    author: profiles.get(r.author_id) || null, member: members.get(r.author_id) || null,
    viewer: { liked: liked.has(r.id) }, dual: dualIds.has(r.author_id),
  }));
}

// Sitemap rows (spec §15): indexable visible items. Banned authors are filtered by the caller
// (a ban doesn't recompute is_indexable). ponytail: one query, capped by PostgREST max-rows;
// page with .range() once the community outgrows a single sitemap fetch.
const listIndexableRows = async () => (await run(db('community_posts')
  .select('kind, slug, author_id, last_activity_at').eq('status', 'visible').eq('is_indexable', true)
  .order('last_activity_at', { ascending: false }))) || [];

module.exports = {
  hydrateItems, hydrateComments, listIndexableRows,
  listSpaces, bannedAuthorIds, listFeedRows, listPinned, getPostBySlug, listCommentRows,
  listAuthorPosts, listAuthorComments, postContexts,
  loadAuthors, loadMediaByPost, likedIds, resetReadCaches,
  linksAllowed, getProfile, getMember, acceptTerms, updateMemberPrefs, getSpaceByKey, getSpaceById,
  insertPost, getPost, updatePost, insertMedia, listMedia, resolveUsernames, insertMentions, searchMentionable, hostCard,
  getComment, insertComment, countCommentsByAuthorOnPost, countReplies, countRepliesByAuthor,
  listRecentTopLevelComments, updateComment, addReaction, removeReaction,
  addSave, removeSave, savedIds, addBlock, removeBlock,
  insertReport, countOpenReports, viewContext, refreshIndexable, run, runCount,
};
