'use strict';

/**
 * contextAnswer — deterministic, data-aware answers for the AUTHENTICATED support
 * chat. Given the caller's own live record (from supportContextService), it answers
 * the handful of high-value "status lookup" questions from real state instead of
 * escalating them to a human.
 *
 * SAFETY:
 *  - Only ever runs when botAutoReply passes a context resolved from a verified
 *    support thread (user_id / guest_phone). The public anonymous widget never
 *    reaches this — no identity, no personal data.
 *  - MONEY: reports STATUS only, never amounts, and never performs an action. A real
 *    dispute (double-charge / fraud / unauthorized / chargeback) returns null so the
 *    normal sensitive-escalation path still sends it to a human.
 *  - Returns null on anything it isn't confident about → the bot falls through to its
 *    normal FAQ / retrieval / escalate ladder.
 */

// Genuine disputes must still reach a human — never answer these from context.
const DISPUTE_RE = /\b(double ?charged?|charged (?:me )?(?:twice|again|wrong|extra)|fraud|hacked|stolen|unauthor|charge ?back|scam)\b/i;

const REFUND_RE  = /\brefund/i;
const LISTING_RE = /\b(listing|go ?live|not live|isn.?t live|why.*live|activate|visible|published|show(ing)? up)\b/i;
const PAYOUT_RE  = /\b(payout|settle(ment)?|get paid|getting paid|my earnings|paid out|when.*paid)\b/i;
const PLAN_RE    = /\b(plan|subscription|upgrade|expired?|renew)\b/i;
const BOOKING_RE = /\b(booking|appointment|my slot|reservation|session)\b/i;
const STATUS_RE  = /\b(where|status|track|when|update|confirm(ed)?|happening|went through|go through|is my|are my)\b/i;

const L = (label, href) => `[${label}](${href})`;

// Host: "why isn't my listing live?" — the single most valuable deflection.
function listingAnswer(ctx) {
  const p = ctx.profile || {};
  const h = ctx.host || {};
  const planActive = p.plan && (!p.planExpiresAt || Date.parse(p.planExpiresAt) > Date.now());
  if (!planActive) {
    return `Your listing isn't live yet because your **subscription isn't active**${p.planExpiresAt ? ' (it looks expired)' : ''}. `
      + `Activate a plan and your services go live right away → ${L('Choose a plan', '/dashboard/upgrade')}.`;
  }
  if (h.kyc && h.kyc.status !== 'approved') {
    const s = h.kyc.status || 'pending';
    return `Your subscription is active, but your listing needs **verification** — your KYC is currently **${s}**. `
      + `Finish or check it here → ${L('Verification', '/dashboard/kyc')}.`;
  }
  if (h.listingActive === false) {
    return `Your subscription and verification are set ✅ — but you don't have an **active service** yet, so there's nothing to show. `
      + `Add or switch one on here → ${L('Your services', '/dashboard/services')}.`;
  }
  if (h.listingActive === true) {
    return `Good news — your listing **is live** ✅. If it isn't showing where you expect, tell me the service name and I'll flag it to the team.`;
  }
  return null; // not enough signal — let the normal ladder handle it
}

function payoutAnswer(ctx) {
  const h = ctx.host || {};
  if (h.payoutLinked === false) {
    return `Your **payout account isn't linked yet**, so earnings can't be sent out. Add your bank details in ${L('Verification', '/dashboard/kyc')} to start receiving payouts.`;
  }
  const act = h.kyc?.activation;
  if (h.payoutLinked === true && act && act !== 'activated') {
    return `Your payout account is linked and currently **${act}** — payouts begin once it's fully activated. You can track everything under ${L('Payouts', '/dashboard/payments/payouts')}.`;
  }
  if (h.payoutLinked === true) {
    return `Your payout account is linked and active ✅. Completed bookings settle to your bank on the payout schedule — see the detail under ${L('Payouts', '/dashboard/payments/payouts')}.`;
  }
  return null;
}

function planAnswer(ctx) {
  const p = ctx.profile || {};
  if (!p.plan) {
    return `You're on the free tier right now. To unlock more, see ${L('plans & upgrades', '/dashboard/upgrade')}.`;
  }
  const expired = p.planExpiresAt && Date.parse(p.planExpiresAt) < Date.now();
  if (expired) {
    return `Your **${p.plan}** plan looks **expired** — that's usually why things go quiet. Renew here → ${L('Manage plan', '/dashboard/upgrade')}.`;
  }
  return `You're on the **${p.plan}** plan${p.planExpiresAt ? `, active until **${new Date(p.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}**` : ''}. Manage it any time under ${L('plans', '/dashboard/upgrade')}.`;
}

function refundAnswer(ctx) {
  const bookings = ctx.bookings || [];
  // A refund shows as payment_status='refunded' (full) OR a positive refunded_amount
  // (a partial/tiered refund keeps payment_status='paid'). Check both so a partially
  // refunded guest isn't told nothing was refunded (F14).
  const refunded = bookings.find((b) => b.payment_status === 'refunded' || Number(b.refunded_amount) > 0);
  if (refunded) {
    return `I can see booking **${refunded.ref}** was **refunded**. Bank refunds usually land in **5–7 working days** from when they're issued. If it's been longer, tell me and I'll get the team to trace it.`;
  }
  const cancelledPaid = bookings.find((b) => b.status === 'cancelled' && b.payment_status === 'paid' && !(Number(b.refunded_amount) > 0));
  if (cancelledPaid) {
    return `Booking **${cancelledPaid.ref}** is cancelled but still shows as **paid** — a refund may still be processing. I'll flag it so the team can confirm the exact status for you.`;
  }
  return null; // nothing refund-shaped on the account → let it escalate/ answer normally
}

function bookingAnswer(ctx) {
  const bookings = ctx.bookings || [];
  if (!bookings.length) {
    return ctx.kind === 'host'
      ? `I don't see any bookings on your account yet. Once guests book you, they'll show under ${L('Bookings', '/dashboard/bookings')}.`
      : `I don't see any bookings under your number yet. When you book, they'll appear under ${L('My bookings', '/user/my-bookings')}.`;
  }
  const b = bookings[0];
  const when = b.when ? new Date(b.when).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;
  const link = ctx.kind === 'host' ? L('Bookings', '/dashboard/bookings') : L('My bookings', '/user/my-bookings');
  return `Your most recent booking **${b.ref}**${b.service ? ` (${b.service})` : ''} is **${b.status || 'pending'}**`
    + `${b.payment_status ? ` and **${b.payment_status}**` : ''}${when ? `, scheduled for **${when}**` : ''}. See all of them under ${link}.`;
}

/**
 * @param {string} q       the user's message
 * @param {object} ctx     supportContextService.getSupportContext result
 * @returns {{answer:string, source:'context', escalate:false}|null}
 */
function contextAnswer(q, ctx) {
  if (!q || !ctx) return null;
  if (DISPUTE_RE.test(q)) return null; // real disputes → escalate as before

  const isHost = ctx.kind === 'host';
  let answer = null;

  if (isHost && LISTING_RE.test(q)) answer = listingAnswer(ctx);
  else if (isHost && PAYOUT_RE.test(q)) answer = payoutAnswer(ctx);
  else if (isHost && PLAN_RE.test(q)) answer = planAnswer(ctx);
  else if (REFUND_RE.test(q)) answer = refundAnswer(ctx);
  else if (BOOKING_RE.test(q) && STATUS_RE.test(q)) answer = bookingAnswer(ctx);

  return answer ? { answer, source: 'context', escalate: false } : null;
}

// Compact, PII-light context line injected into the model prompt for general
// questions (statuses + short refs only — no name/phone/email). Never cached.
function contextNote(ctx) {
  if (!ctx) return '';
  const p = ctx.profile || {};
  const bits = [`The user is a ${ctx.kind}.`];
  if (p.plan) bits.push(`Plan: ${p.plan}${p.planExpiresAt ? ` (expires ${String(p.planExpiresAt).slice(0, 10)})` : ''}.`);
  if (ctx.host) {
    if (ctx.host.kyc) bits.push(`KYC: ${ctx.host.kyc.status}.`);
    if (ctx.host.listingActive != null) bits.push(`Listing active: ${ctx.host.listingActive}.`);
    if (ctx.host.payoutLinked != null) bits.push(`Payout linked: ${ctx.host.payoutLinked}.`);
  }
  const b = (ctx.bookings || [])[0];
  if (b) bits.push(`Latest booking ${b.ref}: ${b.status}/${b.payment_status}.`);
  return `[Account context — use only to answer accurately, never repeat verbatim: ${bits.join(' ')}]`;
}

module.exports = { contextAnswer, contextNote, DISPUTE_RE };
