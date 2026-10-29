'use strict';
// pills.js — builds up to 3 short "pills" (quick-reply buttons) attached to a Bolt
// bot answer. Hybrid: deterministic rules run first (free, zero-latency); the Haiku
// LLM fallback fires ONLY when rules produce nothing, and is constrained to the
// PILL_VOCAB whitelist via a forced tool. Never throws — any failure yields [].

const anthropicClient = require('../ai/anthropicClient');
const botBudget = require('../../lib/botBudget');

// The ONLY pills the bot may ever emit. LLM output is intersected with these keys
// (minus 'read', which is built dynamically from the cited source), so the model
// can never invent a label or a route.
const PILL_VOCAB = {
  book:     { label: 'Book a service',          action: { type: 'route', value: '/services' } },
  pricing:  { label: 'See pricing',             action: { type: 'send',  value: 'What does it cost?' } },
  how:      { label: 'How booking works',       action: { type: 'send',  value: 'How do I book a service?' } },
  payments: { label: 'Payments & refunds',      action: { type: 'send',  value: 'How do payments and refunds work?' } },
  host:     { label: 'Become a host',           action: { type: 'send',  value: 'How do I become a host?' } },
  ticket:   { label: 'Create a support ticket', action: { type: 'route', value: '/support' } },
};

// Sources where the only sensible next action is a human handoff.
const HANDOFF_SOURCES = new Set(['roast', 'threat', 'abuse_lock', 'ip_block', 'over_budget']);

// Deterministic pill selection. Returns an array of PILL_VOCAB keys (or []).
function rulePills({ question, source, escalate, cited_sources } = {}) {
  if (source === 'roast' || source === 'threat' || source === 'abuse_lock' || source === 'ip_block') {
    return ['ticket'];
  }
  if (escalate || source === 'over_budget') return ['ticket'];

  const q = String(question || '').toLowerCase();
  if (/\b(refund|cancel|charge|charged|payment|paid)\b/.test(q)) return ['payments', 'ticket'];
  if (/\b(book|booking|schedule|appointment)\b/.test(q)) return ['book', 'how'];
  if (/\b(price|pricing|cost|fee|fees)\b/.test(q)) return ['pricing', 'book'];
  if (/\b(host|vendor|sell|selling|creator)\b/.test(q)) return ['host'];
  return [];
}

// Haiku fallback — only called when rulePills returned []. Forces a tool that
// returns { keys }. Returns [] when the key is missing, the budget denies, or on
// any error. Keys are intersected with the whitelist so garbage can't leak through.
async function llmPills({ question, answer } = {}) {
  try {
    const client = anthropicClient.getClient();
    if (!client) return [];
    const budget = await botBudget.tryConsume();
    if (!budget || !budget.allowed) return [];

    const allowed = Object.keys(PILL_VOCAB).filter((k) => k !== 'read'); // 'read' isn't in vocab, but be explicit
    const TOOL = {
      name: 'emit_pills',
      description: 'Return up to 3 pill keys for the most useful next actions.',
      input_schema: {
        type: 'object',
        properties: {
          keys: { type: 'array', items: { type: 'string', enum: allowed }, description: 'Up to 3 pill keys.' },
        },
        required: ['keys'],
      },
    };

    const resp = await client.messages.create({
      model: anthropicClient.MODELS.generate,
      max_tokens: 128,
      system: 'Pick up to 3 pill keys that are the most useful next actions for this Book A Sloth support answer. Only choose from: book, pricing, how, payments, host, ticket.',
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'emit_pills' },
      messages: [
        { role: 'user', content: `Question: ${String(question || '')}\n\nAnswer: ${String(answer || '')}` },
      ],
    });

    const input = (resp.content || []).find((b) => b.type === 'tool_use' && b.name === 'emit_pills')?.input;
    const keys = Array.isArray(input?.keys) ? input.keys : [];
    return keys.filter((k) => Object.prototype.hasOwnProperty.call(PILL_VOCAB, k)).slice(0, 3);
  } catch (e) {
    return [];
  }
}

// Humanize a source_file path into a short label: strip dir + .md, dashes → spaces,
// title-case-ish, cap ~40 chars.
function humanizeSource(sourceFile) {
  const base = String(sourceFile || '').split('/').pop().replace(/\.md$/i, '').replace(/-/g, ' ').trim();
  if (!base) return '';
  const titled = base.replace(/\b\w/g, (c) => c.toUpperCase());
  return titled.length > 40 ? `${titled.slice(0, 39).trimEnd()}…` : titled;
}

// Build a "read the cited page" pill from the top cited source. Mirrors BotWidget's
// mapping: docs/help/<slug>.md → /help/docs/<slug>. Returns null when there's none.
function dynamicReadPill(cited_sources) {
  const top = Array.isArray(cited_sources) ? cited_sources[0] : null;
  const sourceFile = top && top.source_file;
  if (!sourceFile) return null;
  const label = humanizeSource(sourceFile);
  if (!label) return null;
  const slug = String(sourceFile).split('/').pop().replace(/\.md$/i, '').trim();
  const value = slug ? `/help/docs/${slug}` : '/help/docs';
  return { label: `Read: ${label}`, action: { type: 'route', value } };
}

// Dedupe by label, drop pills with a falsy action value, cap to 3.
function validate(pills) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(pills) ? pills : []) {
    if (!p || !p.action || !p.action.value || !p.label) continue;
    if (seen.has(p.label)) continue;
    seen.add(p.label);
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

// Main entry. Never throws.
async function buildPills({ question, source, escalate, cited_sources, answer } = {}) {
  try {
    if (process.env.BOT_PILLS_ENABLED !== 'true') return [];

    let keys = rulePills({ question, source, escalate, cited_sources });
    const isHandoff = HANDOFF_SOURCES.has(source) || escalate;
    if (!keys.length && !isHandoff) {
      keys = await llmPills({ question, answer });
    }

    const pills = keys.map((k) => PILL_VOCAB[k]).filter(Boolean);

    // On a normal grounded answer, offer the cited page if there's room.
    if ((source === 'model' || source === 'cache') && pills.length < 3) {
      const read = dynamicReadPill(cited_sources);
      if (read) pills.push(read);
    }

    return validate(pills);
  } catch (e) {
    return [];
  }
}

// test-only
function _reset() {
  if (typeof botBudget._reset === 'function') botBudget._reset();
}

module.exports = { buildPills, rulePills, llmPills, validate, dynamicReadPill, PILL_VOCAB, _reset };
