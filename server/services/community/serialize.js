'use strict';
// The ONLY way author data leaves the server (spec §13). Whitelist fields explicitly;
// never spread a profile — phone/email/last_name must not be reachable from here.

const GONE = ['deleted', 'removed'];

function serializeAuthor(profile, member) {
  if (!profile) {
    return { id: null, display_name: 'Deleted account', avatar_url: null, role: 'deleted', badge: null, profile_url: null };
  }
  const host = !!profile.is_host;
  return {
    id: profile.id,
    display_name: host ? (profile.name?.trim() || profile.username || 'Host') : (profile.first_name?.trim() || 'Member'),
    avatar_url: profile.profile_image || null,
    role: host ? 'host' : 'guest',
    badge: member?.badge || null,
    profile_url: host && profile.username ? `/${profile.username}` : null,
  };
}

function serializeItem(row, { author = null, member = null, space = null, viewer = { liked: false }, media = [] } = {}) {
  const gone = GONE.includes(row.status);
  return {
    id: row.id,
    kind: row.kind,
    format: row.format,
    slug: row.slug,
    url: `/community/${row.kind === 'thread' ? 't' : 'p'}/${row.slug}`,
    title: gone ? null : row.title ?? null,
    body: gone ? '' : row.body,
    space: space ? { key: space.key, name: space.name } : null,
    author: serializeAuthor(author, member),
    like_count: row.like_count,
    comment_count: row.comment_count,
    created_at: row.created_at,
    edited_at: row.edited_at,
    last_activity_at: row.last_activity_at,
    is_pinned: row.is_pinned,
    status: row.status,
    is_indexable: row.is_indexable,
    accepted_comment_id: row.accepted_comment_id ?? null,
    media: [...media].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((m) => ({ url: m.url, width: m.width ?? null, height: m.height ?? null, alt: m.alt ?? null })),
    viewer,
  };
}

function serializeComment(row, { author = null, member = null, viewer = { liked: false } } = {}) {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_id ?? null,
    body: GONE.includes(row.status) ? '' : row.body,
    author: serializeAuthor(author, member),
    like_count: row.like_count,
    created_at: row.created_at,
    edited_at: row.edited_at,
    status: row.status,
    viewer,
  };
}

module.exports = { serializeAuthor, serializeItem, serializeComment };
