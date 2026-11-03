'use strict';
// Community notifications (spec §14): reply, mention, content-removed.
// In-app bell row via inAppNotify (dedupeKey); email via NotificationEngine (no data.inApp, so
// the engine does not add a second bell row). Callers fire-and-forget; nothing here ever throws.
// Deliberate simplification of §14 coalescing: first event per hour notifies, the rest are skipped.

const { supabaseAdmin } = require('../../config/supabase');
const { inAppNotify } = require('../../utils/inAppNotify');
const notificationEngine = require('../notificationEngine');

const MAX_MENTIONS = 10;
const BASE = () => process.env.CLIENT_URL || 'https://meeticulous.com';
const hourKey = () => new Date().toISOString().slice(0, 13).replace(/\D/g, ''); // UTC YYYYMMDDHH
const snippet = (s, n = 100) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const itemPath = (item) => `/community/${item.kind === 'thread' ? 't' : 'p'}/${item.slug}`;
const rows = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data || []; };

// Same display rule as serializeAuthor: guest -> first name or "Member"; host -> name. Never phone/email.
const displayName = (p) => (!p ? 'Someone' : p.is_host ? (p.name?.trim() || p.username || 'A host') : (p.first_name?.trim() || 'Member'));
const firstName = (p) => (p.is_host ? (p.name || '').trim().split(/\s+/)[0] : p.first_name?.trim()) || 'there';

// Eligible recipients among `ids`: has a profile, not banned, not an AI account. -> Map id -> {profile, member}
async function loadRecipients(ids, extraProfileIds = [], { allowBanned = false } = {}) {
  const all = [...new Set([...ids, ...extraProfileIds].filter(Boolean))];
  if (!all.length) return { byId: new Map(), profiles: new Map() };
  const [profiles, members] = await Promise.all([
    rows(supabaseAdmin.from('profiles').select('id, is_host, is_banned, first_name, name, username, email').in('id', all)),
    rows(supabaseAdmin.from('community_members').select('user_id, badge, banned_until, email_replies').in('user_id', all)),
  ]);
  const pMap = new Map(profiles.map((p) => [p.id, p]));
  const mMap = new Map(members.map((m) => [m.user_id, m]));
  const byId = new Map();
  for (const id of ids) {
    const profile = pMap.get(id);
    const member = mMap.get(id) || null;
    const banned = !!member?.banned_until && new Date(member.banned_until).getTime() > Date.now();
    if (!profile || member?.badge === 'ai' || (!allowBanned && (profile.is_banned || banned))) continue;
    byId.set(id, { profile, member });
  }
  return { byId, profiles: pMap };
}

// Each job: {userId, profile, dedupeKey, title, body, link, emailOk, emailData}. Keys already in the bell
// (one batched check) are skipped entirely, so a repeat does not re-email either.
async function deliver(jobs, type) {
  if (!jobs.length) return;
  const seen = new Set((await rows(supabaseAdmin.from('in_app_notifications').select('dedupe_key').in('dedupe_key', jobs.map((j) => j.dedupeKey)))).map((r) => r.dedupe_key));
  for (const j of jobs) {
    if (seen.has(j.dedupeKey)) continue;
    try {
      inAppNotify({ userId: j.userId, role: j.profile.is_host ? 'host' : 'guest', type, title: j.title, body: j.body, link: j.link, data: {}, dedupeKey: j.dedupeKey });
      if (j.emailOk && j.profile.email) {
        await notificationEngine.send({
          event: type,
          data: {
            email: j.profile.email,
            name: firstName(j.profile),
            audience: j.profile.is_host ? 'vendor' : 'customer',
            emailData: { first_name: firstName(j.profile), ...j.emailData, community_url: `${BASE()}${j.link}` },
            recipientUserId: j.userId,
          },
        });
      }
    } catch (e) { console.error('[community-notify]', e.message); }
  }
}

const wantsEmail = (member) => member?.email_replies !== false; // missing member row counts as true

async function parentAuthor(comment) {
  if (!comment?.parent_id) return null;
  const [p] = await rows(supabaseAdmin.from('community_comments').select('id, author_id').in('id', [comment.parent_id]));
  return p?.author_id || null;
}

// item/comment are raw DB rows (the controller passes them unserialized).
async function onComment({ item, comment, actorId } = {}) {
  try {
    if (!item || !comment) return;
    const parentAuthorId = await parentAuthor(comment);
    const ids = [...new Set([item.author_id, parentAuthorId].filter((id) => id && id !== actorId))];
    if (!ids.length) return;
    const { byId, profiles } = await loadRecipients(ids, [actorId]);
    const actor = displayName(profiles.get(actorId));
    const link = `${itemPath(item)}#c-${comment.id}`;
    const hk = hourKey();
    const jobs = [...byId].map(([userId, { profile, member }]) => {
      const mine = userId === parentAuthorId && userId !== item.author_id;
      return {
        userId, profile, link, dedupeKey: `community_reply:${userId}:${item.id}:${hk}`,
        title: `${actor} replied to your ${mine ? 'comment' : 'post'}`, body: snippet(comment.body),
        emailOk: wantsEmail(member),
        emailData: { actor_name: actor, excerpt: snippet(comment.body), target_label: mine ? 'comment' : 'post' },
      };
    });
    await deliver(jobs, 'COMMUNITY_REPLY');
  } catch (e) { console.error('[community-notify]', e.message); }
}

async function onMentions({ item, comment, usernames, actorId } = {}) {
  try {
    if (!item || !Array.isArray(usernames) || !usernames.length) return;
    const found = await rows(supabaseAdmin.from('profiles').select('id, username').in('username', usernames.slice(0, MAX_MENTIONS)));
    // A reply notification for this same comment wins over a mention.
    const replyIds = comment ? new Set([item.author_id, await parentAuthor(comment)]) : new Set();
    const ids = [...new Set(found.map((p) => p.id))].filter((id) => id !== actorId && !replyIds.has(id)).slice(0, MAX_MENTIONS);
    if (!ids.length) return;
    const { byId, profiles } = await loadRecipients(ids, [actorId]);
    const actor = displayName(profiles.get(actorId));
    const link = comment ? `${itemPath(item)}#c-${comment.id}` : itemPath(item);
    const text = comment ? comment.body : (item.title || item.body);
    const jobs = [...byId].map(([userId, { profile, member }]) => ({
      userId, profile, link, dedupeKey: `community_mention:${userId}:${comment?.id || item.id}`,
      title: `${actor} mentioned you`, body: snippet(text), emailOk: wantsEmail(member),
      emailData: { actor_name: actor, excerpt: snippet(text) },
    }));
    await deliver(jobs, 'COMMUNITY_MENTION');
  } catch (e) { console.error('[community-notify]', e.message); }
}

// Moderation removal (called by admin tooling with raw rows). Always emails.
async function onRemoved({ targetType, item, comment } = {}) {
  try {
    const row = comment || item;
    if (!row?.author_id) return;
    const { byId } = await loadRecipients([row.author_id], [], { allowBanned: true }); // moderators often ban + remove together
    const r = byId.get(row.author_id);
    if (!r) return;
    const what = comment || targetType === 'comment' ? 'reply' : 'post';
    await deliver([{
      userId: row.author_id, profile: r.profile, dedupeKey: `community_removed:${row.id}`,
      title: `Your ${what} was removed`, body: 'It did not follow the community guidelines.',
      link: item ? itemPath(item) : '/community', emailOk: true,
      emailData: { target_label: what },
    }], 'COMMUNITY_CONTENT_REMOVED');
  } catch (e) { console.error('[community-notify]', e.message); }
}

module.exports = { onComment, onMentions, onRemoved };
