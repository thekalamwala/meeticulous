'use strict';

// Host/guest side of support chat. Auth is the normal `protect` bearer JWT; a
// participant may only touch their own thread. Live delivery is via the service's
// broadcast — this controller is plain REST (send + history), the app's usual shape.

const { safeError } = require('../utils/httpError');
const supportHours = require('../utils/supportHours');
const chat = require('../services/supportChatService');
const bot = require('../services/botService');
const supportActions = require('../services/supportActions');
const supportContext = require('../services/supportContextService');
// NOTE: config/supabase + uploadController are required LAZILY inside
// uploadAttachment (below), not at module top. config/supabase throws on load
// when SUPABASE_SERVICE_ROLE_KEY is absent (the unit-test env), which would take
// down every support suite that requires this controller. The attachment handler
// is the only place they're needed, so pay that cost only when it actually runs.

// Bolt auto-reply. Fired after the user's message is stored, ONLY while the thread
// is still bot-handled (status 'bot') — once a human takes over ('waiting'/'assigned')
// Bolt stays silent. Fire-and-forget: the HTTP response already returned, and the
// bot's answer reaches the client over the thread's realtime broadcast. Never throws.
// ponytail: answers each message standalone (no thread history passed to askBot);
// wire conversationId ↔ thread if follow-up context ever matters.
async function botAutoReply(thread, question) {
  try {
    // Self-service actions run BEFORE the FAQ bot: if the customer (whose identity
    // we know on an authenticated thread) is asking to resend their confirmation /
    // invoice / calendar invite, DO it rather than answer with words.
    const action = supportActions.detectAction(question);
    if (action && (thread.user_id || thread.guest_phone)) {
      let msg;
      try {
        const r = await supportActions.runAction(action, {
          userId: thread.user_id, guestPhone: thread.guest_phone, isHost: thread.participant_type === 'host',
        });
        msg = r.message;
      } catch (e) {
        console.error('support action failed', action, thread?.id, e.message);
        msg = "I hit a snag doing that just now. Tap 'Talk to a human' and a teammate will sort it out.";
      }
      if (msg) {
        await chat.postMessage({ threadId: thread.id, sender: 'bot', senderName: 'Tithi', body: msg });
        return; // handled — skip the FAQ bot
      }
    }

    // AUTHENTICATED context: the thread is tied to a verified user_id / guest_phone,
    // so Bolt may answer this person's own booking/plan/KYC/payout questions from real
    // state. Best-effort — a lookup failure just means Bolt answers without it.
    let ctx = null;
    try {
      ctx = await supportContext.getSupportContext({
        userId: thread.user_id || null,
        phone: thread.guest_phone || null,
        isHost: thread.participant_type === 'host',
      });
    } catch (e) { console.error('support context lookup failed', thread?.id, e.message); }

    const out = await bot.askBot({ question, sessionRef: thread.reference, context: ctx });
    if (!out || !String(out.answer || '').trim()) return;
    await chat.postMessage({ threadId: thread.id, sender: 'bot', senderName: 'Tithi', body: out.answer });
    // Bolt couldn't answer confidently → hand to a human (flips the banner to 'waiting').
    if (out.escalate) await chat.escalate(thread.id, question);
  } catch (e) {
    console.error('bolt auto-reply failed', thread?.id, e.message);
  }
}

// `protect` only attaches { id, email } to req.user — never is_host — so the old
// `req.user.is_host ? 'host' : 'guest'` stamped EVERY thread 'guest', making Bolt
// tell hosts "you're a guest". Resolve the real flag from the profile instead.
// Lazy require of config/supabase mirrors uploadAttachment (it throws on load in the
// test env when the service-role key is absent). Fails soft to 'guest'.
async function resolveParticipantType(userId) {
  if (!userId) return 'guest';
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data } = await supabaseAdmin.from('profiles').select('is_host').eq('id', userId).maybeSingle();
    return data?.is_host ? 'host' : 'guest';
  } catch (_) { return 'guest'; }
}

// A participant owns a thread if the user_id matches, or (guest, no profile) the phone.
const owns = (thread, user) =>
  !!thread && (
    (thread.user_id && thread.user_id === user?.id) ||
    (!!thread.guest_phone && thread.guest_phone === user?.phone)
  );

// GET /api/support/thread — the caller's open thread (created on first use).
const getMyThread = async (req, res) => {
  try {
    const participantType = await resolveParticipantType(req.user?.id);
    const existingCount = null; // (reserved) — could return unread here later
    const thread = await chat.getOrCreateOpenThread({
      participantType,
      userId: req.user?.id,
      guestPhone: req.user?.phone,
    });
    // Seed a one-time greeting so a brand-new thread isn't empty.
    const messages = await chat.listMessages(thread.id);
    if (messages.length === 0) {
      await chat.postMessage({
        threadId: thread.id, sender: 'system',
        body: "Hi! Ask us anything — the Tithi assistant answers instantly, and our team can jump in when you need a person.",
      });
    }
    await chat.markRead(thread.id, 'user');
    res.json({ thread, messages: await chat.listMessages(thread.id), unused: existingCount });
  } catch (e) { safeError(res, e); }
};

// GET /api/support/threads — all of the caller's topics for the switcher (never
// creates one). Newest activity first.
const listThreads = async (req, res) => {
  try {
    const threads = await chat.listThreads({ userId: req.user?.id, guestPhone: req.user?.phone });
    res.json({ threads });
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/new — "Start new topic": open a fresh thread even when
// one is already open, so a new question isn't buried in old history.
const startTopic = async (req, res) => {
  try {
    const participantType = await resolveParticipantType(req.user?.id);
    const thread = await chat.createThread({
      participantType, userId: req.user?.id, guestPhone: req.user?.phone,
    });
    await chat.postMessage({
      threadId: thread.id, sender: 'system',
      body: "New topic started. Ask away — Tithi replies instantly, and our team can jump in when you need a person.",
    });
    await chat.markRead(thread.id, 'user');
    res.status(201).json({ thread, messages: await chat.listMessages(thread.id) });
  } catch (e) { safeError(res, e); }
};

// GET /api/support/thread/:id/messages
const getMessages = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    await chat.markRead(thread.id, 'user');
    res.json({ thread, messages: await chat.listMessages(thread.id) });
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/:id/messages  { body }
const sendMessage = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    // Messaging a resolved thread reopens it to the bot phase — otherwise the
    // message posts into a thread the admin queue hides, and it's lost. Reopening
    // puts Bolt back on it and lets it re-escalate if needed.
    if (thread.status === 'resolved') {
      await chat.setStatus(thread.id, 'bot');
      thread.status = 'bot';
    }
    const msg = await chat.postMessage({
      threadId: thread.id, sender: 'user',
      senderId: req.user?.id, senderName: req.user?.name,
      body: req.body?.body, attachmentUrl: req.body?.attachment_url,
    });
    res.status(201).json(msg);
    // Async Bolt reply while the thread is still bot-handled — after the response.
    // Skip when the turn is an image with no text (nothing for Bolt to answer).
    if (thread.status === 'bot' && msg.body) botAutoReply(thread, msg.body);
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/:id/attachment — upload a screenshot/image for a
// message (field "image"). Any thread OWNER may upload (guests included — unlike
// /upload/image which is host/admin-only), so it lives here, not in uploadController.
// Content is sniffed by magic bytes; only JPG/PNG/WEBP pass. Returns { url }.
const uploadAttachment = async (req, res) => {
  try {
    // Lazy require: keep config/supabase off the module-load path (see note up top).
    const { supabaseAdmin } = require('../config/supabase');
    const { sniffImage } = require('./uploadController');
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const sniffed = sniffImage(req.file.buffer);
    if (!sniffed) return res.status(400).json({ message: 'File must be a JPG, PNG, or WEBP image.' });
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `support/${thread.id}/${Date.now()}_${rand}${sniffed.ext}`;
    const { error } = await supabaseAdmin.storage
      .from('images').upload(key, req.file.buffer, { contentType: sniffed.mime, upsert: true });
    if (error) return safeError(res, error, 500, 'Upload failed. Please try again.');
    const { data: { publicUrl } } = supabaseAdmin.storage.from('images').getPublicUrl(key);
    res.json({ url: publicUrl });
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/:id/escalate  { summary } — hand off to a human. The
// client collects a detailed problem description first (best-in-class intake), so
// the team opens the thread with context instead of a cold "user wants help".
const escalateThread = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    const summary = (req.body?.summary || '').trim() || null;
    const open = supportHours.isOpen();
    // Honest expectation-setting: a live handoff in hours, a logged ticket after.
    const note = open
      ? 'Thanks — connecting you to the Meeticulous team. Someone will reply here shortly.'
      : `Thanks — our team is offline right now (${supportHours.LABEL}). Your ticket ${thread.reference} is logged and we'll reply here as soon as we're back. Tithi can still help meanwhile.`;
    await chat.postMessage({ threadId: thread.id, sender: 'system', body: note });
    const updated = await chat.escalate(thread.id, summary);
    res.json({ thread: updated, open });
  } catch (e) { safeError(res, e); }
};

// GET /api/support/hours — is live support open now? Drives the client's
// "Talk to a human" vs "Raise a ticket" copy. { open, label }.
const hours = (req, res) => res.json({ open: supportHours.isOpen(), label: supportHours.LABEL });

// GET /api/support/unread — the caller's unread reply count for a sidebar/tab
// badge. Read-only: never creates a thread. { count, thread_id }.
const unread = async (req, res) => {
  try {
    const thread = await chat.getOpenThread({ userId: req.user?.id, guestPhone: req.user?.phone });
    res.json({ count: thread?.user_unread || 0, thread_id: thread?.id || null });
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/:id/rating  { rating: 1..5 } — post-resolution CSAT.
const rateThread = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    const updated = await chat.setRating(thread.id, req.body?.rating);
    if (!updated) return res.status(400).json({ message: 'Rating must be 1–5.' });
    res.json({ thread: updated });
  } catch (e) { safeError(res, e); }
};

// POST /api/support/thread/:id/read
const markRead = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!owns(thread, req.user)) return res.status(404).json({ message: 'Thread not found' });
    await chat.markRead(thread.id, 'user');
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

module.exports = { getMyThread, listThreads, startTopic, getMessages, sendMessage, escalateThread, rateThread, markRead, unread, hours, botAutoReply, uploadAttachment };
