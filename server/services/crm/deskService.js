'use strict';
/**
 * deskService.js — the five Sales Desk queues.
 *
 * Each queue is a deterministic read over existing lead data (+ the score/intent
 * from v3.112 and last_reply_at from v3.113). No writes. The column-vs-column
 * comparisons Postgres/supabase-js can't express as filters (e.g. last_reply_at >
 * last_contacted_at) are refined in JS over a bounded candidate set — the pure
 * predicates/merge below are unit-tested; the query wrappers are thin.
 *
 * Reads the state the lifecycle engine (P0-4) writes; it never recomputes.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { CLOSED } = require('./lifecycleRules');

// Leads no longer needing sales/relations action: converted-past-Won + exits.
// (Onboarded/`activated` stays in — the activation queue works those toward Won.)
const OPEN_EXCLUDE = CLOSED;
const CANDIDATE_CAP = 200;   // upper bound scanned per queue; count is "N" or "N+" at the cap
const DEFAULT_LIMIT = 25;

// ── pure helpers (unit-tested) ───────────────────────────────────────────────

/** A reply came in after our last outbound (or with no outbound yet). */
function isUnansweredReply(lead) {
  if (!lead || !lead.last_reply_at) return false;
  const since = lead.last_contacted_at || lead.created_at;
  return !since || new Date(lead.last_reply_at) > new Date(since);
}

/** Activation reason for a linked lead, or null if not an activation case. */
function activationReason(onboarded, hasBooking) {
  if (onboarded === undefined) return null;      // profile not found → skip
  if (onboarded && !hasBooking) return 'Live — no booking yet';
  if (!onboarded) return 'Signed up — not activated';
  return null;                                    // onboarded AND booked → done
}

/**
 * Merge queue contributors into a deduped, order-preserving list, collecting the
 * reasons a lead qualifies. `entries` = [{ lead, reason }] in priority order.
 * @returns [{ ...lead, _reasons: string[] }]
 */
function mergeById(entries) {
  const byId = new Map();
  for (const { lead, reason } of entries) {
    if (!lead) continue;
    const seen = byId.get(lead.id);
    if (seen) { if (reason && !seen._reasons.includes(reason)) seen._reasons.push(reason); }
    else byId.set(lead.id, { ...lead, _reasons: reason ? [reason] : [] });
  }
  return [...byId.values()];
}

const FIELDS = ['id', 'name', 'business_name', 'status', 'score', 'intent', 'next_action',
  'owner_admin_id', 'last_contacted_at', 'last_reply_at', 'expected_value_paise'];

function shape(lead, reasons) {
  const out = {};
  for (const f of FIELDS) out[f] = lead[f] ?? null;
  out.reasons = reasons || lead._reasons || [];
  return out;
}

/** { count, leads } from a refined row set + a reason function. */
function pack(rows, limit, reasonFor) {
  return {
    count: rows.length,
    leads: rows.slice(0, limit).map((l) => shape(l, reasonFor ? reasonFor(l) : l._reasons)),
  };
}

// ── query wrappers (thin) ────────────────────────────────────────────────────

const openBase = () =>
  supabaseAdmin.from('leads').select('*').not('status', 'in', `(${OPEN_EXCLUDE.join(',')})`);

function endOfTodayIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

async function replies(limit) {
  const { data } = await openBase()
    .not('last_reply_at', 'is', null)
    .order('last_reply_at', { ascending: true }).limit(CANDIDATE_CAP);
  const rows = (data || []).filter(isUnansweredReply);
  return pack(rows, limit, () => ['Replied — unanswered']);
}

async function highIntent(limit) {
  const { data } = await supabaseAdmin.from('leads').select('*')
    .eq('intent', 'high').is('owner_admin_id', null)
    .in('status', ['new', 'contacted', 'replied', 'qualified'])
    .order('score', { ascending: false }).limit(CANDIDATE_CAP);
  return pack(data || [], limit, (l) => [`High intent (score ${l.score ?? 0})`]);
}

async function followupsDue(limit) {
  const end = endOfTodayIso();
  // Union both mechanisms: explicit follow-up tasks AND the automation's
  // next_action_at (which carries the real signal — the task table is near-empty).
  const [{ data: fus }, { data: naLeads }] = await Promise.all([
    supabaseAdmin.from('lead_follow_ups')
      .select('lead_id, due_at, title').eq('status', 'open')
      .lte('due_at', end).order('due_at', { ascending: true }).limit(CANDIDATE_CAP),
    openBase().not('next_action_at', 'is', null)
      .lte('next_action_at', end).order('next_action_at', { ascending: true }).limit(CANDIDATE_CAP),
  ]);
  const title = new Map(); const taskIds = [];
  for (const f of fus || []) if (!title.has(f.lead_id)) { title.set(f.lead_id, f.title); taskIds.push(f.lead_id); }
  let taskLeads = [];
  if (taskIds.length) {
    const { data } = await openBase().in('id', taskIds);        // drop non-open leads
    const byId = new Map((data || []).map((l) => [l.id, l]));
    taskLeads = taskIds.map((id) => byId.get(id)).filter(Boolean);
  }
  // Tasks first (they carry an explicit title), then next_action leads; dedup.
  const entries = [
    ...taskLeads.map((l) => ({ lead: l, reason: `Follow-up due: ${(title.get(l.id) || '').trim()}`.trim() })),
    ...(naLeads || []).map((l) => ({ lead: l, reason: `Next: ${(l.next_action || 'follow up').trim()}` })),
  ];
  return pack(mergeById(entries), limit);
}

// Linked-account state for a set of leads: onboarding + has-paid-booking.
async function accountCtx(profileIds) {
  const ids = [...new Set(profileIds.filter(Boolean))];
  const onboarded = new Map(); const hasBooking = new Set();
  if (!ids.length) return { onboarded, hasBooking };
  const { data: profs } = await supabaseAdmin.from('profiles').select('id, onboarding_completed').in('id', ids);
  const { data: booked } = await supabaseAdmin.from('bookings').select('host_id').eq('payment_status', 'paid').in('host_id', ids);
  for (const p of profs || []) onboarded.set(p.id, !!p.onboarding_completed);
  for (const b of booked || []) hasBooking.add(b.host_id);
  return { onboarded, hasBooking };
}

async function activation(limit) {
  const { data: cands } = await openBase().not('profile_id', 'is', null).limit(CANDIDATE_CAP);
  if (!cands?.length) return { count: 0, leads: [] };
  const { onboarded, hasBooking } = await accountCtx(cands.map((l) => l.profile_id));
  const rows = [];
  for (const l of cands) {
    const reason = activationReason(onboarded.get(l.profile_id), hasBooking.has(l.profile_id));
    if (reason) rows.push({ ...l, _reasons: [reason] });
  }
  return pack(rows, limit);
}

async function needsAttention(limit) {
  const nowIso = new Date().toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 864e5).toISOString();

  // 1. unanswered replies
  const { data: repCand } = await openBase()
    .not('last_reply_at', 'is', null).order('last_reply_at', { ascending: true }).limit(CANDIDATE_CAP);
  const replyRows = (repCand || []).filter(isUnansweredReply).map((l) => ({ lead: l, reason: 'Replied — unanswered' }));

  // 2. overdue follow-ups — union tasks with a past next_action_at.
  const [{ data: ovf }, { data: ovNa }] = await Promise.all([
    supabaseAdmin.from('lead_follow_ups').select('lead_id').eq('status', 'open').lt('due_at', nowIso).limit(CANDIDATE_CAP),
    openBase().not('next_action_at', 'is', null).lt('next_action_at', nowIso).limit(CANDIDATE_CAP),
  ]);
  const ovTaskIds = [...new Set((ovf || []).map((f) => f.lead_id))];
  const overdueRows = [];
  if (ovTaskIds.length) {
    const { data: ovLeads } = await openBase().in('id', ovTaskIds);
    for (const l of ovLeads || []) overdueRows.push({ lead: l, reason: 'Follow-up overdue' });
  }
  for (const l of ovNa || []) overdueRows.push({ lead: l, reason: 'Follow-up overdue' });

  // 3. high-value, gone quiet 7+ days
  const { data: hv } = await openBase()
    .gt('expected_value_paise', 0).lt('last_activity_at', weekAgoIso).limit(CANDIDATE_CAP);
  const hvRows = (hv || []).map((l) => ({ lead: l, reason: 'High value — no touch 7d' }));

  // Priority order: overdue first, then replies, then stale value.
  const merged = mergeById([...overdueRows, ...replyRows, ...hvRows]);
  return pack(merged, limit);
}

/** All five queues. */
async function getDesk(limit = DEFAULT_LIMIT) {
  const [needs_attention, repliesQ, followups, high_intent, activationQ] = await Promise.all([
    needsAttention(limit), replies(limit), followupsDue(limit), highIntent(limit), activation(limit),
  ]);
  return { needs_attention, replies: repliesQ, followups, high_intent, activation: activationQ };
}

// ── Relationship Desk (relationship engine PR-5) ─────────────────────────────
// The "who to talk to today" queue: open touch_recommendations joined to their
// lead's identity + health. Read-only over what the lifecycle tick wrote.
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const HEALTH_RANK = { at_risk: 0, dormant: 1, cooling: 2, steady: 3, thriving: 4 };

/** PURE: most urgent first — priority, then worst health, then oldest. Unit-tested. */
function rankRecommendations(rows) {
  return [...(rows || [])].sort((a, b) =>
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    || (HEALTH_RANK[a.health_state] ?? 9) - (HEALTH_RANK[b.health_state] ?? 9)
    || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
}

// Flatten an embedded subject (PostgREST returns it nested) onto the rec. A rec is
// backed by EITHER a lead (subject_type 'lead'/null → leads embed) or a guest
// (subject_type 'guest' → contacts embed, PR-9); both present the same shape so the Desk
// renders them uniformly. Guests carry no business_name.
function flattenRec(r) {
  const isGuest = r.subject_type === 'guest' || !!r.contact_id;
  const subj = (isGuest ? (r.contacts || r.contact) : (r.leads || r.lead)) || {};
  return {
    id: r.id, lead_id: r.lead_id ?? null, contact_id: r.contact_id ?? null,
    subject_type: r.subject_type || 'lead',
    reason: r.reason, touch_type: r.touch_type,
    priority: r.priority, suggested_channel: r.suggested_channel, suggested_sender: r.suggested_sender,
    mode: r.mode, explanation: r.explanation, due_at: r.due_at, created_at: r.created_at,
    name: subj.name ?? null, business_name: subj.business_name ?? null,
    health_state: subj.health_state ?? null, health_score: subj.health_score ?? null,
    last_meaningful_interaction_at: subj.last_meaningful_interaction_at ?? null,
    last_automated_touch_at: subj.last_automated_touch_at ?? null,
  };
}

// Guest recs live in the SAME table with subject_type='guest' + contact_id, joined to
// contacts instead of leads. Queried separately (not one embed) so a pre-v3.139 DB — where
// the contacts health/clock columns don't exist yet — fails SOFT to no guest rows rather
// than erroring the whole Desk. Best-effort; returns [] on any error.
async function guestRecommendations() {
  try {
    const { data, error } = await supabaseAdmin
      .from('touch_recommendations')
      .select('id, lead_id, contact_id, subject_type, reason, touch_type, priority, suggested_channel, suggested_sender, mode, explanation, due_at, created_at, contacts(name, health_state, health_score, last_meaningful_interaction_at, last_automated_touch_at)')
      .eq('status', 'open').eq('subject_type', 'guest')
      .limit(CANDIDATE_CAP);
    if (error) return [];
    return (data || []).map(flattenRec);
  } catch (_) {
    return [];
  }
}

async function getRelationships(limit = DEFAULT_LIMIT) {
  const { data, error } = await supabaseAdmin
    .from('touch_recommendations')
    .select('id, lead_id, contact_id, subject_type, reason, touch_type, priority, suggested_channel, suggested_sender, mode, explanation, due_at, created_at, leads(name, business_name, health_state, health_score, last_meaningful_interaction_at, last_automated_touch_at)')
    .eq('status', 'open').neq('subject_type', 'guest')
    .limit(CANDIDATE_CAP);
  // Schema-fallback: pre-v3.136 DB (table missing) → empty queue, never a 500.
  if (error) return { count: 0, items: [] };
  const leadRows = (data || []).map(flattenRec);
  const guestRows = await guestRecommendations();       // fails soft to [] on a pre-v3.139 DB
  const rows = rankRecommendations([...leadRows, ...guestRows]);
  return { count: rows.length, items: rows.slice(0, limit) };
}

module.exports = {
  getDesk, getRelationships, rankRecommendations, flattenRec,
  isUnansweredReply, activationReason, mergeById, shape,
};
