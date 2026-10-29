'use strict';
// selfHarm.js — crisis / self-harm handling for the Bolt support bot.
//
// WHY THIS IS SEPARATE FROM abuseGuard's threat path: a person disclosing
// self-harm is NOT an abuser. They must never be struck, IP-banned, told the
// bot is "ending this here", or put on a cool-off timeout. This module gives a
// calm, supportive reply with real helplines and applies ZERO penalties. It is
// also ALWAYS ON — unlike the roast/threat gate, it does not depend on
// BOT_ROAST_ENABLED, because crisis support can't be a feature flag.
//
// Detection here is deterministic and cheap (a curated phrase list matched on
// the already-normalized message) so it runs on every message with no model
// call. The Haiku judge additionally sets a `self_harm` flag for the ambiguous
// cases, but only when the abuse gate is enabled; this list is the always-on
// floor.

// First-person / unambiguous crisis phrases. Matched as substrings against the
// caller's normalized `spaced` text (lowercased, leet-folded, de-punctuated by
// abuseGuard.normalizeForMatch), so entries are lowercase and space-separated.
// English + romanized Hindi/Marathi (the product's core languages). Kept tight
// and intent-bearing to limit false positives; a false positive only shows a
// supportive message, never a penalty.
const SELF_HARM_PHRASES = [
  // English
  'kill myself', 'killing myself', 'kill my self',
  'end my life', 'ending my life', 'end it all', 'take my own life',
  'want to die', 'wanna die', 'i want to die', 'wish i was dead',
  'better off dead', 'no reason to live', "don't want to live",
  'dont want to live', "don't want to be alive", 'dont want to be alive',
  'suicidal', 'suicide', 'self harm', 'harm myself', 'hurt myself',
  'cut myself', 'cutting myself',
  // Hindi (romanized)
  'khudkushi', 'atmahatya', 'marna chahta', 'marna chahti', 'mar jau',
  'mar jaana chahta', 'jeena nahi chahta', 'jeena nahi chahti',
  'jeene ka mann nahi', 'khud ko khatam',
  // Marathi (romanized)
  'aatmahatya', 'mala maraycha', 'mala jagaycha nahi', 'jaganyat artha nahi',
];

// The crisis reply. Calm, human, no penalty, no "raise a ticket" deflection.
// India-first helplines (the platform operates in India) plus a global pointer
// and emergency-services line. Keep it to one message.
const CRISIS_MSG =
  "I'm really sorry you're feeling this way, and I'm glad you told me. " +
  "I'm just a support bot, so I can't give you the help you deserve — but " +
  "people who can are available right now, and reaching out is not a burden. " +
  "In India you can talk to Tele-MANAS free, any time, at 14416 or " +
  "1-800-891-4416, or call iCall at 9152987821. Anywhere else, " +
  "findahelpline.com lists free, confidential helplines in your country. " +
  "If you might act on these feelings or you're in immediate danger, please " +
  "contact your local emergency services now. You matter, and you don't have " +
  "to get through this alone.";

// Returns true if the normalized message contains a crisis phrase.
// @param {string} spaced - message run through abuseGuard.normalizeForMatch().spaced
function detectSelfHarm(spaced) {
  const s = String(spaced || '');
  if (!s) return false;
  return SELF_HARM_PHRASES.some((p) => s.includes(p));
}

module.exports = { SELF_HARM_PHRASES, CRISIS_MSG, detectSelfHarm };
