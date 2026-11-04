'use strict';
// Admin-only community queries (moderation console). Same run()/missing-table contract as store.js.
// Never selects phone/email: profiles are read through an explicit column list.

const { supabaseAdmin } = require('../../config/supabase');
const { run } = require('./store');

const db = (t) => supabaseAdmin.from(t);
const MEMBER_ADMIN_COLS = 'user_id, badge, early_access, links_allowed, banned_until, ban_reason, post_count, comment_count';
const REPORT_CAP = 2000; // ponytail: group in memory; page in SQL if open reports ever exceed this

// ilike input goes into a PostgREST .or() string: drop its separators, escape LIKE wildcards.
const likeSafe = (q) => q.replace(/[\\,()"]/g, ' ').replace(/[%_]/g, (m) => `\\${m}`).trim();

const listReports = async (status) => (await run(db('community_reports')
  .select('id, target_type, target_id, reason, status, created_at')
  .eq('status', status).order('created_at', { ascending: false }).limit(REPORT_CAP))) || [];
const getReport = (id) => run(db('community_reports').select('*').eq('id', id).maybeSingle());
const resolveOpenReports = (targetType, targetId, patch) => run(db('community_reports').update(patch)
  .eq('target_type', targetType).eq('target_id', targetId).eq('status', 'open'));

const postsByIds = async (ids) => (ids.length ? (await run(db('community_posts').select('*').in('id', ids))) || [] : []);
const commentsByIds = async (ids) => (ids.length ? (await run(db('community_comments').select('*').in('id', ids))) || [] : []);

// Keyset page (created_at desc). `cur` is a decodeCursor() result, so interpolation is safe.
async function searchContent({ type, q, status, cur, limit }) {
  const table = type === 'comments' ? 'community_comments' : 'community_posts';
  let query = db(table).select('*');
  if (status) query = query.eq('status', status);
  if (q) {
    const p = `%${likeSafe(q)}%`;
    query = query.or(type === 'comments' ? `body.ilike.${p}` : `title.ilike.${p},body.ilike.${p}`);
  }
  if (cur) query = query.or(`created_at.lt.${cur.ts},and(created_at.eq.${cur.ts},id.lt.${cur.id})`);
  return (await run(query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit))) || [];
}

async function searchMembers(q, limit) {
  let pq = db('profiles').select('id, name, first_name, username, is_host');
  if (q) {
    const p = `%${likeSafe(q)}%`;
    pq = pq.or(`username.ilike.${p},name.ilike.${p},first_name.ilike.${p}`);
  }
  const profiles = (await run(pq.limit(limit))) || [];
  const members = profiles.length
    ? (await run(db('community_members').select(MEMBER_ADMIN_COLS).in('user_id', profiles.map((p) => p.id)))) || []
    : [];
  return { profiles, members };
}

const getMemberAdmin = (userId) => run(db('community_members').select(MEMBER_ADMIN_COLS).eq('user_id', userId).maybeSingle());
const upsertMember = (row) => run(db('community_members').upsert(row, { onConflict: 'user_id' }).select(MEMBER_ADMIN_COLS).single());

const getSpaceAny = (key) => run(db('community_spaces').select('*').eq('key', key).maybeSingle());
const updateSpace = (key, patch) => run(db('community_spaces').update(patch).eq('key', key).select('*').maybeSingle());

module.exports = {
  listReports, getReport, resolveOpenReports, postsByIds, commentsByIds, searchContent, searchMembers,
  getMemberAdmin, upsertMember, getSpaceAny, updateSpace,
};
