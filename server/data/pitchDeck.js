'use strict';

/**
 * pitchDeck.js — the CONFIDENTIAL investor-deck figures + gate config.
 *
 * These numbers deliberately live server-side and are served ONLY after a viewer
 * clears the passcode + WhatsApp-OTP gate (GET /api/pitch-deck/data). They must
 * NOT be imported into the client bundle. The client renders the deck from this
 * payload at runtime; without a valid 45-min token it never receives it.
 *
 * Founder-attested metrics (per founder, incl. off-platform activations): ~45
 * paying hosts, ₹18k MRR. Live product data: 78 hosts, 190-lead pipeline.
 */

const crypto = require('crypto');

// ── Gate config (env) ────────────────────────────────────────────────────────
// PITCH_DECK_PASSCODE  — required; if unset the gate is closed (503) and the deck
//                        is unreachable. Share this out-of-band with investors.
// PITCH_DECK_EXPIRES_AT — optional ISO date/datetime; after it the whole deck is
//                        dead for everyone (410), regardless of session.
const PASSCODE = process.env.PITCH_DECK_PASSCODE || '';
const EXPIRES_AT = process.env.PITCH_DECK_EXPIRES_AT || '';

const isConfigured = () => PASSCODE.length > 0;

const isExpired = () => {
  if (!EXPIRES_AT) return false;
  const t = Date.parse(EXPIRES_AT);
  return Number.isFinite(t) && Date.now() > t;
};

// Constant-time passcode compare (avoids length/timing leaks).
const checkPasscode = (input) => {
  if (!PASSCODE) return false;
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(PASSCODE);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// ── The deck payload (numbers only; narrative/structure lives client-side) ────
const DATA = {
  cover: {
    hosts: '~45', mrr: '₹18k', raise: '₹20–30L',
    subline: 'Live since June 2026 · 78 hosts onboarded · 190-lead pipeline',
  },
  proof: { hosts: 78, paid: '~45', leads: 190, leads30d: 129 },
  mrr: [{ m: 'Jun', v: 6 }, { m: 'Jul', v: 10 }, { m: 'Aug', v: 14 }, { m: 'Sep', v: 18 }],
  funnel: [
    { label: 'Hosts onboarded', v: 78, tag: 'actual' },
    { label: 'Published a live service', v: 60, tag: 'estimate' },
    { label: 'On a paid plan', v: 45, tag: 'actual' },
  ],
  funnelPct: '~58% onboarded→paid',
  traction: { hosts: '~45', mrr: '₹18k', arr: '₹2.16L' },
  model: {
    tiers: [
      { n: 'Starter', p: '₹0', s: 'Free · 5% per booking', c: '#4AB765' },
      { n: 'Host+', p: '₹229/mo', s: '₹1,499/yr · 0% commission', c: '#269CEF' },
      { n: 'Studio', p: '₹555/mo', s: '₹3,650/yr · 0% commission', c: '#FE5100' },
    ],
    fee: '+ ₹10 flat platform fee / paid booking',
    arpu: 'Blended ARPU ~₹400/mo',
  },
  market: {
    band: { from: '$15B', to: '$62B by 2033', cagr: '22.4% CAGR' },
    rings: [
      { k: 'TAM', v: '₹6,000 Cr', usd: '~$720M', note: '~15–20M slot-based service MSMEs + ~2.5M monetized creators × ~₹3,000/yr', tag: 'assumption', r: 150, fill: '#dbeafe', fg: '#1e3a8a' },
      { k: 'SAM', v: '₹900 Cr', usd: '~$108M', note: '~3M digitally-active, payment-ready today × ~₹3,000/yr', tag: 'assumption', r: 100, fill: '#bfdbfe', fg: '#1e40af' },
      { k: 'SOM', v: '₹15 Cr ARR', usd: '~$1.8M', note: '30,000 paying hosts × ₹5,000 ARPU (3-yr obtainable)', tag: 'projection', r: 54, fill: '#FE5100', fg: '#fff' },
    ],
    sources: 'Sources: India creator economy $15.0B in 2026 → $61.9B by 2033, 22.4% CAGR (Coherent Market Insights, 2026); 2–2.5M monetized creators (BCG, 2025); ₹3,375 Cr influencer market, 18% CAGR (EY, 2026); India appointment-scheduling SaaS only ~$17.8M in 2026 (IMARC) — the category is still nascent, and we bundle payments on top of scheduling to expand ARPU.',
  },
  unit: [
    { value: '₹4,800', label: 'ARPU / yr', tag: 'estimate', accent: '#FE5100', sub: '₹400/mo blended' },
    { value: '~80%', label: 'gross margin', tag: 'assumption', accent: '#059669', sub: 'SaaS, net of PG + infra' },
    { value: '₹600', label: 'target blended CAC', tag: 'projection', accent: '#2563eb', sub: 'organic-heavy mix' },
    { value: '~1.5 mo', label: 'CAC payback', tag: 'projection', accent: '#f59e0b', sub: 'if retention holds' },
  ],
  growth: [
    { t: 'Now', v: 0.18 }, { t: '+3mo', v: 0.6 }, { t: '+6mo', v: 1.2 },
    { t: '+12mo', v: 2.5 }, { t: '+18mo', v: 9 },
  ],
  roadmap: [
    ['M0–3', 'Seat the raise. First eng hire + part-time growth. Ship venue/hourly booking polish.', '#059669'],
    ['M3–6', '150 paying hosts · ₹60k MRR. WhatsApp-native booking GA.', '#FE5100'],
    ['M6–12', '350–700 paying hosts · ₹1.2–2.5L MRR. Referral loop + category expansion (turfs, studios).', '#2563eb'],
    ['M12–18', '1,500 paying hosts · ₹9L MRR · ₹1 Cr ARR run-rate → seed-ready.', '#7c3aed'],
  ],
  ask: [
    { value: '₹20–30L', label: 'raise (angel/pre-seed)', accent: '#2563eb' },
    { value: '~18 mo', label: 'runway', accent: '#f59e0b' },
    { value: '1,500', label: 'paying hosts target', tag: 'projection', accent: '#7c3aed' },
    { value: '₹1 Cr', label: 'ARR run-rate target', tag: 'projection' },
  ],
  funds: [
    { k: 'Product / engineering', pct: 40, c: '#FE5100' },
    { k: 'Growth / GTM', pct: 30, c: '#2563eb' },
    { k: 'Founder runway', pct: 20, c: '#059669' },
    { k: 'Ops / support / infra', pct: 10, c: '#f59e0b' },
  ],
};

module.exports = { DATA, isConfigured, isExpired, checkPasscode, EXPIRES_AT };
