'use strict';
// /api/admin/community/* (spec §18): reports queue, hide/restore/remove, pins, members, spaces.
// Permissions are enforced in adminRoutes (community.view / community.moderate).
// Every mutation calls audit() with before/after. A missing community table -> 503 COMMUNITY_UNAVAILABLE.

const store = require('../services/community/store');
const admin = require('../services/community/adminStore');
const notify = require('../services/community/notify');
const { audit } = require('../services/auditService');
const { serializeAuthor } = require('../services/community/serialize');
const { encodeCursor, decodeCursor } = require('../services/community/cursor');
const { bustSitemapCache } = require('../utils/sitemapCache');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['visible', 'hidden', 'removed', 'deleted'];
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];
const BADGES = ['official', 'ai', 'staff'];
const ACTION_STATUS = { hide: 'hidden', restore: 'visible', remove: 'removed' };
const RESTORABLE = ['hidden', 'removed'];
const MAX_NOTE = 500;

const fail = (res, status, code, extra = {}) => res.status(status).json({ code, message: code, ...extra });
const bad = (res, field) => fail(res, 400, 'INVALID_FIELD', { field });
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return fail(res, 503, 'COMMUNITY_UNAVAILABLE');
    console.error('[community-admin]', e.message);
    return fail(res, 500, 'SERVER_ERROR');
  }
};
const bg = (fn) => Promise.resolve().then(fn).catch((e) => console.error('[community-admin] notify', e.message));
const excerpt = (s, n = 200) => String(s || '').slice(0, n);
const limitOf = (q, def, max) => Math.min(Math.max(parseInt(q, 10) || def, 1), max);
const isIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const itemUrl = (p) => `/community/${p.kind === 'thread' ? 't' : 'p'}/${p.slug}`;
const noteOf = (body) => (typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : null) || null;

// ---- Reports ----
const listReports = handle(async (req, res) => {
  const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : 'open';
  const limit = limitOf(req.query.limit, 50, 100);
  const groups = new Map();
  for (const r of await admin.listReports(status)) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) || { target_type: r.target_type, target_id: r.target_id, report_id: r.id, count: 0, reasons: {}, first_reported_at: r.created_at, latest_reported_at: r.created_at };
    g.count += 1;
    g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
    if (r.created_at < g.first_reported_at) g.first_reported_at = r.created_at;
    if (r.created_at > g.latest_reported_at) g.latest_reported_at = r.created_at;
    groups.set(key, g);
  }
  // Defamation first (legal clock), then most-reported, then most recent.
  const page = [...groups.values()].sort((a, b) => (!!b.reasons.defamation - !!a.reasons.defamation)
    || b.count - a.count || (a.latest_reported_at < b.latest_reported_at ? 1 : -1)).slice(0, limit);

  const ids = (type) => page.filter((g) => g.target_type === type).map((g) => g.target_id);
  const [posts, comments] = await Promise.all([admin.postsByIds(ids('post')), admin.commentsByIds(ids('comment'))]);
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const parentIds = comments.map((c) => c.post_id).filter((id) => !postMap.has(id));
  for (const p of await admin.postsByIds([...new Set(parentIds)])) postMap.set(p.id, p);
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const { profiles, members } = await store.loadAuthors([
    ...posts.map((p) => p.author_id), ...comments.map((c) => c.author_id), ...ids('member'),
  ]);

  const out = page.map((g) => {
    let preview = { status: 'missing', body: '' };
    let authorId = null;
    if (g.target_type === 'post' && postMap.has(g.target_id)) {
      const p = postMap.get(g.target_id);
      preview = { title: p.title ?? null, body: excerpt(p.body), status: p.status, url: itemUrl(p) };
      authorId = p.author_id;
    } else if (g.target_type === 'comment' && commentMap.has(g.target_id)) {
      const c = commentMap.get(g.target_id);
      const p = postMap.get(c.post_id);
      preview = { body: excerpt(c.body), status: c.status, url: p ? `${itemUrl(p)}#c-${c.id}` : undefined };
      authorId = c.author_id;
    } else if (g.target_type === 'member') {
      preview = { body: '', status: 'member' };
      authorId = g.target_id;
    }
    return { ...g, preview, author: serializeAuthor(profiles.get(authorId), members.get(authorId)) };
  });
  res.json({ groups: out });
});

const resolveReport = handle(async (req, res) => {
  const { status } = req.body || {};
  if (!['resolved', 'dismissed'].includes(status)) return bad(res, 'status');
  const note = noteOf(req.body);
  const report = await admin.getReport(req.params.id);
  if (!report) return fail(res, 404, 'NOT_FOUND');
  await admin.resolveOpenReports(report.target_type, report.target_id, resolvedPatch(req, status, note));
  await audit(req, { action: 'community.report_resolve', resource_type: 'community_report', resource_id: report.id, before: { status: report.status }, after: { status, note, target_type: report.target_type, target_id: report.target_id } });
  res.json({ ok: true });
});
const resolvedPatch = (req, status, note) => ({ status, resolved_by: req.admin.id, resolved_at: new Date().toISOString(), resolution_note: note });

// ---- Content ----
const searchContent = handle(async (req, res) => {
  const type = req.query.type === 'comments' ? 'comments' : 'posts';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length > 100) return bad(res, 'q');
  if (req.query.status && !STATUSES.includes(req.query.status)) return bad(res, 'status');
  const limit = limitOf(req.query.limit, 25, 50);
  const cur = decodeCursor(req.query.cursor);
  const rows = await admin.searchContent({ type, q, status: req.query.status, cur, limit: limit + 1 });
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const { profiles, members } = await store.loadAuthors(page.map((r) => r.author_id));
  const items = page.map((r) => ({
    type, id: r.id, status: r.status, title: r.title ?? null, body: excerpt(r.body, 300),
    created_at: r.created_at, moderated_by: r.moderated_by ?? null, moderated_at: r.moderated_at ?? null, admin_note: r.admin_note ?? null,
    ...(type === 'posts' ? { slug: r.slug, url: itemUrl(r), is_pinned: r.is_pinned } : { post_id: r.post_id }),
    author: serializeAuthor(profiles.get(r.author_id), members.get(r.author_id)),
  }));
  const last = page[page.length - 1];
  res.json({ items, next_cursor: more && last ? encodeCursor(last.created_at, last.id) : null });
});

const moderate = handle(async (req, res) => {
  const type = { posts: 'post', post: 'post', comments: 'comment', comment: 'comment' }[req.params.type];
  const { action } = req.body || {};
  if (!type) return fail(res, 400, 'INVALID_TYPE');
  if (!ACTION_STATUS[action]) return fail(res, 400, 'INVALID_ACTION');
  if (!UUID_RE.test(req.params.id)) return fail(res, 404, 'NOT_FOUND');
  const note = noteOf(req.body);
  const isPost = type === 'post';
  const row = await (isPost ? store.getPost : store.getComment)(req.params.id);
  if (!row) return fail(res, 404, 'NOT_FOUND');
  // deleted-by-author stays deleted; restore only undoes a moderation action.
  if (action === 'restore' ? !RESTORABLE.includes(row.status) : row.status === 'deleted') {
    return fail(res, 409, action === 'restore' ? 'NOT_RESTORABLE' : 'NOT_MODERATABLE');
  }
  const next = ACTION_STATUS[action];
  const patch = { status: next, moderated_by: req.admin.id, moderated_at: new Date().toISOString(), admin_note: note };
  const updated = await (isPost ? store.updatePost : store.updateComment)(row.id, patch, { status: row.status }); // guard vs racing writers
  if (!updated) return fail(res, 409, 'CONFLICT');

  const postId = isPost ? row.id : row.post_id;
  await admin.resolveOpenReports(type, row.id, resolvedPatch(req, 'resolved', note ? `${action}: ${note}` : action));
  try { await store.refreshIndexable(postId); } catch (e) { console.error('[community-admin] indexable', e.message); }
  bustSitemapCache();
  store.resetReadCaches();
  if (action === 'remove') {
    bg(async () => notify.onRemoved(isPost ? { targetType: 'post', item: updated } : { targetType: 'comment', item: await store.getPost(row.post_id), comment: updated }));
  }
  await audit(req, { action: `community.${action}`, resource_type: `community_${type}`, resource_id: row.id, before: { status: row.status }, after: { status: next, note } });
  res.json({ ok: true, status: next });
});

const pin = handle(async (req, res) => {
  const { pinned, pinned_until: until } = req.body || {};
  if (typeof pinned !== 'boolean') return bad(res, 'pinned');
  if (pinned && until != null && (!isIso(until) || Date.parse(until) <= Date.now())) return bad(res, 'pinned_until');
  if (!UUID_RE.test(req.params.id)) return fail(res, 404, 'NOT_FOUND');
  const post = await store.getPost(req.params.id);
  if (!post) return fail(res, 404, 'NOT_FOUND');
  if (post.status !== 'visible') return fail(res, 409, 'NOT_VISIBLE');
  const patch = { is_pinned: pinned, pinned_until: pinned && until ? new Date(until).toISOString() : null };
  const updated = await store.updatePost(post.id, patch, { status: 'visible' });
  if (!updated) return fail(res, 409, 'CONFLICT');
  store.resetReadCaches();
  await audit(req, { action: 'community.pin', resource_type: 'community_post', resource_id: post.id, before: { is_pinned: post.is_pinned, pinned_until: post.pinned_until }, after: patch });
  res.json({ ok: true, ...patch });
});

// ---- Members ----
const listMembers = handle(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length > 100) return bad(res, 'q');
  const { profiles, members } = await admin.searchMembers(q, limitOf(req.query.limit, 25, 50));
  const byUser = new Map(members.map((m) => [m.user_id, m]));
  res.json({
    members: profiles.map((p) => {
      const m = byUser.get(p.id) || {};
      const a = serializeAuthor(p, m);
      return {
        user_id: p.id, display_name: a.display_name, role: a.role, ...(p.is_host ? { username: p.username } : {}),
        badge: m.badge ?? null, early_access: !!m.early_access, links_allowed: !!m.links_allowed,
        banned_until: m.banned_until ?? null, post_count: m.post_count || 0, comment_count: m.comment_count || 0,
      };
    }),
  });
});

const patchMember = handle(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('badge' in b) { if (b.badge !== null && !BADGES.includes(b.badge)) return bad(res, 'badge'); patch.badge = b.badge; }
  for (const f of ['early_access', 'links_allowed']) {
    if (f in b) { if (typeof b[f] !== 'boolean') return bad(res, f); patch[f] = b[f]; }
  }
  if ('banned_until' in b) {
    if (b.banned_until !== null && (!isIso(b.banned_until) || Date.parse(b.banned_until) <= Date.now())) return bad(res, 'banned_until');
    patch.banned_until = b.banned_until === null ? null : new Date(b.banned_until).toISOString();
  }
  if ('ban_reason' in b) {
    if (b.ban_reason !== null && (typeof b.ban_reason !== 'string' || b.ban_reason.length > 500)) return bad(res, 'ban_reason');
    patch.ban_reason = b.ban_reason;
  }
  if (!Object.keys(patch).length) return fail(res, 400, 'NO_CHANGES');
  const userId = req.params.userId;
  if (!UUID_RE.test(userId)) return fail(res, 404, 'NOT_FOUND');
  const before = await admin.getMemberAdmin(userId);
  let after;
  try {
    after = await admin.upsertMember({ user_id: userId, ...patch });
  } catch (e) {
    if (e.code === '23503') return fail(res, 404, 'NOT_FOUND'); // no such profile
    throw e;
  }
  store.resetReadCaches(); // banned-author cache
  await audit(req, { action: 'community.member', resource_type: 'community_member', resource_id: userId, before, after });
  res.json({ member: after });
});

// ---- Spaces ----
const patchSpace = handle(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('name' in b) { if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 60) return bad(res, 'name'); patch.name = b.name; }
  if ('description' in b) { if (b.description !== null && (typeof b.description !== 'string' || b.description.length > 300)) return bad(res, 'description'); patch.description = b.description; }
  if ('position' in b) { if (!Number.isInteger(b.position)) return bad(res, 'position'); patch.position = b.position; }
  if ('post_policy' in b) { if (!['everyone', 'hosts', 'official'].includes(b.post_policy)) return bad(res, 'post_policy'); patch.post_policy = b.post_policy; }
  if ('reply_policy' in b) { if (!['everyone', 'hosts'].includes(b.reply_policy)) return bad(res, 'reply_policy'); patch.reply_policy = b.reply_policy; }
  if ('is_active' in b) { if (typeof b.is_active !== 'boolean') return bad(res, 'is_active'); patch.is_active = b.is_active; }
  if (!Object.keys(patch).length) return fail(res, 400, 'NO_CHANGES');
  const before = await admin.getSpaceAny(req.params.key);
  if (!before) return fail(res, 404, 'NOT_FOUND');
  const after = await admin.updateSpace(req.params.key, patch);
  store.resetReadCaches();
  await audit(req, { action: 'community.space', resource_type: 'community_space', resource_id: before.id || req.params.key, before, after });
  res.json({ space: after });
});

module.exports = { listReports, resolveReport, searchContent, moderate, pin, listMembers, patchMember, patchSpace };
