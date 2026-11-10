'use strict';
// /api/community write handlers (spec §6 spaces, §7 content model, §10 writing rules).
// Route chain: protect, communityGate, requireWrites, requireTerms (sets req.communityMember), limiter.
// Errors are {code, message}; a missing community table -> 503 COMMUNITY_UNAVAILABLE.

const store = require('../services/community/store');
const notify = require('../services/community/notify');
const { validateDraft, validateComment, checkSafety, makeSlug, extractMentions } = require('../services/community/text');
const { serializeItem, serializeComment } = require('../services/community/serialize');
const { canView, filterVisible, filterVisibleComments } = require('../services/community/visibility');
const { encodeCursor, decodeCursor } = require('../services/community/cursor');
const { setPublicCache } = require('../utils/httpCache');
const { CURRENT_TERMS_VERSION } = require('../middleware/communityGate');
const { bustSitemapCache } = require('../utils/sitemapCache');
const { adminAlert } = require('../utils/adminAlert');

const PHASE1_FORMATS = ['text', 'question', 'announcement'];
// Spec §6/§13: the `official` space policy and announcements are for badge 'official' only.
// Staff keep early access and moderation (communityGate), not announcement rights.
const isOfficial = (member) => member?.badge === 'official';
const EDITABLE = ['visible', 'hidden'];
const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'off_platform', 'defamation', 'illegal', 'other'];
const AUTO_HIDE_AT = 3; // distinct open reports before a visible target is hidden for review
const MAX_MEDIA = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES = {
  INVALID_KIND: 'Choose a post or a thread.',
  FORMAT_NOT_AVAILABLE: "That kind of post isn't available yet.",
  FORMAT_NOT_ALLOWED: 'Only official accounts can post announcements.',
  SPACE_REQUIRED: 'Pick a space for your thread.',
  SPACE_NOT_FOUND: "That space doesn't exist.",
  SPACE_NOT_ALLOWED: "You can't start a thread in this space.",
  REPLY_NOT_ALLOWED: 'Only hosts can reply in this space.',
  MEDIA_NOT_ALLOWED: 'Add up to 4 photos uploaded from Meeticulous.',
  NOT_FOUND: 'Not found.',
  FORBIDDEN: 'You can only change your own content.',
  NOT_EDITABLE: "This can't be changed any more.",
  NOT_A_QUESTION: 'Only questions can have an accepted answer.',
  INVALID_COMMENT: 'Pick a visible reply on this question.',
  INVALID_PARENT: "That reply isn't part of this conversation.",
  INVALID_TARGET: 'Invalid target.',
  INVALID_REASON: 'Choose a reason for the report.',
  INVALID_DETAILS: 'Report details can be at most 1000 characters.',
  CANNOT_REPORT_SELF: "You can't report yourself.",
  COMMUNITY_BANNED: 'You are banned from the community.',
  COMMUNITY_UNAVAILABLE: 'The community is not available right now.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
};
const fail = (res, status, code, message) => res.status(status).json({ code, message: message || MESSAGES[code] || code });

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return fail(res, 503, 'COMMUNITY_UNAVAILABLE');
    console.error('[community]', e.message);
    return fail(res, 500, 'SERVER_ERROR');
  }
};

// Fire-and-forget: a notify failure must never fail the write.
const bg = (fn) => Promise.resolve().then(fn).catch((e) => console.error('[community] notify', e.message));
// Indexability is best-effort after the write landed; the column defaults to false (safe).
const safeRefresh = (postId) => store.refreshIndexable(postId).catch((e) => {
  console.error('[community] refreshIndexable', e.message);
  return false;
});
const now = () => new Date().toISOString();
const isBanned = (m) => !!m?.banned_until && new Date(m.banned_until).getTime() > Date.now();

// Load a row by :id and require the caller to be its author. Responds and returns null on failure.
async function loadOwned(res, load, id, uid) {
  const row = UUID.test(String(id)) ? await load(id) : null;
  if (!row) { fail(res, 404, 'NOT_FOUND'); return null; }
  if (row.author_id !== uid) { fail(res, 403, 'FORBIDDEN'); return null; }
  return row;
}

function mayPost(space, profile, member) {
  if (space.post_policy === 'official') return isOfficial(member);
  if (space.post_policy === 'hosts') return !!profile?.is_host;
  return true;
}

const dim = (v) => (Number.isInteger(v) && v > 0 && v <= 20000 ? v : null);
// Only our own community upload folder; null = reject.
function parseMedia(media) {
  if (media == null || (Array.isArray(media) && !media.length)) return [];
  if (!Array.isArray(media) || media.length > MAX_MEDIA || !process.env.SUPABASE_URL) return null;
  const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/images/community/`;
  const rows = [];
  for (const m of media) {
    const url = typeof m?.url === 'string' ? m.url : '';
    if (!url.startsWith(prefix) || url.includes('..')) return null;
    const alt = typeof m.alt === 'string' && m.alt.trim() ? m.alt.trim().slice(0, 300) : null;
    rows.push({ url, width: dim(m.width), height: dim(m.height), alt });
  }
  return rows;
}

async function recordMentions({ item, comment, text, actorId }) {
  const usernames = extractMentions(text);
  if (!usernames.length) return;
  try {
    // ponytail: exact-case username match; usernames are stored lowercase.
    const users = (await store.resolveUsernames(usernames)).filter((u) => u.id !== actorId);
    if (!users.length) return;
    const target = comment ? { comment_id: comment.id } : { post_id: item.id };
    await store.insertMentions(users.map((u) => ({ ...target, mentioned_user_id: u.id })));
    bg(() => notify.onMentions({ item, comment, usernames: users.map((u) => u.username), actorId }));
  } catch (e) {
    console.error('[community] mentions', e.message); // the item itself is saved; mentions are extra
  }
}

// POST /terms — accept the current guidelines (no requireTerms on this route).
const acceptTerms = handle(async (req, res) => {
  const uid = req.user.id;
  const existing = req.communityMember !== undefined ? req.communityMember : await store.getMember(uid);
  if (isBanned(existing)) return fail(res, 403, 'COMMUNITY_BANNED');
  const member = await store.acceptTerms(uid, CURRENT_TERMS_VERSION);
  req.communityMember = member;

  // Fire welcome on the FIRST acceptance only (any later terms-version bump
  // is an upsert that keeps the row but is not a re-join). isFirstAcceptance
  // = no prior row existed OR the prior row had no terms_accepted_at.
  const isFirstAcceptance = !existing || !existing.terms_accepted_at;
  if (isFirstAcceptance) {
    const profile = await store.getProfile(uid).catch(() => null);
    if (profile) require('../services/community/onboardingSequence')
      .sendWelcome(profile, { isFirstAcceptance: true }).catch(() => null);
  }

  return res.json({ member });
});

// POST /items
const createItem = handle(async (req, res) => {
  const uid = req.user.id;
  const { kind, format = 'text', title, body, space_key: spaceKey, media } = req.body || {};
  if (!['post', 'thread'].includes(kind)) return fail(res, 400, 'INVALID_KIND');
  if (!PHASE1_FORMATS.includes(format)) return fail(res, 400, 'FORMAT_NOT_AVAILABLE');
  const member = req.communityMember || null;
  if (format === 'announcement' && !isOfficial(member)) return fail(res, 403, 'FORMAT_NOT_ALLOWED');
  const mediaRows = parseMedia(media);
  if (!mediaRows) return fail(res, 400, 'MEDIA_NOT_ALLOWED');

  const profile = await store.getProfile(uid);
  const linksAllowed = await store.linksAllowed(profile, member);
  const draft = validateDraft({ kind, format, title, body }, { linksAllowed });
  if (!draft.ok) return fail(res, 400, draft.code, draft.message);
  const altIssue = checkSafety(mediaRows.map((m) => m.alt || '').join('\n'), { linksAllowed });
  if (altIssue) return fail(res, 400, altIssue.code, altIssue.message);
  if (kind === 'thread' && !spaceKey) return fail(res, 400, 'SPACE_REQUIRED');

  let space = null;
  if (spaceKey) {
    space = await store.getSpaceByKey(String(spaceKey));
    if (!space) return fail(res, 400, 'SPACE_NOT_FOUND');
    if (!mayPost(space, profile, member)) return fail(res, 403, 'SPACE_NOT_ALLOWED');
  }

  const item = await store.insertPost(
    { kind, format, author_id: uid, space_id: space?.id || null, title: draft.title, body: draft.body },
    () => makeSlug(draft.title || draft.body),
  );
  let savedMedia;
  try {
    savedMedia = await store.insertMedia(mediaRows.map((m, i) => ({ post_id: item.id, kind: 'image', ...m, position: i })));
  } catch (e) {
    // No half-posts: retire the row (never visible/indexable) before the 500.
    await store.updatePost(item.id, { status: 'deleted', deleted_at: now() }).catch(() => null);
    throw e;
  }
  await recordMentions({ item, comment: null, text: `${draft.title || ''}\n${draft.body}`, actorId: uid });
  item.is_indexable = await safeRefresh(item.id);
  bustSitemapCache();

  // Admin ping: a brand-new account's first post is the spam / sock-puppet canary.
  // member.post_count is the pre-insert value (counted from community_members),
  // so 0 here means this is their first. 24h is the "brand new" window.
  if ((member?.post_count || 0) === 0 && profile?.created_at) {
    const ageHours = (Date.now() - new Date(profile.created_at).getTime()) / 3600000;
    if (ageHours < 24) {
      adminAlert({
        subject: `[Review] First post from a new member (${ageHours.toFixed(1)}h old)`,
        lines: [
          `Member: ${profile.name || profile.username || profile.id}`,
          `Age: ${ageHours.toFixed(1)}h`,
          `Space: ${space?.name || '—'}`,
          `Preview: ${(draft.title || draft.body || '').slice(0, 200)}`,
          `Links allowed: ${linksAllowed ? 'yes' : 'no'}`,
        ],
        key: `community_new_member_first_post:${uid}`,
        category: 'Community',
        link: `${process.env.CLIENT_URL || 'https://meeticulous.com'}/community/p/${item.slug}`,
      }).catch(() => null);
    }
  }

  return res.status(201).json({ item: serializeItem(item, { author: profile, member, space, media: savedMedia || [] }) });
});

// PATCH /items/:id — re-validates text; mentions are not re-parsed or re-notified.
const updateItem = handle(async (req, res) => {
  const uid = req.user.id;
  const item = await loadOwned(res, store.getPost, req.params.id, uid);
  if (!item) return null;
  if (!EDITABLE.includes(item.status)) return fail(res, 409, 'NOT_EDITABLE');
  const member = req.communityMember || null;
  const profile = await store.getProfile(uid);
  const { title = item.title, body = item.body } = req.body || {};
  const draft = validateDraft({ kind: item.kind, format: item.format, title, body }, { linksAllowed: await store.linksAllowed(profile, member) });
  if (!draft.ok) return fail(res, 400, draft.code, draft.message);

  const patch = { body: draft.body, edited_at: now() };
  if (item.kind === 'thread') patch.title = draft.title;
  const updated = await store.updatePost(item.id, patch, { status: item.status }); // lost a race with moderation -> null
  if (!updated) return fail(res, 409, 'NOT_EDITABLE');
  updated.is_indexable = await safeRefresh(item.id);
  const [space, media] = await Promise.all([item.space_id ? store.getSpaceById(item.space_id) : null, store.listMedia(item.id)]);
  return res.json({ item: serializeItem(updated, { author: profile, member, space, media }) });
});

// DELETE /items/:id — author soft delete; admin-removed items stay removed.
const deleteItem = handle(async (req, res) => {
  const item = await loadOwned(res, store.getPost, req.params.id, req.user.id);
  if (!item) return null;
  if (item.status === 'deleted') return res.json({ ok: true });
  if (item.status === 'removed') return fail(res, 409, 'NOT_EDITABLE');
  const deleted = await store.updatePost(item.id, { status: 'deleted', deleted_at: now() }, { status: item.status });
  if (!deleted) return fail(res, 409, 'NOT_EDITABLE'); // lost a race with moderation
  await safeRefresh(item.id);
  bustSitemapCache();
  return res.json({ ok: true });
});

// POST /items/:id/comments
const createComment = handle(async (req, res) => {
  const uid = req.user.id;
  const item = UUID.test(String(req.params.id)) ? await store.getPost(req.params.id) : null;
  if (!item || item.status !== 'visible' || !canView(item, await store.viewContext(uid, item.author_id))) {
    return fail(res, 404, 'NOT_FOUND');
  }
  const member = req.communityMember || null;
  const profile = await store.getProfile(uid);
  if (item.space_id) {
    const space = await store.getSpaceById(item.space_id);
    if (space?.reply_policy === 'hosts' && !profile?.is_host) return fail(res, 403, 'REPLY_NOT_ALLOWED');
  }
  const v = validateComment(req.body?.body, { linksAllowed: await store.linksAllowed(profile, member) });
  if (!v.ok) return fail(res, 400, v.code, v.message);

  let parentId = null;
  if (req.body?.parent_id) {
    const parent = UUID.test(String(req.body.parent_id)) ? await store.getComment(req.body.parent_id) : null;
    if (!parent || parent.post_id !== item.id) return fail(res, 400, 'INVALID_PARENT');
    parentId = parent.id;
  }

  const comment = await store.insertComment({ post_id: item.id, parent_id: parentId, author_id: uid, body: v.body });
  bg(() => notify.onComment({ item, comment, actorId: uid }));
  await recordMentions({ item, comment, text: v.body, actorId: uid });
  await safeRefresh(item.id);
  return res.status(201).json({ comment: serializeComment(comment, { author: profile, member }) });
});

// PATCH /comments/:id
const updateComment = handle(async (req, res) => {
  const uid = req.user.id;
  const c = await loadOwned(res, store.getComment, req.params.id, uid);
  if (!c) return null;
  if (!EDITABLE.includes(c.status)) return fail(res, 409, 'NOT_EDITABLE');
  const member = req.communityMember || null;
  const profile = await store.getProfile(uid);
  const v = validateComment(req.body?.body, { linksAllowed: await store.linksAllowed(profile, member) });
  if (!v.ok) return fail(res, 400, v.code, v.message);
  const updated = await store.updateComment(c.id, { body: v.body, edited_at: now() }, { status: c.status });
  if (!updated) return fail(res, 409, 'NOT_EDITABLE');
  return res.json({ comment: serializeComment(updated, { author: profile, member }) });
});

// DELETE /comments/:id — soft delete (tombstone); un-accepts it if it was the accepted answer.
const deleteComment = handle(async (req, res) => {
  const c = await loadOwned(res, store.getComment, req.params.id, req.user.id);
  if (!c) return null;
  if (c.status === 'deleted') return res.json({ ok: true });
  if (c.status === 'removed') return fail(res, 409, 'NOT_EDITABLE');
  const deleted = await store.updateComment(c.id, { status: 'deleted', deleted_at: now() }, { status: c.status });
  if (!deleted) return fail(res, 409, 'NOT_EDITABLE'); // lost a race with moderation
  await store.updatePost(c.post_id, { accepted_comment_id: null }, { accepted_comment_id: c.id });
  await safeRefresh(c.post_id);
  return res.json({ ok: true });
});

// POST /items/:id/accept — question author picks the answer.
const acceptAnswer = handle(async (req, res) => {
  const item = await loadOwned(res, store.getPost, req.params.id, req.user.id);
  if (!item) return null;
  if (!EDITABLE.includes(item.status)) return fail(res, 409, 'NOT_EDITABLE');
  if (item.format !== 'question') return fail(res, 400, 'NOT_A_QUESTION');
  const cid = req.body?.comment_id;
  const c = UUID.test(String(cid)) ? await store.getComment(cid) : null;
  if (!c || c.post_id !== item.id || c.status !== 'visible') return fail(res, 400, 'INVALID_COMMENT');
  await store.updatePost(item.id, { accepted_comment_id: c.id });
  await safeRefresh(item.id);
  // Fire-and-forget: the comment author gets the "your answer was accepted" mail.
  notify.onAnswerAccepted({ item, comment: c, actorId: req.user.id }).catch(() => null);
  return res.json({ accepted_comment_id: c.id });
});

const reactionTarget = (body) => {
  const { target_type: type, target_id: id } = body || {};
  return ['post', 'comment'].includes(type) && UUID.test(String(id)) ? { type, id } : null;
};

// POST /reactions — idempotent like. canView (not canViewComment): tombstones can't be liked.
const addReaction = handle(async (req, res) => {
  const uid = req.user.id;
  const t = reactionTarget(req.body);
  if (!t) return fail(res, 400, 'INVALID_TARGET');
  const target = await (t.type === 'post' ? store.getPost(t.id) : store.getComment(t.id));
  if (!target || !canView(target, await store.viewContext(uid, target.author_id))) return fail(res, 404, 'NOT_FOUND');
  await store.addReaction(uid, t.type, t.id);
  return res.json({ liked: true });
});

// DELETE /reactions — 200 whether or not the like existed.
const removeReaction = handle(async (req, res) => {
  const t = reactionTarget(req.body);
  if (!t) return fail(res, 400, 'INVALID_TARGET');
  await store.removeReaction(req.user.id, t.type, t.id);
  return res.json({ liked: false });
});

// POST /reports — duplicate = 200 no-op; the 3rd distinct open report hides a visible post/comment.
const createReport = handle(async (req, res) => {
  const uid = req.user.id;
  const { target_type: type, target_id: id, reason, details } = req.body || {};
  if (!['post', 'comment', 'member'].includes(type) || !UUID.test(String(id))) return fail(res, 400, 'INVALID_TARGET');
  if (!REPORT_REASONS.includes(reason)) return fail(res, 400, 'INVALID_REASON');
  if (details != null && (typeof details !== 'string' || details.length > 1000)) return fail(res, 400, 'INVALID_DETAILS');

  const load = { post: store.getPost, comment: store.getComment, member: store.getProfile }[type];
  const target = await load(id);
  if (!target) return fail(res, 404, 'NOT_FOUND');
  if ((type === 'member' ? target.id : target.author_id) === uid) return fail(res, 400, 'CANNOT_REPORT_SELF');

  const created = await store.insertReport({ target_type: type, target_id: id, reporter_id: uid, reason, details: details?.trim() || null });
  if (!created) return res.json({ ok: true });

  // Admin ping: new report lands. Throttle key = (type:id) so a burst on the
  // same target coalesces into one mail inside the 15m cooldown.
  adminAlert({
    subject: `[Flag] ${reason} — community ${type}`,
    lines: [
      `Target: ${type} ${id}`,
      `Reason: ${reason}`,
      `Reporter: ${uid}`,
      details ? `Details: ${String(details).slice(0, 200)}` : '',
    ].filter(Boolean),
    key: `community_flag:${type}:${id}`,
    category: 'Community',
    link: `${process.env.CLIENT_URL || 'https://meeticulous.com'}/admin/community/reports`,
  }).catch(() => null);

  if (type !== 'member' && target.status === 'visible' && (await store.countOpenReports(type, id)) >= AUTO_HIDE_AT) {
    const hide = type === 'post' ? store.updatePost : store.updateComment;
    const hidden = await hide(id, { status: 'hidden' }, { status: 'visible' });
    if (hidden) {
      await safeRefresh(type === 'post' ? id : target.post_id);
      if (type === 'post') bustSitemapCache();
    }
  }
  return res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------------------
// Reads (spec §11). Chain: optionalProtect, communityGate. A missing table fails soft.
// ---------------------------------------------------------------------------------------
const FEED_LIMIT = 20;
const FEED_FETCH = FEED_LIMIT + 5; // SQL filters status; the author-ban check is JS, so over-fetch
const COMMENT_LIMIT = 50;

// handle() for reads: missing table -> `soft` body (or 404 when no soft body) instead of 503.
const handleRead = (fn, soft) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return soft ? res.json(soft) : fail(res, 404, 'NOT_FOUND');
    console.error('[community]', e.message);
    return fail(res, 500, 'SERVER_ERROR');
  }
};

// Anonymous = shared cache 60s; logged-in responses carry viewer state, never shared.
const setCache = (req, res) => {
  if (req.user?.id) return res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization'); // a shared cache must not serve this anonymous body to a logged-in caller
  return setPublicCache(res, 60);
};

// ponytail: blockedPairs empty in Phase 1 (blocking UI ships later).
const ctxFor = async (req) => ({ viewerId: req.user?.id || null, bannedAuthorIds: await store.bannedAuthorIds(), blockedPairs: new Set() });

const spaceView = ({ key, name, description, post_policy: postPolicy, reply_policy: replyPolicy }) => ({
  key, name, description, post_policy: postPolicy, reply_policy: replyPolicy,
});

// One over-fetched page -> up to 20 visible rows (after `lead`) and the next cursor.
// `more` comes from the RAW fetch size (a short raw page is the true end), never from the filtered array.
// Cursor: if visible overflowed 20, resume after the 20th row (rows 21+ are re-fetched, none skipped);
// otherwise every raw row was scanned, so resume after the last RAW row (skipping only invisible ones).
function pageOf(raw, ctx, { exclude = new Set(), lead = [], sortCol = 'created_at' } = {}) {
  const visible = filterVisible(raw, ctx).filter((r) => !exclude.has(r.id));
  const rows = visible.slice(0, FEED_LIMIT);
  const overflow = visible.length > FEED_LIMIT;
  const more = overflow || raw.length >= FEED_FETCH;
  const last = overflow ? rows[rows.length - 1] : raw[raw.length - 1];
  return { rows: [...lead, ...rows], next: more && last ? encodeCursor(last[sortCol], last.id) : null };
}

// -> {cur} (null when absent) or null after answering 400 BAD_CURSOR.
const readCursor = (req, res) => {
  if (req.query.cursor == null || req.query.cursor === '') return { cur: null };
  const cur = decodeCursor(String(req.query.cursor));
  if (!cur) { fail(res, 400, 'BAD_CURSOR', 'Invalid cursor.'); return null; }
  return { cur };
};

const listSpaces = handleRead(async (req, res) => {
  const spaces = await store.listSpaces();
  setCache(req, res);
  return res.json({ spaces: spaces.map(spaceView) });
}, { spaces: [] });

const feed = handleRead(async (req, res) => {
  const tab = req.query.tab || 'everyone';
  if (!['everyone', 'updates'].includes(tab)) return fail(res, 400, 'BAD_TAB', 'Unknown tab.');
  const c = readCursor(req, res);
  if (!c) return null;
  const ctx = await ctxFor(req);
  const updates = tab === 'updates';
  const updatesSpace = updates ? (await store.listSpaces()).find((s) => s.key === 'updates') : null;
  const raw = await store.listFeedRows({ cur: c.cur, limit: FEED_FETCH, updates, updatesSpaceId: updatesSpace?.id });
  // Pinned prefix: page 1 of "everyone" only; pinned ids leave the regular list on EVERY page so nothing shows twice.
  const allPinned = updates ? [] : await store.listPinned();
  const lead = c.cur ? [] : filterVisible(allPinned, ctx);
  const { rows, next } = pageOf(raw, ctx, { exclude: new Set(allPinned.map((p) => p.id)), lead });
  const items = await store.hydrateItems(rows, req.user?.id || null);
  setCache(req, res);
  return res.json({ items, next_cursor: next });
}, { items: [], next_cursor: null });

const spaceThreads = handleRead(async (req, res) => {
  const space = (await store.listSpaces()).find((s) => s.key === req.params.key);
  if (!space) return fail(res, 404, 'NOT_FOUND');
  const c = readCursor(req, res);
  if (!c) return null;
  const raw = await store.listFeedRows({ cur: c.cur, limit: FEED_FETCH, spaceId: space.id, sortCol: 'last_activity_at' });
  const { rows, next } = pageOf(raw, await ctxFor(req), { sortCol: 'last_activity_at' });
  const items = await store.hydrateItems(rows, req.user?.id || null);
  setCache(req, res);
  return res.json({ space: spaceView(space), items, next_cursor: next });
}, { space: null, items: [], next_cursor: null });

// Oldest-first comment page. Tombstones stay (filterVisibleComments), so no over-fetch needed.
async function commentPage(req, postId, cur) {
  const raw = await store.listCommentRows(postId, cur, COMMENT_LIMIT + 1);
  const page = raw.slice(0, COMMENT_LIMIT);
  const shown = filterVisibleComments(page, await ctxFor(req));
  const last = page[page.length - 1];
  return {
    comments: await store.hydrateComments(shown, req.user?.id || null),
    next: raw.length > COMMENT_LIMIT ? encodeCursor(last.created_at, last.id) : null,
  };
}

// Load by slug and apply the 410 / 404 rulings. Answers and returns null on failure.
async function loadReadable(req, res) {
  const row = await store.getPostBySlug(req.params.slug);
  if (!row) { fail(res, 404, 'NOT_FOUND'); return null; }
  if (['removed', 'deleted'].includes(row.status)) { fail(res, 410, 'GONE', 'This content is no longer available.'); return null; }
  if (!canView(row, await ctxFor(req))) { fail(res, 404, 'NOT_FOUND'); return null; }
  return row;
}

const itemDetail = handleRead(async (req, res) => {
  const row = await loadReadable(req, res);
  if (!row) return null;
  const [[item], { comments, next }, spaces] = await Promise.all([
    store.hydrateItems([row], req.user?.id || null), commentPage(req, row.id, null), store.listSpaces(),
  ]);
  const space = spaces.find((s) => s.id === row.space_id);
  setCache(req, res);
  return res.json({ item, space: space ? spaceView(space) : null, comments, next_comment_cursor: next });
});

const itemComments = handleRead(async (req, res) => {
  const c = readCursor(req, res);
  if (!c) return null;
  const row = await loadReadable(req, res);
  if (!row) return null;
  const { comments, next } = await commentPage(req, row.id, c.cur);
  setCache(req, res);
  return res.json({ comments, next_cursor: next });
});

// GET /me — the gate already loaded the member row when it could.
const me = handleRead(async (req, res) => {
  const m = req.communityMember !== undefined ? req.communityMember : await store.getMember(req.user.id);
  res.set('Cache-Control', 'private, no-store');
  return res.json({
    member: m ? {
      badge: m.badge, early_access: m.early_access, links_allowed: m.links_allowed, terms_version: m.terms_version,
      terms_accepted_at: m.terms_accepted_at, banned_until: m.banned_until, email_replies: m.email_replies,
    } : null,
    terms_version_required: CURRENT_TERMS_VERSION,
  });
}, { member: null, terms_version_required: CURRENT_TERMS_VERSION });

module.exports = {
  listSpaces, feed, spaceThreads, itemDetail, itemComments, me,
  acceptTerms, createItem, updateItem, deleteItem, createComment, updateComment, deleteComment,
  acceptAnswer, addReaction, removeReaction, createReport,
};
