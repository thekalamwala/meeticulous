'use strict';
// Field contract for AI listing autofill: the Anthropic tool schema + a pure
// server-side sanitizer that enforces limits and strips fabricated facts.

const LISTING_TOOL = {
  name: 'emit_listing',
  description: 'Return the fully-written service listing fields.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Refined title, <=60 chars, primary keyword near front.' },
      short_description: { type: 'string', description: 'Answer-first hook, <=160 chars. Doubles as meta description.' },
      long_description: { type: 'string', description: 'HTML body, definitional opening ("<Service> is a ..."), ~300-600 chars of text.' },
      included_items: { type: 'array', items: { type: 'string' }, description: '4-6 concrete bullets.' },
      excluded_items: { type: 'array', items: { type: 'string' }, description: '4-6 expectation-setting bullets.' },
      faqs: {
        type: 'array',
        items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
        description: '4-5 FAQs, question phrased as users search, answer-first ~20 words.',
      },
      important_note: { type: 'string', description: 'Caveats/prerequisites, <=200 chars.' },
      category: { type: 'string', description: 'A slug from the allowed list only; omit if none fit.' },
      duration_minutes: { type: 'integer', description: 'Suggested session length in minutes (a common bookable length, e.g. 15/30/45/60/90). Omit if genuinely unclear.' },
    },
    required: ['title', 'short_description', 'long_description', 'included_items', 'excluded_items', 'faqs'],
  },
};

// Fabricated-fact signals the model must never assert. If present, blank the field.
const FABRICATION = /(₹|\bRs\.?\b|\$\d|\b\d+\s*%|money[- ]?back|guarantee|certified|licen[cs]ed|\bFDA\b|\bISO\b|\b\d(?:\.\d)?\s*stars?\b|\b\d{10}\b|@[\w.-]+\.\w+)/i;

const clamp = (s, n) => String(s || '').trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);

function sanitizeListing(raw, options) {
  // ponytail: null-safe options destructuring
  const { allowedCategorySlugs = [] } = (options && typeof options === 'object') ? options : {};
  const r = raw && typeof raw === 'object' ? raw : {};
  const dropped = [];
  const guard = (key, val) => {
    if (val && FABRICATION.test(String(val))) { dropped.push(key); return ''; }
    return val;
  };

  const fields = {};
  fields.title = clamp(guard('title', r.title), 60);
  fields.short_description = clamp(guard('short_description', r.short_description), 160);
  fields.long_description = guard('long_description', String(r.long_description || '').trim());
  fields.important_note = clamp(guard('important_note', r.important_note), 200);

  // Guard each included item and filter blanks
  fields.included_items = arr(r.included_items)
    .map((x, i) => {
      const trimmed = String(x).trim();
      return guard(`included_items[${i}]`, trimmed);
    })
    .filter(Boolean)
    .slice(0, 6);

  // Guard each excluded item and filter blanks
  fields.excluded_items = arr(r.excluded_items)
    .map((x, i) => {
      const trimmed = String(x).trim();
      return guard(`excluded_items[${i}]`, trimmed);
    })
    .filter(Boolean)
    .slice(0, 6);

  // Guard FAQ questions and answers
  fields.faqs = arr(r.faqs)
    .filter((f) => f && (f.question || f.answer))
    .map((f, i) => ({
      question: clamp(guard(`faq[${i}]_question`, f.question), 200),
      answer: clamp(guard(`faq[${i}]_answer`, f.answer), 400)
    }))
    .filter((f) => f.question && f.answer)
    .slice(0, 5);

  if (r.category && allowedCategorySlugs.includes(r.category)) fields.category = r.category;

  // Duration: integer minutes, clamped to a sane bookable range. Out-of-range or
  // non-numeric → omit (the form keeps its default). ponytail: no fabrication
  // guard needed — a number can't smuggle a price/claim.
  const dur = Math.round(Number(r.duration_minutes));
  if (Number.isFinite(dur) && dur >= 5 && dur <= 480) fields.duration_minutes = dur;

  return { fields, dropped };
}

module.exports = { LISTING_TOOL, sanitizeListing };
