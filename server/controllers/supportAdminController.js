'use strict';

// Admin/support side of support chat — the ops console. Gated by requireAdmin
// (support.view for reads, support.assign for writes) on the isolated admin token.

const { safeError } = require('../utils/httpError');
const chat = require('../services/supportChatService');
const context = require('../services/supportContextService');
const { personaFor, introMessage } = require('../config/supportAgents');
const { REASONS, isValidReason } = require('../config/supportReasons');
const { computeInsights } = require('../services/supportInsightsService');

// Real admin id — used for attribution, the 'mine' filter, and audit. Never shown
// to the customer.
const adminId = (req) => req.admin?.id || req.admin?.email || 'admin';
// Customer-facing display name: the warm support persona for this admin.
const persona = (req) => personaFor(req.admin?.email);

const firstName = (full) => (full ? String(full).trim().split(/\s+/)[0] : null);

// GET /api/admin/support/queue?filter=waiting|mine|all
const queue = async (req, res) => {
  try {
    const threads = await chat.listQueue({ filter: req.query?.filter || 'waiting', adminId: adminId(req) });
    res.json({ threads });
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/support/thread/:id
const getThread = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    await chat.markRead(thread.id, 'admin');
    res.json({ thread, messages: await chat.listMessages(thread.id) });
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/support/thread/:id/context — the customer's live record for the
// conversation rail (profile, recent bookings, host activation/KYC-status/payout).
const threadContext = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    const ctx = await context.getSupportContext({
      userId: thread.user_id || null,
      phone: thread.guest_phone || null,
      isHost: thread.participant_type === 'host',
      currentThreadId: thread.id,
    });
    res.json({ context: ctx });
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/support/thread/:id/reply  { body } — replying also claims an
// unassigned/waiting thread for this admin (persona snapshot stored for the inbox).
const reply = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    if (thread.status === 'waiting' || thread.status === 'bot') {
      await chat.assign(thread.id, adminId(req));
      await chat.setAgentName(thread.id, persona(req));
    }
    const msg = await chat.postMessage({
      threadId: thread.id, sender: 'admin',
      senderId: adminId(req), senderName: persona(req),
      body: req.body?.body,
    });
    res.status(201).json(msg);
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/support/thread/:id/assign — the "Assign to me" ritual. Claims the
// thread AND posts a one-time warm intro so the customer isn't left in silence while
// the agent reads context. No 4-digit code: the admin JWT already identifies them.
const assign = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const name = persona(req);
    const updated = await chat.assign(thread.id, req.body?.admin_id || adminId(req));
    await chat.setAgentName(thread.id, name);

    // One-time intro — only if no human has replied yet (re-assign never re-greets).
    if (!(await chat.hasAdminMessage(thread.id))) {
      let customerFirst = null;
      try {
        const ctx = await context.getSupportContext({
          userId: thread.user_id || null,
          phone: thread.guest_phone || null,
          isHost: thread.participant_type === 'host',
        });
        customerFirst = firstName(ctx?.profile?.name);
      } catch { /* context is a nicety here — intro still goes out without a name */ }
      await chat.postMessage({
        threadId: thread.id, sender: 'admin',
        senderId: adminId(req), senderName: name,
        body: introMessage(name, customerFirst),
      });
    }
    res.json({ thread: updated });
  } catch (e) { safeError(res, e); }
};

// POST /api/admin/support/thread/:id/resolve  { reason_code? }
const resolve = async (req, res) => {
  try {
    const thread = await chat.getThread(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    const rc = req.body?.reason_code;
    if (rc && isValidReason(rc)) await chat.setReasonCode(thread.id, rc); // best-effort, never blocks resolve
    await chat.postMessage({ threadId: thread.id, sender: 'system', body: 'This conversation was marked resolved.' });
    const updated = await chat.resolve(thread.id);
    res.json({ thread: updated });
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/support/insights?days=30 — support-as-product-intelligence.
// Aggregation lives in supportInsightsService (shared with the weekly digest).
const insights = async (req, res) => {
  try {
    res.json(await computeInsights(req.query?.days));
  } catch (e) { safeError(res, e); }
};

// GET /api/admin/support/reasons — the taxonomy for the resolve/close picker.
const reasons = (_req, res) => res.json({ reasons: REASONS });

module.exports = { queue, getThread, threadContext, reply, assign, resolve, insights, reasons };
