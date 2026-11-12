'use strict';

/**
 * botTools — Tithi's read-only "status lookup" tools for the AUTHENTICATED support
 * thread. Each wraps the SAME live account context (supportContextService) that
 * contextAnswer already uses, but exposed as model tools so the agent picks the right
 * one from any phrasing and can compose several — the industry-grade tool-calling path,
 * replacing the brittle regex ladder.
 *
 * SAFETY (Slice 1):
 *  - READ-ONLY. Status only, never amounts, never a mutation. (Writes stay in the
 *    regex supportActions path until Slice 2 adds a confirmation gate.)
 *  - OWN-DATA-ONLY. Everything reads from `ctx`, which askBot only ever has on an
 *    authenticated thread (server-resolved from a verified user_id / guest_phone). The
 *    public widget has no ctx, so it never reaches these tools.
 *  - Money disputes are blocked upstream (DISPUTE_RE) before the loop runs, so a tool
 *    can never answer a chargeback/fraud question from state.
 */

const ca = require('./contextAnswer');

const NONE = 'No matching record found on this account.';

// name -> { hostOnly, spec (Anthropic tool), run(ctx) -> string|null }.
// `run` reuses contextAnswer's vetted per-intent helper, so the facts + links match
// exactly what the regex path would have said.
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
      description: "Whether the user has a refund in progress or completed on a recent booking (status only, never an amount). Use for 'where's my refund', 'did my money come back', 'has my cancellation been refunded'. Do NOT use for a dispute (double charge / fraud / unauthorized) — those go to a human.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.refundAnswer(ctx),
  },
  get_listing_status: {
    hostOnly: true,
    spec: {
      name: 'get_listing_status',
      description: "A host's public listing state — why it is or isn't live (plan active, KYC/verification, an active service). Use for 'why isn't my listing live', 'am I showing up', 'is my page published'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.listingAnswer(ctx),
  },
  get_payout_status: {
    hostOnly: true,
    spec: {
      name: 'get_payout_status',
      description: "A host's payout account state — linked, activating, or active (status only). Use for 'when do I get paid', 'where are my earnings', 'is my payout set up'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.payoutAnswer(ctx),
  },
  get_plan_status: {
    hostOnly: true,
    spec: {
      name: 'get_plan_status',
      description: "A host's subscription/plan state — which plan, active or expired, renewal. Use for 'what plan am I on', 'has my subscription expired', 'when does my plan renew'.",
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => ca.planAnswer(ctx),
  },
};

// The tool specs available for this caller — host-only tools are hidden from guests so
// the model can't look up (or hallucinate) host state for a guest.
function toolSpecsFor(ctx) {
  const isHost = !!ctx && ctx.kind === 'host';
  return Object.values(TOOLS)
    .filter((t) => isHost || !t.hostOnly)
    .map((t) => t.spec);
}

// Execute one tool by name → the string the model sees as the tool_result. Unknown tool,
// or a host-only tool called for a guest, returns a safe note (never throws, never leaks).
function runTool(name, ctx) {
  const t = TOOLS[name];
  if (!t) return NONE;
  if (t.hostOnly && !(ctx && ctx.kind === 'host')) return NONE;
  const out = t.run(ctx || {});
  return (out && String(out).trim()) || NONE;
}

module.exports = { TOOLS, toolSpecsFor, runTool, NONE };
