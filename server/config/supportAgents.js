'use strict';

/**
 * supportAgents — maps an admin's login email to the customer-facing persona they
 * appear as in support chat (one of the real Meeticulous support team members).
 *
 * WHY a config map and not a table: the roster is small and fixed. Agents log in
 * with their OWN admin accounts (the JWT already identifies who is replying — see
 * req.admin), so there is NO 4-digit code. This map only decides the warm display
 * NAME the customer sees; attribution/audit still uses the real admin id.
 *
 * RULE: keep this 1:1 — one admin email = one real person. Never let one admin
 * appear under several personas (that would be deception, not support).
 *
 * To add/rename an agent: edit PERSONAS. Promote to a DB table only if this ever
 * needs an in-admin editing UI. (ponytail: fixed roster → config file is enough.)
 */

// email (lower-cased) → display name shown to customers.
const PERSONAS = {
  'bookasloth@gmail.com': 'Shubham', // founder's admin login (see admin_users)
  'tithi@meeticulous.com': 'Tithi',
  // 8 team members from the About page — fill real login emails when provisioned.
  'durga@meeticulous.com': 'Durga',
  'aarav@meeticulous.com': 'Aarav',
  'meera@meeticulous.com': 'Meera',
  'kabir@meeticulous.com': 'Kabir',
  'ananya@meeticulous.com': 'Ananya',
  'rohan@meeticulous.com': 'Rohan',
  'isha@meeticulous.com': 'Isha',
  'vihaan@meeticulous.com': 'Vihaan',
};

const FALLBACK = 'Support Team';

// Personas who introduce themselves by role instead of "from the support team"
// (they're not team members — they ARE the company). Keyed by display name.
const TITLES = {
  Shubham: 'Founder & Engineer at Meeticulous',
};

/** Customer-facing name for an admin. Never leaks a raw email/id. */
function personaFor(email) {
  if (!email) return FALLBACK;
  return PERSONAS[String(email).trim().toLowerCase()] || FALLBACK;
}

/**
 * The auto-intro posted when an agent claims a chat. `name` is the customer's
 * first name when known (from the context service) — omitted gracefully otherwise.
 * Three shapes: a titled persona ("I'm Shubham, Founder & Engineer at Book A
 * Meeticulous."), the generic fallback (no doubled name), and a regular team member.
 */
function introMessage(persona, name) {
  const hi = name ? `Hi ${name}` : 'Hi';
  const tail = 'Give me a moment to read your messages and I\'ll help you right away.';
  if (TITLES[persona]) return `${hi} — I'm ${persona}, ${TITLES[persona]}. ${tail}`;
  if (persona === FALLBACK) return `${hi} — I'm from the Meeticulous support team. ${tail}`;
  return `${hi} — I'm ${persona} from the Meeticulous support team. ${tail}`;
}

module.exports = { personaFor, introMessage, FALLBACK, TITLES, PERSONAS };
