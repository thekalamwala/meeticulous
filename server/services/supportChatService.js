'use strict';

/**
 * supportChatService — the thread/message engine behind Host↔Admin + Guest↔Admin
 * support chat. All DB access is via supabaseAdmin (service_role); the tables are
 * RLS-on/no-policy, so nothing reads them directly from the browser.
 *
 * Live updates go out over a Supabase Realtime BROADCAST channel per thread
 * (`support:thread:<id>`). The broadcast is DISPLAY-ONLY — the row written here
 * (through an authz-checked API) is the source of truth; clients reconcile against
 * a REST history fetch. No RLS/Supabase-auth needed (no role has a Supabase Auth
 * session in this app).
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const adminAlert = require('../utils/adminAlert');
const supportHours = require('../utils/supportHours');

// Human-friendly reference from a uuid, e.g. SUP-8F92AB.
const refFrom = (id) => `SUP-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;

// Fire-and-forget broadcast to any realtime topic. Never throws.
async function broadcastTopic(topic, event, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
  } catch (e) {
    console.error('support broadcast failed', topic, e.message);
  }
}

// Per-thread channel — the guest/host/admin chat panels each subscribe to their
// open thread. `support:admin` is a single station channel every admin console
// subscribes to, used to ring on new escalations.
const broadcast = (threadId, event, payload) => broadcastTopic(`support:thread:${threadId}`, event, payload);

// Create a brand-new thread — used both as the fallback in getOrCreateOpenThread
// and by "Start new topic", which deliberately opens a fresh conversation even
// when an open one already exists.
async function createThread({ participantType, userId, guestPhone, subject }) {
  const id = crypto.randomUUID();
  const { data, error } = await supabaseAdmin
    .from('support_threads')
    .insert({
      id,
      reference: refFrom(id),
      participant_type: participantType,
      user_id: userId || null,
      guest_phone: guestPhone || null,
      subject: subject || null,
      status: 'bot',
      last_message_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// The participant's most-recent non-resolved thread, or a fresh one. This is the
// default panel target; multiple topics are reachable via listThreads.
async function getOrCreateOpenThread({ participantType, userId, guestPhone, subject }) {
  let q = supabaseAdmin
    .from('support_threads')
    .select('*')
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1);
  q = userId ? q.eq('user_id', userId) : q.eq('guest_phone', guestPhone || '');
  const { data: existing } = await q;
  if (existing && existing[0]) return existing[0];
  return createThread({ participantType, userId, guestPhone, subject });
}

// All of a participant's threads, newest activity first — powers the topic switcher.
async function listThreads({ userId, guestPhone } = {}) {
  let q = supabaseAdmin
    .from('support_threads')
    .select('id, reference, subject, status, last_message_at, user_unread')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);
  q = userId ? q.eq('user_id', userId) : q.eq('guest_phone', guestPhone || '');
  const { data } = await q;
  return data || [];
}

const getThread = async (threadId) => {
  const { data } = await supabaseAdmin.from('support_threads').select('*').eq('id', threadId).maybeSingle();
  return data || null;
};

// The participant's open (non-resolved) thread, WITHOUT creating one. Used by the
// unread-count poll so a badge check never spawns an empty thread.
async function getOpenThread({ userId, guestPhone } = {}) {
  let q = supabaseAdmin
    .from('support_threads')
    .select('*')
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1);
  q = userId ? q.eq('user_id', userId) : q.eq('guest_phone', guestPhone || '');
  const { data } = await q;
  return (data && data[0]) || null;
}

const listMessages = async (threadId) => {
  const { data } = await supabaseAdmin
    .from('support_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  return data || [];
};

// Has a human agent already replied on this thread? Guards the one-time auto-intro
// so re-assigning / reopening never re-greets the customer.
async function hasAdminMessage(threadId) {
  const { data } = await supabaseAdmin
    .from('support_messages')
    .select('id')
    .eq('thread_id', threadId)
    .eq('sender', 'admin')
    .limit(1);
  return !!(data && data[0]);
}

// Best-effort persona snapshot on the thread (display-only). Isolated from the
// status write so that on a DB where agent_name doesn't exist yet (pre-v3.116)
// a failed update no-ops here and never blocks assign.
async function setAgentName(threadId, agentName) {
  if (!agentName) return;
  await supabaseAdmin.from('support_threads').update({ agent_name: agentName }).eq('id', threadId);
}

// Best-effort contact-reason stamp (analytics). Isolated from resolve() so a
// missing reason_code column (pre-v3.117) never blocks resolving a thread.
async function setReasonCode(threadId, reasonCode) {
  if (!reasonCode) return;
  await supabaseAdmin.from('support_threads').update({ reason_code: reasonCode }).eq('id', threadId);
}

// Post-resolution CSAT (1–5). Column exists since v3.115.
async function setRating(threadId, rating) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return null;
  const { data } = await supabaseAdmin.from('support_threads').update({ rating: r }).eq('id', threadId).select('*').single();
  return data || null;
}

/**
 * Persist a message, advance the thread (last_message_at + the OTHER side's unread),
 * then broadcast it. sender ∈ user|bot|admin|system.
 */
async function postMessage({ threadId, sender, senderId, senderName, body, attachmentUrl }) {
  const text = (body || '').trim();
  // A message must carry text OR an image — an empty one is meaningless.
  if (!text && !attachmentUrl) throw new Error('empty message');

  const row = { thread_id: threadId, sender, sender_id: senderId || null, sender_name: senderName || null, body: text };
  if (attachmentUrl) row.attachment_url = attachmentUrl;
  const { data: msg, error } = await supabaseAdmin
    .from('support_messages')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  const thread = await getThread(threadId);
  const patch = { last_message_at: msg.created_at, updated_at: new Date().toISOString() };
  // Unread accrues to whoever is NOT the author. system messages notify no one.
  if (sender === 'user') patch.admin_unread = (thread?.admin_unread || 0) + 1;
  else if (sender === 'admin' || sender === 'bot') patch.user_unread = (thread?.user_unread || 0) + 1;
  await supabaseAdmin.from('support_threads').update(patch).eq('id', threadId);

  await broadcast(threadId, 'message', msg);
  return msg;
}

// Status transitions. Each broadcasts a `status` event so open panels update live.
async function setStatus(threadId, status, extra = {}) {
  const patch = { status, updated_at: new Date().toISOString(), ...extra };
  const { data } = await supabaseAdmin.from('support_threads').update(patch).eq('id', threadId).select('*').single();
  await broadcast(threadId, 'status', { status, ...extra });
  return data;
}

// Escalate to a human: flip to 'waiting', then (best-effort, never blocking) ring
// every open admin console over the `support:admin` channel AND email the team.
// Both callers — the manual "Talk to a human" button and Bolt's auto-handoff —
// route through here, so the alert lives in one place.
async function escalate(threadId, aiSummary) {
  const updated = await setStatus(threadId, 'waiting', aiSummary ? { ai_summary: aiSummary } : {});
  const t = updated || (await getThread(threadId));
  if (t) {
    const who = t.participant_type === 'host' ? 'Host' : 'Guest';
    const contact = t.guest_phone ? ` · ${t.guest_phone}` : '';
    const open = supportHours.isOpen();
    // Ring ONLY during support hours — no point waking a dashboard nobody's watching
    // at 3am. Off-hours it's a logged ticket; the email still goes out.
    if (open) {
      broadcastTopic('support:admin', 'escalation', {
        thread_id: t.id, reference: t.reference, participant_type: t.participant_type, summary: aiSummary || null,
      });
    }
    // Email: throttled per-thread so re-escalation of the same thread sends once.
    adminAlert({
      subject: `Support ${open ? 'escalation' : 'ticket (off-hours)'} — ${t.reference}`,
      key: `support-escalation:${t.id}`,
      lines: [
        `${who}${contact} needs a human on support chat.`,
        aiSummary ? `Details: ${aiSummary}` : 'They asked to talk to a person.',
        open ? '' : `Raised outside support hours (${supportHours.LABEL}).`,
      ].filter(Boolean),
      link: `${process.env.CLIENT_URL || 'https://bookasloth.com'}/admin/support/chat`,
      category: 'Support Alert',
    }).catch(() => {});
  }
  return t;
}
const assign   = (threadId, adminId) => setStatus(threadId, 'assigned', { assigned_admin: adminId || null });
const resolve  = (threadId, rating) => setStatus(threadId, 'resolved', rating ? { rating } : {});

// Zero the unread counter for one side after they've read the thread.
async function markRead(threadId, side) {
  const col = side === 'admin' ? 'admin_unread' : 'user_unread';
  await supabaseAdmin.from('support_threads').update({ [col]: 0 }).eq('id', threadId);
}

// Admin inbox. filter: 'waiting' (needs a human), 'mine' (assigned to me), 'all'.
async function listQueue({ filter = 'waiting', adminId } = {}) {
  let q = supabaseAdmin
    .from('support_threads')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (filter === 'waiting') q = q.eq('status', 'waiting');
  else if (filter === 'mine') q = q.eq('assigned_admin', adminId || '').neq('status', 'resolved');
  else q = q.neq('status', 'resolved'); // 'all' open threads
  const { data } = await q;
  const threads = data || [];

  // Attach each thread's latest message body for the queue preview line. One
  // query for all threads; newest-per-thread wins. Best-effort — never blocks.
  const ids = threads.map((t) => t.id);
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin
      .from('support_messages')
      .select('thread_id, body, created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: false });
    const latest = {};
    (msgs || []).forEach((m) => { if (!latest[m.thread_id] && m.body) latest[m.thread_id] = m.body; });
    threads.forEach((t) => { t.last_message = latest[t.id] || null; });
  }
  return threads;
}

module.exports = {
  refFrom, broadcast, createThread, getOrCreateOpenThread, getOpenThread, getThread, listThreads, listMessages,
  hasAdminMessage, setAgentName, setReasonCode, setRating,
  postMessage, setStatus, escalate, assign, resolve, markRead, listQueue,
};
