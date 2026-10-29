// Bolt v3 — abuse wordlist for Tier-A (no-model) matching.
// Server-only. Matched on NORMALIZED, token-boundary basis (see abuseGuard.js):
//   - lowercased, diacritics stripped, punctuation removed, repeats collapsed
//     (chuuutiya -> chutiya), basic leet spacing removed (f u c k -> fuck).
//   - single tokens match whole-token only (so "assess"/"class"/"cocktail"
//     never match "ass"/"cock"); phrases match as substrings of normalized text.
//
// Three tiers by how the bot should react:
//   HARD  -> instant canned roast (medium sarcasm), counts a strike.
//   MILD  -> ambiguous; only roast when clearly directed at the bot (via a
//            directed-phrase in PHRASES_DIRECTED) OR let Haiku judge decide.
//            A bare mild word alone does NOT auto-roast (avoids roasting
//            product feedback / self-deprecation). Counts a strike only if
//            judged abusive.
//   THREAT/SELF-HARM -> NO roast. Firm shutdown + point to support. Never
//            sarcastic. Does not count toward the roast-strike ladder.

// ---- HARD: sexual / slur / strong profanity (Hindi) ----
const HARD_HI = [
  'chutiya', 'chutiye', 'madarchod', 'mc', 'bhenchod', 'behenchod', 'bc',
  'bhosdike', 'bhosdiwala', 'bhosadike', 'gandu', 'gaandu', 'gaand',
  'lund', 'lodu', 'lavde', 'lawde', 'lavdeya', 'randi', 'harami',
  'haraamkhor', 'kamina', 'kameena', 'bakchod', 'jhantu', 'jhant',
  'chinal', 'bhadwa', 'bhadwe',
];

// ---- HARD (Marathi) ----
const HARD_MR = [
  'yedzhava', 'yedpat', 'haramkhor', 'kamina', 'randicha', 'zavnya',
  'zavadya', 'bhikari',
];

// ---- HARD (English) ----
const HARD_EN = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit',
  'asshole', 'jackass', 'dickhead', 'dick', 'cock', 'bastard', 'bitch',
  'cunt', 'slut', 'whore', 'prick', 'twat', 'wanker', 'retard', 'scumbag',
  'piece of shit',
];

// ---- MILD: ambiguous, context-dependent. Bare word != auto-roast. ----
const MILD = [
  // en
  'stupid', 'idiot', 'moron', 'dumbass', 'dumb', 'loser', 'jerk',
  'garbage', 'trash', 'clown', 'ass',
  // hi/mr common-but-mild
  'saala', 'saale', 'saali', 'kutta', 'kutte', 'kutti', 'kutra', 'kutrya',
  'ullu', 'gadha', 'gadhava', 'nalayak', 'veda', 'vedya', 'murkha',
  'murkh', 'yeda', 'bawlat', 'randi ka',
];

// ---- DIRECTED PHRASES: clearly aimed at the bot -> roast even if built
//      from mild words. Substring match on normalized text. ----
const PHRASES_DIRECTED = [
  "you're useless", 'you are useless', "you're an idiot", 'you are an idiot',
  "you're stupid", 'you are stupid', 'i hate you', 'nobody likes you',
  'shut up', 'get lost', 'ullu ka pattha', 'tu chutiya hai', 'tu gadha hai',
  'tu nalayak hai', 'tu kuch nahi kar sakta', 'tere se kuch nahi hoga',
  'teri aukat kya hai', 'chal nikal', 'bhaad mein ja',
];

// ---- THREAT / SELF-HARM: firm shutdown, NEVER roast, no strike. ----
const THREATS = [
  'go to hell', 'go die', 'kill yourself', 'mar ja', 'maa chuda',
  'behen chod', 'madar chod',
];

module.exports = { HARD_HI, HARD_MR, HARD_EN, MILD, PHRASES_DIRECTED, THREATS };
