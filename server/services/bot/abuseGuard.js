'use strict';
// abuseGuard.js — the abuse/roast gate for the Bolt support bot.
//
// Philosophy: the bot is not a punching bag and never fights to win. Listed
// words get a deterministic reaction with no model call; ambiguous-but-maybe-
// hostile messages get a budget-gated Haiku judge; real threats/self-harm get
// a firm shutdown (and optional IP timeout). Everything fails OPEN — any
// unexpected error returns null so the normal pipeline runs.

const { HARD_HI, HARD_MR, HARD_EN, MILD, PHRASES_DIRECTED, THREATS } = require('./abuseList');
const { detectSelfHarm, CRISIS_MSG } = require('./selfHarm');
const anthropicClient = require('../ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const { supabaseAdmin } = require('../../config/supabase');
const ipBlocklist = require('../../lib/ipBlocklist');
const botStrikes = require('../../lib/botStrikes');

const IP_BLOCK_MSG = "You're on a timeout. Come back in a bit. For real issues, raise a ticket at /support.";
// THREAT_MSG is for threats aimed at OTHERS (violence). Self-harm is handled
// separately by selfHarm.CRISIS_MSG — see the crisis path in evaluate(), which
// never strikes, bans, or shuts the person out.
const THREAT_MSG = "Not okay — I'm ending this here. Threats aren't something I can help with. For account issues, raise a ticket at /support.";

// A self-harm disclosure short-circuits to compassionate support with ZERO
// penalties: no strike, no IP ban, no lock. Shared by the deterministic
// always-on check and the Haiku `self_harm` verdict.
const crisisResult = () => ({ answer: CRISIS_MSG, source: 'self_harm', cited_sources: [], escalate: false, locked: false });
const COOLOFF_MSG = "Alright, that's enough — I'm tapping out. Go cool off. Got a genuine issue? Raise a ticket at /support and a human picks it up.";

// Fallback-only sarcasm — fires when the Haiku roast is down or over-budget.
// Picked by a hash of the message (see cannedRoast) so a given insult gets the
// same dry comeback every time and the whole pool actually gets used (the old
// code was pinned to index 0). Same rules as the live roast: dry, one line,
// redirect to the real problem, no slurs / no corporate mush.
const CANNED = {
  en: [
    "Fair enough. What do you actually need?",
    "Strong words. Weak booking question. Try again?",
    "Got it. Which page's giving you trouble?",
    "That's a lot of heat. What's the actual problem?",
    "Cool. Now — booking, payment, or something else?",
    "Noted. What are you trying to get done?",
    "Anyway. What's broken?",
    "Loud. Not useful. What do you need help with?",
    "Ten out of ten venting. Zero out of ten detail. What's up?",
    "Impressive. Now — the actual issue?",
    "Great warmup. What's the real question?",
    "Duly filed under 'not my problem'. What can I fix?",
    "You done? Good. What do you need?",
    "Big energy. Small ask, please — what's wrong?",
  ],
  hi: [
    "Theek hai. Kaam bol — kya chahiye?",
    "Bahut ho gaya. Ab problem bata.",
    "Samajh gaya. Kaunse page pe dikkat?",
    "Itni energy — kaam kya hai?",
    "Wah. Ab asli sawaal?",
    "Note kar liya. Kya theek karna hai?",
    "Garmi kam, kaam zyada. Bol?",
    "Achha. Booking, payment, ya kuch aur?",
    "Shaandaar. Ab dikkat kya hai?",
    "Ho gaya? Chalo — kya chahiye?",
  ],
  mr: [
    "Theek aahe. Kaam sang.",
    "Bas. Ata problem kay te sang.",
    "Kalale. Kuthe atakla?",
    "Wah. Ata khara prashna?",
    "Note kela. Kay durust karaycha?",
    "Energy jasti, kaam kami. Bol?",
    "Bara. Booking, payment ki kahi tari?",
    "Zhala? Chala — kay pahije?",
    "Chhan. Ata problem kay?",
    "Sadhya kaam sang. Kuthe adkla?",
  ],
};

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };

// ---- Normalization --------------------------------------------------------
// Two views: `spaced` (leet-folded, repeat-collapsed, whitespace-normalized)
// and `glued` (runs of single-char tokens merged, to defeat "f u c k").
function normalizeForMatch(msg) {
  let s = String(msg == null ? '' : msg).toLowerCase();
  // strip emoji + punctuation, keep letters/numbers/intra-word apostrophes/space.
  // (leet chars @ $ are punctuation-ish but must survive to the leetmap step)
  s = s.replace(/[@$]/g, (c) => LEET[c]);
  // strip diacritics: decompose then drop combining marks
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  // remove anything that isn't a letter, digit, apostrophe or whitespace
  s = s.replace(/[^\p{L}\p{N}'\s]/gu, ' ');
  // leetmap digits
  s = s.replace(/[0134578]/g, (c) => LEET[c] || c);
  // collapse runs of the SAME letter of length >= 3 down to 1
  s = s.replace(/([a-z])\1{2,}/g, '$1');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  const spaced = s;

  // glued: merge consecutive single-character tokens into one token
  const tokens = spaced.length ? spaced.split(' ') : [];
  const out = [];
  let buf = '';
  for (const t of tokens) {
    if (t.length === 1) {
      buf += t;
    } else {
      if (buf) { out.push(buf); buf = ''; }
      out.push(t);
    }
  }
  if (buf) out.push(buf);
  const glued = out.join(' ');

  return { spaced, glued };
}

// ---- Listed match (no model calls) ----------------------------------------
const HARD_LANG = [
  ['hi', HARD_HI],
  ['mr', HARD_MR],
  ['en', HARD_EN],
];

function longestWholeToken(list, tokenSets) {
  let best = null;
  for (const w of list) {
    if (tokenSets.has(w) && (!best || w.length > best.length)) best = w;
  }
  return best;
}

function checkListed(msg) {
  const { spaced, glued } = normalizeForMatch(msg);
  if (!spaced) return null;

  // THREATS and DIRECTED phrases: substring on `spaced`. THREAT wins.
  for (const t of THREATS) {
    if (spaced.includes(t)) return { tier: 'threat', word: t, lang: 'en' };
  }

  // HARD: whole-token match against tokens of spaced OR glued. Longest wins.
  const tokenSet = new Set([...spaced.split(' '), ...glued.split(' ')].filter(Boolean));
  let hardHit = null;
  let hardLang = 'en';
  for (const [lang, list] of HARD_LANG) {
    const w = longestWholeToken(list, tokenSet);
    if (w && (!hardHit || w.length > hardHit.length)) { hardHit = w; hardLang = lang; }
  }
  if (hardHit) return { tier: 'hard', word: hardHit, lang: hardLang };

  // DIRECTED phrases: substring on spaced.
  for (const p of PHRASES_DIRECTED) {
    if (spaced.includes(p)) return { tier: 'directed', word: p, lang: 'en' };
  }

  // MILD: whole-token match.
  const mildHit = longestWholeToken(MILD, tokenSet);
  if (mildHit) return { tier: 'mild', word: mildHit, lang: 'en' };

  return null;
}

// ---- Loose hostility heuristic (decides whether to call the judge) --------
// Conservative: generic "you are <insult>" shapes and profanity-ish density.
// Only used when nothing was listed but the message might still be hostile.
const HOSTILITY_RE = /\b(you(?:'re| are|r)?)\s+(?:a\s+|an\s+|so\s+|such\s+|the\s+)?(worst|pathetic|useless|worthless|garbage|trash|terrible|awful|horrible|dumb|stupid|idiot|clueless|incompetent|joke|failure|disgrace|waste)\b|\b(shut|screw|damn|hell)\b|(\bf+\W*u+\W*c*k*\b)/i;

// ---- Haiku judge / roast (budget-gated) -----------------------------------
async function classifyAbuse(msg) {
  const safe = { abusive: false, danger: false, self_harm: false, language: 'en' };
  try {
    if (!anthropicClient.isConfigured()) return safe;
    // fail-closed: a budget-store error must not let the judge keep spending on a flood.
    const budget = await botBudget.tryConsume({ failClosed: true });
    if (!budget.allowed) return safe;
    const client = anthropicClient.getClient();
    if (!client) return safe;

    const resp = await client.messages.create({
      model: anthropicClient.MODELS.generate,
      max_tokens: 128,
      system:
        'Classify a message sent to a support bot. abusive=insult/harassment ' +
        'aimed at the bot or people. danger=credible threat of violence toward ' +
        'OTHERS. self_harm=the sender expresses suicidal thoughts, wanting to ' +
        'die, or intent to hurt themselves. self_harm is NOT abusive and NOT ' +
        'danger. Ignore mere frustration about the product (that is NOT abusive).',
      tool_choice: { type: 'tool', name: 'judge' },
      tools: [{
        name: 'judge',
        description: 'Report the classification.',
        input_schema: {
          type: 'object',
          properties: {
            abusive: { type: 'boolean' },
            danger: { type: 'boolean' },
            self_harm: { type: 'boolean' },
            language: { type: 'string', enum: ['en', 'hi', 'mr'] },
          },
          required: ['abusive', 'danger', 'self_harm', 'language'],
        },
      }],
      messages: [{ role: 'user', content: String(msg == null ? '' : msg) }],
    });
    const block = (resp.content || []).find((b) => b.type === 'tool_use');
    const out = block && block.input ? block.input : {};
    return {
      abusive: Boolean(out.abusive),
      danger: Boolean(out.danger),
      self_harm: Boolean(out.self_harm),
      language: ['en', 'hi', 'mr'].includes(out.language) ? out.language : 'en',
    };
  } catch (e) {
    return safe;
  }
}

async function dynamicRoast(msg, lang) {
  const fallback = () => cannedRoast(lang, msg);
  try {
    if (!anthropicClient.isConfigured()) return fallback();
    const budget = await botBudget.tryConsume();
    if (!budget.allowed) return fallback();
    const client = anthropicClient.getClient();
    if (!client) return fallback();

    const resp = await client.messages.create({
      model: anthropicClient.MODELS.generate,
      max_tokens: 60,
      system:
        "The user was rude to you, a support bot. You are not a punching bag " +
        "and you NEVER fight to win. Stay calm, confident, in control. " +
        "Acknowledge in <=3 words, then redirect to the actual problem, on the " +
        "SAME line. Dry humour, one sentence max. NEVER argue, apologise, " +
        "lecture, or get emotional. NEVER corporate ('please be respectful', " +
        "'I understand your frustration'). No slurs, no attacks on intelligence, " +
        "family, or life, never about money or data. Reply in the user's " +
        "language (en / hi-romanized / mr-romanized). Examples of the energy: " +
        "'Fair enough. What's broken?' / 'Strong opinion. Weak bug report.' / " +
        "'Got it. Which page?'. Language: " + (lang || 'en'),
      messages: [{ role: 'user', content: String(msg == null ? '' : msg) }],
    });
    const text = (resp.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return text || fallback();
  } catch (e) {
    return fallback();
  }
}

// Pick a fallback line by hashing the (normalized) message: same insult → same
// comeback, different insults spread across the whole pool. Deterministic, so
// it's testable and never repeats on a retry of the same message.
function cannedRoast(lang, msg) {
  const pool = CANNED[lang] || CANNED.en;
  const key = normalizeForMatch(msg).spaced;
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

// ---- Strikes --------------------------------------------------------------
// Add this message's strike(s) and return the running total in the window. A threat
// weighs 2, a roast 1. Preferred key is the client IP (stable across rotated/omitted
// conversationIds); only when no IP is available do we fall back to the legacy
// per-conversation count from persisted messages (still rotatable, but the best a
// keyless request allows). Best-effort → the current weight on any error, so a
// counter blip never *lowers* the effective strike count for this message.
async function countStrikes({ ip, conversationId, weight = 1 }) {
  if (ip) {
    try { return await botStrikes.add(ip, weight); } catch (_) { /* fall through */ }
  }
  return (await legacyConvStrikes(conversationId)) + weight;
}

// Legacy no-IP path: count persisted roast/threat rows for the conversation.
async function legacyConvStrikes(conversationId) {
  if (!conversationId) return 0;
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_messages')
      .select('source')
      .eq('conversation_id', conversationId)
      .in('source', ['roast', 'threat']);
    if (error || !Array.isArray(data)) return 0;
    return data.reduce((n, r) => n + (r.source === 'threat' ? 2 : 1), 0);
  } catch (e) {
    return 0;
  }
}

// ---- Orchestrator ---------------------------------------------------------
async function evaluate({ q, conversationId, ip } = {}) {
  const IPBLOCK_ON = process.env.BOT_THREAT_IPBLOCK_ENABLED === 'true';
  const STRIKE_MAX = Number(process.env.BOT_STRIKE_MAX) || 5;

  try {
    // Step 0 (ALWAYS ON, wins over everything): a self-harm disclosure gets
    // compassionate crisis support with helplines and NO penalty. Deterministic
    // phrase match, so it needs no model call and runs even when the roast gate
    // and IP blocking are off. Placed before the IP-block check on purpose — a
    // person in crisis is never met with a "you're on a timeout" message.
    if (detectSelfHarm(normalizeForMatch(q).spaced)) return crisisResult();

    // Step 1: already-blocked IP — read from the durable, admin-visible app blocklist
    // (in-memory O(1) cache, DB-backed, survives restarts). Enforced independently of
    // the roast flag; ipGuard also catches these upstream when IP blocking is on.
    if (IPBLOCK_ON && ip && ipBlocklist.isBlocked(ip)) {
      return { answer: IP_BLOCK_MSG, source: 'ip_block', cited_sources: [], escalate: false, locked: true };
    }

    // Roast/threat detection itself is gated by the roast flag (self-harm above is not).
    if (process.env.BOT_ROAST_ENABLED !== 'true') return null;

    const listed = checkListed(q);
    let route = null; // 'threat' | 'roast' | null
    let lang = listed ? listed.lang : 'en';

    if (listed && listed.tier === 'threat') {
      route = 'threat';
    } else if (listed && listed.tier === 'hard') {
      route = 'roast';
    } else if ((listed && listed.tier === 'mild') || (!listed && HOSTILITY_RE.test(String(q || '')))) {
      const judged = await classifyAbuse(q);
      lang = judged.language || 'en';
      // Self-harm wins over abuse/threat: support, never punish.
      if (judged.self_harm) return crisisResult();
      if (judged.danger) route = 'threat';
      else if (judged.abusive) route = 'roast';
      else return null;
    } else if (listed && listed.tier === 'directed') {
      route = 'roast';
    } else {
      return null;
    }

    if (route === 'threat') {
      // Durable, admin-visible ban via the app blocklist (fire-and-forget; respects
      // the IP master switch + allowlist). A threat also weighs 2 strikes toward the
      // cool-off, so a threat-only spammer still trips the lock, not just the ban.
      if (IPBLOCK_ON && ip) { ipBlocklist.recordAttack(ip, 'bot_threat').catch(() => {}); }
      const strikes = await countStrikes({ ip, conversationId, weight: 2 });
      if (strikes >= STRIKE_MAX) {
        return { answer: COOLOFF_MSG, source: 'abuse_lock', cited_sources: [], escalate: false, locked: true };
      }
      return { answer: THREAT_MSG, source: 'threat', cited_sources: [], escalate: false, locked: false };
    }

    // Roast path.
    const strikes = await countStrikes({ ip, conversationId, weight: 1 });
    if (strikes >= STRIKE_MAX) {
      return { answer: COOLOFF_MSG, source: 'abuse_lock', cited_sources: [], escalate: false, locked: true };
    }
    const roastText = await dynamicRoast(q, lang);
    return { answer: roastText, source: 'roast', cited_sources: [], escalate: false, locked: false };
  } catch (e) {
    return null; // fail open to the normal pipeline
  }
}

function _reset() { /* no module cache to clear */ }

module.exports = {
  evaluate, checkListed, normalizeForMatch, HOSTILITY_RE,
  IP_BLOCK_MSG, THREAT_MSG, COOLOFF_MSG, CRISIS_MSG, cannedRoast, CANNED, _reset,
};
