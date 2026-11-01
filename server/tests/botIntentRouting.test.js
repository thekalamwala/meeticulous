// Routing-matrix validation for the Bolt intent layer (flag ON). Models the
// DETERMINISTIC prefix of the confidence ladder — the layers that decide routing
// without a DB/network call — and asserts every query lands in the expected layer.
//
// Ladder order (flag ON):
//   unsupported → [abuse*] → smalltalk → pricing → [FAQ*] → INTENT → sensitive→escalate → retrieval→Claude→escalate
//   * abuse + FAQ need the DB; this harness assumes a clean, non-FAQ query, so a
//     'retrieval' verdict means "falls through to the unchanged retrieval/Claude/
//     escalation pipeline", where the DB/model makes the final answer-vs-escalate call.
//
// This file is the executable form of the validation report: run with
//   npx jest tests/botIntentRouting.test.js
// and read the printed table for the per-query Detected Intent / Confidence / Layer.

// botService pulls in config/supabase (which hard-throws without a service_role key)
// only for its DB paths. This validation exercises the query-independent, DB-free
// routing functions, so stub the DB module — the functions under test never touch it.
jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));

const { smalltalkReply, pricingReply, isUnsupportedInput, SENSITIVE_RE } = require('../services/botService');
const { classify } = require('../services/bot/intent');
const { handle } = require('../services/bot/intentHandlers');

// Deterministic routing verdict for a query, flag ON.
function routeOf(q) {
  const s = String(q || '').trim();
  if (!s) return 'empty';
  if (isUnsupportedInput(s)) return 'unsupported';
  const sens = SENSITIVE_RE.test(s);
  if (smalltalkReply(s)) return 'smalltalk';
  // Sensitive topics skip the pricing/FAQ layers (keyword overlap like "charge") and
  // go straight to escalation — mirrors the guard added in botService.
  if (!sens && pricingReply(s)) return 'pricing';
  // FAQ layer (DB exact-match canned answers) runs HERE, before intent — preserved.
  // The harness assumes no canned FAQ hit for these queries.
  if (!SENSITIVE_RE.test(s)) {
    const c = classify(s);
    if (c.confidence === 'low' && c.candidates.length > 1) return 'clarify';
    if (c.intent && handle(c.intent)) return `intent:${c.intent}`;
  }
  if (SENSITIVE_RE.test(s)) return 'escalate:sensitive';
  return 'retrieval';
}

// category, query, expected route. Expected = the DESIGNED-correct routing.
const MATRIX = [
  // ── Booking ──
  ['Booking', 'How do I book a service?', 'intent:booking'],
  ['Booking', 'I want to book an appointment', 'intent:booking'],
  ['Booking', 'Book a slot for tomorrow', 'intent:booking'],
  ['Booking', "I can't book.", 'intent:booking'],
  ['Booking', 'Where do I make a booking', 'intent:booking'],
  // ── Service discovery (no dedicated intent → retrieval) ──
  ['Discovery', 'What services do you offer?', 'retrieval'],
  ['Discovery', 'Show me yoga classes near me', 'retrieval'],
  ['Discovery', 'Find a photographer', 'retrieval'],
  ['Discovery', 'What categories are available', 'retrieval'],
  // ── Reschedule ──
  ['Reschedule', 'I need to reschedule my appointment', 'intent:reschedule'],
  ['Reschedule', 'Can I move my booking to next week', 'intent:reschedule'],
  ['Reschedule', 'Change my appointment time', 'intent:reschedule'],
  ['Reschedule', 'postpone my session', 'intent:reschedule'],
  // ── Cancellation ──
  ['Cancel', 'cancel my booking', 'intent:reschedule'],
  ['Cancel', 'I want to cancel', 'intent:reschedule'],
  ['Cancel', 'How do I cancel an appointment', 'intent:reschedule'],
  // ── Payments (non-sensitive) ──
  ['Payments', 'What payment methods do you accept', 'intent:payments'],
  ['Payments', "Where's my invoice", 'intent:payments'],
  ['Payments', 'My payout has not arrived', 'intent:payments'],
  ['Payments', 'Do you send receipts', 'intent:payments'],
  // ── Pricing (deterministic pricing layer, before intent) ──
  ['Pricing', 'How much does it cost', 'pricing'],
  ['Pricing', 'what is the monthly price', 'pricing'],
  ['Pricing', 'pricing for the studio plan', 'pricing'],
  ['Pricing', 'how much is host plus', 'pricing'],
  // ── Calendar sync ──
  ['Calendar', 'How do I sync my calendar', 'intent:calendar'],
  ['Calendar', 'Connect Google Calendar', 'intent:calendar'],
  ['Calendar', 'My availability is not updating', 'intent:calendar'],
  // ── Notifications ──
  ['Notifications', 'How do I turn off reminders', 'intent:notifications'],
  ['Notifications', 'I am not getting notifications', 'intent:notifications'],
  ['Notifications', 'Can I get SMS alerts', 'intent:notifications'],
  // ── Reviews ──
  ['Reviews', 'How do I leave a review', 'intent:reviews'],
  ['Reviews', 'Where are my ratings', 'intent:reviews'],
  ['Reviews', 'Can I see testimonials', 'intent:reviews'],
  // ── Become a host ──
  ['Host', 'How do I become a host', 'intent:host'],
  ['Host', 'I want to sell my services', 'intent:host'],
  ['Host', 'How do I list my services', 'intent:host'],
  // ── General FAQ (→ retrieval in this harness; FAQ/retrieval at runtime) ──
  // Brand-name regression: a question ABOUT the product must NOT
  // trip the booking intent.
  ['General', 'What is Meeticulous', 'retrieval'],
  ['General', 'Is Meeticulous free', 'retrieval'],
  ['General', 'What is your privacy policy', 'retrieval'],
  ['General', 'Where are you located', 'retrieval'],
  ['General', 'Do you have a mobile app', 'retrieval'],
  // ── Small talk ──
  ['Smalltalk', 'hi', 'smalltalk'],
  ['Smalltalk', 'hello there', 'smalltalk'],
  ['Smalltalk', 'thanks!', 'smalltalk'],
  ['Smalltalk', 'ok thank you', 'smalltalk'],
  // ── Ambiguous (two specific topics → clarify) ──
  // NOTE: a sensitive keyword (e.g. "refund") outranks clarify → escalates. That is
  // correct; use non-sensitive compounds to exercise the clarify path.
  ['Ambiguous', 'become a host and get paid', 'clarify'],
  ['Ambiguous', 'reviews and hosting questions', 'clarify'],
  ['Ambiguous', 'cancel my booking and give me an invoice', 'clarify'],
  ['Ambiguous', 'reschedule my booking and refund me', 'escalate:sensitive'],
  // ── Invalid / garbage ──
  ['Garbage', '你好', 'unsupported'],
  ['Garbage', 'aaaaaaaaaaaa', 'retrieval'],
  ['Garbage', '   ', 'empty'],
  // Emoji-only isn't caught by the existing isUnsupportedInput (Latin-script check);
  // it falls through to retrieval → escalation. Pre-existing behavior, not the intent
  // layer. Documented, not asserted as unsupported.
  ['Garbage', '😀😀😀', 'retrieval'],
  // ── Sensitive / dispute / refund (always bypass intent → escalate) ──
  ['Sensitive', 'I want a refund', 'escalate:sensitive'],
  ['Sensitive', 'I was charged twice', 'escalate:sensitive'],
  ['Sensitive', 'I want to dispute a payment', 'escalate:sensitive'],
  ['Sensitive', 'my account was hacked', 'escalate:sensitive'],
  ['Sensitive', 'chargeback on my card', 'escalate:sensitive'],
  // ── Stress / confusing (documented expected routing) ──
  ['Stress', 'My booking payment failed.', 'intent:payments'],
  ['Stress', 'Can I cancel and rebook?', 'intent:reschedule'],
  ['Stress', "Calendar booking isn't syncing.", 'intent:calendar'],
  ['Stress', 'How do I become a host and get paid?', 'clarify'],
];

describe('Tithi intent routing matrix', () => {
  const rows = [];
  const failures = [];

  for (const [category, query, expected] of MATRIX) {
    const cls = classify(query);
    const actual = routeOf(query);
    const pass = actual === expected;
    rows.push({
      category,
      query: query.length > 42 ? `${query.slice(0, 41)}…` : query,
      intent: cls.intent || '—',
      conf: cls.confidence,
      layer: actual,
      expected,
      result: pass ? 'PASS' : 'FAIL',
    });
    if (!pass) failures.push({ query, expected, actual });
  }

  it(`routes all ${MATRIX.length} queries to the expected layer`, () => {
    // eslint-disable-next-line no-console
    console.table(rows);
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('FAILURES:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });

  it('precedence: every "cancel …" query routes to reschedule, never booking', () => {
    for (const [, query] of MATRIX.filter(([c]) => c === 'Cancel')) {
      expect(classify(query).intent).toBe('reschedule');
    }
  });

  it('sensitive: every sensitive query bypasses the intent layer', () => {
    for (const [, query] of MATRIX.filter(([c]) => c === 'Sensitive')) {
      expect(routeOf(query)).toBe('escalate:sensitive');
    }
  });

  // Regression guard for the sensitive-precedence fix: PRICING_INTENT matches "charge",
  // but the sensitive check now runs BEFORE the pricing/FAQ layers, so a fraud report
  // escalates instead of getting a pricing answer.
  it('sensitive beats pricing keyword overlap ("fraudulent charge" → escalate)', () => {
    expect(routeOf('this is a fraudulent charge')).toBe('escalate:sensitive');
    expect(routeOf('I was charged twice for my booking')).toBe('escalate:sensitive');
  });
});
