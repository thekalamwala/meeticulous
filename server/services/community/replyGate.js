'use strict';
// replyGate.js — decides whether Tithi should first-respond to a community post,
// and how, cheapest-first. Free heuristics shed the feed noise; a tiny budget-gated
// Haiku triage routes the survivors. The expensive grounded answer (botService.askBot)
// then runs ONLY on a confirmed question — that is the whole token story.
//
// Fail-safe: any doubt, missing key, spent budget, or error => { act:false } and Tithi
// stays silent. Silence is always the cheap, safe default here (unlike the widget, where
// the user asked directly and expects a reply).

const anthropicClient = require('../ai/anthropicClient');
const botBudget = require('../../lib/botBudget');

const MIN_LEN = 12;     // below this it is a reaction, not a question
const MAX_BODY = 1500;  // truncate before the classifier (token bound)

// ── Tier 0 — free. Does the post even read like a question or a problem? Announcements,
// showcases and chit-chat fall out here for ZERO tokens. Deliberately loose — the
// classifier is the real judge — so we only drop the obvious non-questions.
const QUESTION_RE = /\?|\b(how|what|why|can|could|would|does|do|is|are|where|when|which|should|able to|any way|possible|anyone know)\b/i;
const PROBLEM_RE = /\b(not working|doesn'?t|does not|isn'?t|is not|can'?t|cannot|won'?t|unable|issue|errors?|stuck|help|fails?|failing|failed|broken|bug|problem|wrong|missing)\b/i;

function looksLikeQuestion(text) {
  const s = String(text || '').trim();
  if (s.length < MIN_LEN) return false;
  return QUESTION_RE.test(s) || PROBLEM_RE.test(s);
}

// ── Tier 1 — tiny Haiku triage. Returns { answerable, route } or null (→ caller stays
// silent). Budget-gated; a handful of output tokens via a forced tool.
const CLASSIFY_SYSTEM = [
  'You triage one community post for Meeticulous, a booking platform where creators ("hosts") sell services and guests book them.',
  'Decide if the post is a QUESTION or PROBLEM that the company (support or sales) should answer, and classify it.',
  'answerable = true ONLY for a genuine question or problem: how-to, troubleshooting, onboarding, pricing, whether a feature exists, or comparing Meeticulous to another tool.',
  'route: "support" = how-to / troubleshooting / onboarding / pricing; "comparison" = evaluating Meeticulous vs another product, or "can you do X like <tool>"; "feature" = asking whether a capability exists; "not_for_us" = showing off work, opinions, chit-chat, member-to-member talk, off-topic, or anything that is not a question for the company.',
  'When in doubt, answerable = false and route = "not_for_us". Reply only by calling the tool.',
].join(' ');

const CLASSIFY_TOOL = {
  name: 'triage',
  description: 'Triage the community post.',
  input_schema: {
    type: 'object',
    properties: {
      answerable: { type: 'boolean', description: 'true only for a genuine question/problem for the company to answer.' },
      route: { type: 'string', enum: ['support', 'comparison', 'feature', 'not_for_us'] },
    },
    required: ['answerable', 'route'],
  },
};

const ROUTES = ['support', 'comparison', 'feature', 'not_for_us'];

async function classify(body) {
  if (!anthropicClient.isConfigured()) return null;
  const budget = await botBudget.tryConsume();
  if (!budget.allowed) return null;
  try {
    const client = anthropicClient.getClient();
    if (!client) return null;
    const resp = await client.messages.create({
      model: anthropicClient.MODELS.generate, // Haiku — cheap triage
      max_tokens: 40,
      system: CLASSIFY_SYSTEM,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'tool', name: 'triage' },
      messages: [{ role: 'user', content: String(body || '').slice(0, MAX_BODY) }],
    });
    const out = (resp.content || []).find((b) => b.type === 'tool_use' && b.name === 'triage')?.input;
    if (!out || typeof out.answerable !== 'boolean') return null;
    return { answerable: out.answerable, route: ROUTES.includes(out.route) ? out.route : 'not_for_us' };
  } catch (_) {
    return null;
  }
}

// decide({ body }) → { act, route, reason }. act=false means Tithi stays silent.
async function decide({ body } = {}) {
  if (!looksLikeQuestion(body)) return { act: false, route: 'not_for_us', reason: 'not_a_question' };
  const cls = await classify(body);
  if (!cls) return { act: false, route: 'not_for_us', reason: 'classify_unavailable' };
  if (!cls.answerable || cls.route === 'not_for_us') return { act: false, route: 'not_for_us', reason: 'not_for_us' };
  return { act: true, route: cls.route, reason: cls.route };
}

// ── Pitch: append ONE CTA, comparison intent only. The grounded answer is never changed —
// the CTA is additive and internal-only (sanitizeAnswer strips external links upstream).
// No double-link if the answer already points pitch-ward.
const PRICING_CTA = '[See plans & pricing](/pricing)';
function appendCta(answer, route) {
  const base = String(answer || '').trim();
  if (route !== 'comparison' || !base) return base;
  if (/\]\(\/pricing|\]\(\/login-as-vendor/.test(base)) return base;
  return `${base}\n\n${PRICING_CTA}`;
}

module.exports = { looksLikeQuestion, classify, decide, appendCta };
