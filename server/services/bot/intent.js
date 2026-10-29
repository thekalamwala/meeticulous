'use strict';
// intent.js — lightweight, zero-cost intent classification that runs before
// retrieval in the Bolt confidence ladder. Pure regex over the normalized query:
// no LLM, no network, no latency. It only decides WHICH known-topic handler (if
// any) should answer, or whether the query is ambiguous enough to ask one
// clarifying question. Everything it can't place returns { intent: null } and the
// ladder continues to retrieval → Claude → escalation unchanged.
//
// Precedence: the six "specific" topics beat the general "booking" topic, so
// "cancel my booking" is a reschedule question, not a booking one. Ambiguity
// (→ clarify) is only declared when TWO specific topics match — genuinely
// different intents — never for specific + booking overlap.

const normalize = (s) =>
  String(s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

// The brand name literally contains "book", so "what is Book A Sloth" would trip the
// booking intent. Strip the brand phrase before matching so a question ABOUT the
// product falls through to retrieval, while a real "book a service" request still hits.
const BRAND_RE = /\bbook ?a ?sloth\b/g;

// Specific topics, most-specific first. Word-boundary anchored so mid-word hits
// don't leak (e.g. booking's \bschedul\w* can't match "reschedule").
const SPECIFIC = [
  { name: 'reschedule',    re: /\b(reschedul\w*|cancel\w*|postpone\w*|rebook\w*|change my (booking|appointment)|move my (booking|appointment))\b/ },
  { name: 'payments',      re: /\b(payment\w*|pay|paid|refund\w*|charge\w*|invoice\w*|receipt\w*|gst|billing|transaction\w*|payout\w*)\b/ },
  { name: 'calendar',      re: /\b(calendar|google cal\w*|sync\w*|ical|availabilit\w*|time ?slot\w*|time ?zone\w*)\b/ },
  { name: 'notifications', re: /\b(notification\w*|notify|reminder\w*|alert\w*|sms)\b/ },
  { name: 'reviews',       re: /\b(review\w*|rating\w*|testimonial\w*|star rating\w*)\b/ },
  { name: 'host',          re: /\b(host\w*|vendor\w*|become a (host|seller|creator)|sell\w*|list my service\w*|onboard\w*)\b/ },
];
const BOOKING_RE = /\b(book\w*|appointment\w*|schedul\w*|slot\w*)\b/;

// classify(query) → { intent, candidates, confidence }
//   'high' — exactly one specific topic (or booking) matched → use its handler.
//   'low'  — two+ specific topics matched → ambiguous, ask a clarifying question.
//   'none' — nothing matched → let the retrieval/Claude path handle it.
function classify(query) {
  const nq = normalize(query).replace(BRAND_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!nq) return { intent: null, candidates: [], confidence: 'none' };

  const specific = SPECIFIC.filter((r) => r.re.test(nq)).map((r) => r.name);

  if (specific.length >= 2) return { intent: null, candidates: specific, confidence: 'low' };
  if (specific.length === 1) return { intent: specific[0], candidates: specific, confidence: 'high' };
  if (BOOKING_RE.test(nq)) return { intent: 'booking', candidates: ['booking'], confidence: 'high' };
  return { intent: null, candidates: [], confidence: 'none' };
}

module.exports = { classify, SPECIFIC, BOOKING_RE, normalize };
