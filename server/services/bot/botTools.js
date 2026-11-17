'use strict';

/**
 * botTools — Tithi's account tools for the AUTHENTICATED support thread. Exposed as
 * model tools so the agent picks the right one from any phrasing and composes several —
 * the industry-grade tool-calling path, replacing the brittle regex ladder.
 *
 *   READS  (Slice 1): get_booking_status / get_refund_status / get_listing_status /
 *                     get_payout_status / get_plan_status. Status only, never amounts.
 *   WRITES (Slice 2): resend_confirmation / resend_invoice / resend_calendar — the three
 *                     email-only, idempotent, own-booking actions from supportActions,
 *                     now behind a CONFIRMATION GATE (confirmed=false previews; the write
 *                     runs only on confirmed=true, after the user agrees).
 *
 * SAFETY:
 *  - OWN-DATA-ONLY. Reads use `ctx` (server-resolved from a verified thread); writes use
 *    `identity` ({userId, guestPhone, isHost}) and look the booking up server-side — the
 *    bot never trusts a client-supplied id.
 *  - Authenticated thread only: askBot gates the whole loop on `context`, so the public
 *    widget never reaches any tool. A write with no identity refuses.
 *  - Money disputes are blocked upstream (DISPUTE_RE) before the loop runs.
 *  - Writes are email-only + idempotent (resends); no money moves, no booking mutates.
 *    State-changing actions (reschedule/cancel) come in Slice 3 on this same gate.
 */

const ca = require('./contextAnswer');
const supportActions = require('../supportActions');

const NONE = 'No matching record found on this account.';
const NO_IDENTITY = "I can only do that on a signed-in account — if you reached out another way, a teammate can help.";

const fmtDate = (s) => { try { return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// Human label per write action (used in the preview the model relays).
const WRITE_LABEL = {
  resend_confirmation: 'booking confirmation email',
  resend_invoice: 'GST invoice',
  resend_calendar: 'calendar invite',
  send_cancel_link: 'secure link to cancel your booking',
};

// The confirmation gate. confirmed!==true → a PREVIEW (nothing sent); confirmed===true →
// run the real supportActions write. Own-booking only (looked up server-side from identity).
async function runWrite(key, identity, input) {
  if (!identity || !(identity.userId || identity.guestPhone)) return NO_IDENTITY;
  if (!input || input.confirmed !== true) {
    // Cancel link carries a refund-tier disclosure in its preview (safe-split: the bot
    // sends the link, the user cancels on the page — the bot never cancels or refunds).
    if (key === 'send_cancel_link') {
      let info = null;
      try { info = await supportActions.cancelLinkInfo(identity); } catch (_) { /* best-effort */ }
      if (info && info.ok) {
        return `[PREVIEW — nothing sent yet] Calling again with confirmed=true will EMAIL the secure link to cancel ${info.label}${info.email ? ` to ${info.email}` : ''} — it does NOT cancel anything; the user cancels on that page. `
          + `Tell the user that cancelling now would get them ${info.tierText}, and ask them to confirm; only call again with confirmed=true after they clearly say yes.`;
      }
      if (info && !info.ok) return info.message;
    }
    let b = null;
    try { b = await supportActions.latestBooking(identity); } catch (_) { /* preview is best-effort */ }
    const label = b ? `${b.service_title || 'your booking'}${b.scheduled_at ? ` on ${fmtDate(b.scheduled_at)}` : ''}` : 'your most recent booking';
    const to = b && b.guest_email ? ` to ${b.guest_email}` : '';
    return `[PREVIEW — nothing sent yet] Calling again with confirmed=true will resend the ${WRITE_LABEL[key]} for ${label}${to}. `
      + 'Tell the user exactly this and ask them to confirm; only call again with confirmed=true after they clearly say yes.';
  }
  try {
    const r = await supportActions.runAction(key, identity);
    return (r && r.message) || (r && r.ok ? 'Done.' : "I couldn't complete that just now — want me to pull in a teammate?");
  } catch (_) {
    return 'I hit a snag doing that — tell the user a teammate will sort it out.';
  }
}

// name -> { hostOnly, write, spec, run(ctx) }. Reads reuse contextAnswer's vetted helper;
// writes route through runWrite (the key equals the supportActions action key).
const TOOLS = {
  get_booking_status: {
    hostOnly: false,
    spec: {
      name: 'get_booking_status',
      description: "The signed-in user's most recent booking — reference, service, status, payment status and time. Use for 'where's my booking', 'is my appointment confirmed', 'did my payment go through'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.bookingAnswer(ctx),
  },
  get_refund_status: {
    hostOnly: false,
    spec: {
      name: 'get_refund_status',
      description: "Whether the user has a refund in progress or completed on a recent booking (status only, never an amount). Use for 'where's my refund', 'did my money come back'. NOT for a dispute (double charge / fraud) — those go to a human.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.refundAnswer(ctx),
  },
  get_listing_status: {
    hostOnly: true,
    spec: {
      name: 'get_listing_status',
      description: "A host's public listing state — why it is or isn't live (plan active, KYC/verification, an active service). Use for 'why isn't my listing live', 'am I showing up'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.listingAnswer(ctx),
  },
  get_payout_status: {
    hostOnly: true,
    spec: {
      name: 'get_payout_status',
      description: "A host's payout account state — linked, activating, or active (status only). Use for 'when do I get paid', 'is my payout set up'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.payoutAnswer(ctx),
  },
  get_plan_status: {
    hostOnly: true,
    spec: {
      name: 'get_plan_status',
      description: "A host's subscription/plan state — which plan, active or expired, renewal. Use for 'what plan am I on', 'has my subscription expired'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.planAnswer(ctx),
  },

  // ── Writes (confirmation-gated) ──────────────────────────────────────────────
  resend_confirmation: {
    hostOnly: false, write: true,
    spec: {
      name: 'resend_confirmation',
      description: "Re-send the booking confirmation email for the user's most recent booking. Call confirmed=false first to preview; confirmed=true only after the user agrees.",
      input_schema: { type: 'object', properties: { confirmed: { type: 'boolean', description: 'true ONLY after the user has explicitly agreed in their latest message' } }, required: ['confirmed'] },
    },
  },
  resend_invoice: {
    hostOnly: false, write: true,
    spec: {
      name: 'resend_invoice',
      description: "Email the GST invoice for the user's most recent booking. Call confirmed=false first to preview; confirmed=true only after the user agrees.",
      input_schema: { type: 'object', properties: { confirmed: { type: 'boolean', description: 'true ONLY after the user has explicitly agreed in their latest message' } }, required: ['confirmed'] },
    },
  },
  resend_calendar: {
    hostOnly: false, write: true,
    spec: {
      name: 'resend_calendar',
      description: "Email an .ics calendar invite for the user's most recent booking. Call confirmed=false first to preview; confirmed=true only after the user agrees.",
      input_schema: { type: 'object', properties: { confirmed: { type: 'boolean', description: 'true ONLY after the user has explicitly agreed in their latest message' } }, required: ['confirmed'] },
    },
  },
  send_cancel_link: {
    hostOnly: false, write: true,
    spec: {
      name: 'send_cancel_link',
      description: "Email the user a SECURE one-tap link to cancel their most recent booking THEMSELVES — you do NOT cancel or refund anything; they do it on the page, which shows the exact refund. Use when the user wants to cancel a booking. Call confirmed=false first to preview the refund tier; confirmed=true only after they agree.",
      input_schema: { type: 'object', properties: { confirmed: { type: 'boolean', description: 'true ONLY after the user has explicitly agreed in their latest message' } }, required: ['confirmed'] },
    },
  },
};

// Tool specs for this caller. Host-only READ tools are hidden from guests; write tools
// are available to both (they act on the caller's own booking).
function toolSpecsFor(ctx) {
  const isHost = !!ctx && ctx.kind === 'host';
  return Object.values(TOOLS)
    .filter((t) => isHost || !t.hostOnly)
    .map((t) => t.spec);
}

// Execute one tool → the string the model sees as tool_result. Async (writes do I/O).
// Never throws, never leaks: unknown tool / cross-account / missing identity → safe note.
async function runTool(name, ctx, identity = null, input = null) {
  const t = TOOLS[name];
  if (!t) return NONE;
  if (t.hostOnly && !(ctx && ctx.kind === 'host')) return NONE;
  if (t.write) return runWrite(name, identity, input);
  const out = t.run(ctx || {});
  return (out && String(out).trim()) || NONE;
}

// Does this tool perform an action? (askBot uses it to require identity + log the write.)
const isWriteTool = (name) => !!(TOOLS[name] && TOOLS[name].write);

module.exports = { TOOLS, toolSpecsFor, runTool, isWriteTool, NONE, NO_IDENTITY };
