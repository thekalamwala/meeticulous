// server/services/inviteService.js
// Lead-source attribution for /invite/:slug. Attribution-only; NEVER writes a
// referrals row (that is Refer & Earn's job — separate axis). All access via the
// service role (RLS blocks anon/auth).
const { supabaseAdmin } = require('../config/supabase');
const { isStaticReserved } = require('../config/reservedNamespaces');
const { normalizeSlug } = require('../utils/slugNormalize');

// A missing table/column (migration not yet applied here) must never 500 the app.
const isSchemaMiss = (e) =>
  e && (e.code === '42P01' || e.code === '42703' ||
        /does not exist|schema cache/i.test(e.message || ''));

const norm = (s) => normalizeSlug(String(s || '').trim());

// Cold-call invite codes (meeticulous.com/invite/CX12) share this landing page; an
// invite_links slug always wins. Lazy require — coldCallService pulls in the CRM.
const coldCall = () => require('./crm/coldCallService');

async function getPublicConfig(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from('invite_links').select('label, active').eq('slug', norm(slug)).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const lead = await coldCall().leadByRefCode(slug);
    return lead ? { label: lead.business_name || lead.name || 'friend', active: true } : null;
  } catch (e) { if (isSchemaMiss(e)) return null; throw e; }
}

async function slugExists(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from('invite_links').select('slug').eq('slug', norm(slug)).maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) { if (isSchemaMiss(e)) return false; throw e; }
}

// Stamp ONLY when the slug really exists. Atomic write-once at the DB level:
// WHERE invite_slug IS NULL — no read-then-write, no overwrite, no race. Existence
// only (not `active`): a since-deactivated slug still attributes a click made while live.
async function stampInviteSlug(profileId, slug) {
  const s = norm(slug);
  if (!profileId || !s) return;
  try {
    if (!(await slugExists(s))) { await coldCall().claimSignup(s, profileId); return; }   // cold-call invite code, else bogus
    const { error } = await supabaseAdmin
      .from('profiles').update({ invite_slug: s })
      .eq('id', profileId).is('invite_slug', null);
    if (error) throw error;
  } catch (e) { if (isSchemaMiss(e)) return; console.error('invite stamp failed:', e.message); }
}

// ponytail: UA-skip + IP/day dedupe is a heuristic, not exact. Upgrade to a
// visit-log table only if sales needs precise unique-visitor counts.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|slackbot|telegrambot|preview|embedly|discordbot|linkedinbot|bingpreview/i;
const seen = new Map();  // `${slug}|${ip}|${yyyy-mm-dd}` -> expiry ms
function dedupeKey(slug, ip) { return `${slug}|${ip}|${new Date().toISOString().slice(0, 10)}`; }

async function recordVisit(slug, ip, ua) {
  const s = norm(slug);
  if (!s || BOT_UA.test(ua || '')) return;
  const key = dedupeKey(s, ip || 'unknown');
  const now = Date.now();
  if (seen.has(key) && seen.get(key) > now) return;
  seen.set(key, now + 26 * 3600 * 1000);
  if (seen.size > 50000) for (const [k, exp] of seen) if (exp <= now) seen.delete(k); // cheap sweep
  if (!(await slugExists(s))) { await coldCall().trackClick(s); return; }   // cold-call invite code
  try {
    const { error } = await supabaseAdmin.rpc('increment_invite_visit', { p_slug: s });
    if (error) throw error;
  } catch (e) {
    if (isSchemaMiss(e)) return;
    // No RPC? fall back to read-add-write (best-effort; visit counts are non-critical).
    try {
      const { data } = await supabaseAdmin.from('invite_links').select('unique_visits').eq('slug', s).maybeSingle();
      if (data) await supabaseAdmin.from('invite_links').update({ unique_visits: (data.unique_visits || 0) + 1 }).eq('slug', s);
    } catch (_) { /* non-fatal */ }
  }
}

async function createLink({ slug, label, assigned_to = null, metadata = {}, created_by = null }) {
  const s = norm(slug);
  if (!s || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(s)) throw { code: 'BAD_SLUG' };
  if (isStaticReserved(s)) throw { code: 'RESERVED' };
  const { data, error } = await supabaseAdmin.from('invite_links')
    .insert({ slug: s, label: String(label || '').trim() || s, assigned_to, metadata, created_by })
    .select('*').single();
  if (error) { if (error.code === '23505') throw { code: 'DUP' }; throw error; }
  return data;
}

async function listLinks() {
  const { data: links, error } = await supabaseAdmin
    .from('invite_links').select('*').order('created_at', { ascending: false });
  if (error) { if (isSchemaMiss(error)) return []; throw error; }
  // signups per slug — one count read each (small N of links).
  const out = [];
  for (const l of links || []) {
    const { count } = await supabaseAdmin
      .from('profiles').select('id', { count: 'exact', head: true }).eq('invite_slug', l.slug);
    out.push({ ...l, signups: count || 0 });
  }
  return out;
}

async function updateLink(slug, { label, assigned_to, active, metadata } = {}) {
  const patch = {};
  if (label !== undefined) patch.label = String(label).trim();
  if (assigned_to !== undefined) patch.assigned_to = assigned_to;
  if (active !== undefined) patch.active = !!active;
  if (metadata !== undefined) patch.metadata = metadata;
  // slug / created_at / unique_visits / created_by are intentionally never writable here.
  const { data, error } = await supabaseAdmin
    .from('invite_links').update(patch).eq('slug', norm(slug)).select('*').single();
  if (error) throw error;
  return data;
}

module.exports = { getPublicConfig, slugExists, stampInviteSlug, recordVisit, createLink, listLinks, updateLink };
