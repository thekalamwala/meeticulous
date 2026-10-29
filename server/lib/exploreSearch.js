'use strict';
// exploreSearch — deterministic Explore search over the cached service catalog.
//
// A query like "physio offline in Nagpur" is split into a delivery mode
// ("offline"), a city ("Nagpur") and topic words ("physio"). Every topic word
// (or one of its synonyms) must hit the service's title, category/profession
// label, host name or description. Words match by prefix, so "therap" finds
// "therapist" and "interviews" finds "interview". No LLM and no SQL ILIKE:
// zero added latency, and nothing user-typed ever reaches a PostgREST filter.
//
// ponytail: linear scan + word-prefix match over the whole visible catalog (59
// rows on prod, 2026-10). Fine to ~2k rows; past that move matching into
// Postgres (FTS tsvector + pg_trgm for typos) and keep this parser in front.

const MAX_RESULTS = 96; // hard cap → at most 8 pages of 12

// Lowercase, collapse anything non-alphanumeric to single spaces. Slugs
// ("mock-interview"), usernames ("priya_s") and "1:1" all become plain words.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wordsOf = (s) => (s ? s.split(' ') : []);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'near', 'nearby', 'around', 'at', 'for', 'with', 'of', 'and',
  'to', 'on', 'by', 'from', 'me', 'my', 'i', 'best', 'top', 'good', 'find', 'need',
  'want', 'someone', 'who', 'book', 'booking', 'service', 'services',
]);

// Query word → extra words that also count as a hit. Multi-word entries match
// as a phrase. Prefix matching already covers stems (physio→physiotherapy,
// counsel→counselling), so this only bridges different words for one need.
const SYNONYMS = {
  lawyer: ['advocate', 'legal'],
  advocate: ['lawyer', 'legal'],
  attorney: ['lawyer', 'advocate', 'legal'],
  legal: ['lawyer', 'advocate'],
  ca: ['chartered accountant', 'accountant'],
  accountant: ['chartered accountant', 'ca'],
  tax: ['chartered accountant', 'gst', 'itr'],
  gst: ['tax', 'chartered accountant'],
  physio: ['physiotherapy', 'physiotherapist'],
  doctor: ['physician', 'gp', 'general practitioner'],
  gp: ['doctor', 'general practitioner'],
  derm: ['dermatologist', 'dermatology', 'skin'],
  skin: ['dermatologist', 'dermatology'],
  therapist: ['therapy', 'counsellor', 'counselling', 'psychologist'],
  therapy: ['therapist', 'counselling'],
  counsellor: ['counselling', 'counselor', 'therapist'],
  counselor: ['counselling', 'counsellor', 'therapist'],
  psychologist: ['therapist', 'therapy', 'counselling'],
  cv: ['resume'],
  resume: ['cv'],
  mentor: ['mentorship', 'mentoring', 'coach'],
  coach: ['coaching', 'mentor'],
  consultant: ['consultation', 'consulting', 'advisor', 'advisory'],
  consultation: ['consultant', 'consulting', 'session'],
  advisor: ['advisory', 'consultant'],
  developer: ['engineer', 'software', 'programmer', 'code'],
  programmer: ['developer', 'engineer', 'software', 'code'],
  coding: ['code', 'developer', 'software'],
  fitness: ['trainer', 'gym', 'workout'],
  gym: ['fitness', 'trainer'],
  trainer: ['fitness', 'coach'],
  tutor: ['tutoring', 'teacher', 'tuition'],
  teacher: ['tutor', 'tuition'],
  salon: ['hair', 'beauty'],
  haircut: ['salon', 'hair'],
  hr: ['human resources'],
  startup: ['founder'],
  cowork: ['coworking', 'day pass', 'desk'],
  coworking: ['cowork', 'day pass', 'desk'],
  office: ['coworking', 'desk'],
};

// Phrase → meeting_mode. Longest phrases first so "in person" wins before "in"
// is dropped as a stopword. 'hybrid' is stripped but not filtered on: no
// service is stored hybrid, so filtering would match nothing.
const MODE_PHRASES = [
  ['face to face', 'offline'], ['in person', 'offline'], ['video call', 'online'],
  ['inperson', 'offline'], ['offline', 'offline'], ['online', 'online'],
  ['virtual', 'online'], ['remote', 'online'], ['hybrid', 'hybrid'],
];

// Cities recognised even when no host lives there yet, so "yoga in Delhi" reads
// as a location (and can say "nothing in Delhi yet") instead of a topic word.
const CITIES = [
  'mumbai', 'navi mumbai', 'thane', 'delhi', 'noida', 'gurgaon', 'faridabad', 'ghaziabad',
  'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'surat', 'vadodara',
  'jaipur', 'nagpur', 'chandrapur', 'wardha', 'amravati', 'akola', 'kolhapur', 'solapur', 'nashik', 'aurangabad', 'lucknow', 'kanpur', 'indore', 'bhopal',
  'chandigarh', 'kochi', 'coimbatore', 'goa', 'patna', 'bhubaneswar', 'visakhapatnam',
];
// Alias → canonical name. Matching a host's location tries canonical + aliases.
const CITY_ALIASES = {
  bengaluru: 'bangalore', gurugram: 'gurgaon', bombay: 'mumbai', 'new delhi': 'delhi',
  calcutta: 'kolkata', madras: 'chennai', cochin: 'kochi', poona: 'pune', vizag: 'visakhapatnam',
};
const canonCity = (c) => CITY_ALIASES[c] || c;
const cityForms = (c) => [c, ...Object.keys(CITY_ALIASES).filter((a) => CITY_ALIASES[a] === c)];
const titleCase = (s) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

// Host location is free text ("Nagpur, Maharashtra"); the city is the first part.
function cityOf(location) {
  const c = norm(String(location || '').split(',')[0]);
  // Guard: only short place-like strings become parse candidates, so a stray
  // location like "work from home anywhere in india" can't swallow topic words.
  return c.length >= 3 && wordsOf(c).length <= 3 ? c : '';
}

const hasPhrase = (s, p) => ` ${s} `.includes(` ${p} `);
const dropPhrase = (s, p) => ` ${s} `.split(` ${p} `).join(' ').replace(/\s+/g, ' ').trim();

// "Mock Interview offline Nagpur" → { tokens:['mock','interview'], location:'Nagpur', mode:'offline' }
function parseQuery(q, catalogCities = []) {
  let s = norm(q);
  let mode = '';
  for (const [phrase, m] of MODE_PHRASES) {
    if (hasPhrase(s, phrase)) { mode = mode || m; s = dropPhrase(s, phrase); }
  }
  let location = '';
  const cities = [...new Set([...CITIES, ...Object.keys(CITY_ALIASES), ...catalogCities])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const c of cities) {
    if (hasPhrase(s, c)) { location = canonCity(c); s = dropPhrase(s, c); break; }
  }
  const tokens = [...new Set(wordsOf(s).filter((t) => t.length > 1 && !STOPWORDS.has(t)))];
  return { tokens, text: tokens.join(' '), location, mode };
}

// One alternative (a query word or a synonym) against one field.
function altHit(s, ws, alt) {
  if (alt.includes(' ')) return hasPhrase(s, alt);
  if (alt.length < 3) return ws.includes(alt); // "ca"/"hr"/"gp": whole word only
  return ws.some((w) =>
    w.startsWith(alt) ||
    // plural/suffix slack the other way: "interviews" ↔ "interview", "designer" ↔ "design"
    (w.length >= 4 && alt.startsWith(w) && alt.length - w.length <= 2));
}

// Field weights, best first. Mapped to the old relevance tiers: all-title 1.6,
// all-label/host 1.3, all-description 1.0 (see mult below).
const FIELDS = [[3, 'title'], [2, 'labels'], [2, 'host'], [1, 'desc']];

function rank(entries, groups, requireAll) {
  const out = [];
  for (const e of entries) {
    const fields = FIELDS.map(([w, k]) => [w, e[k] || '', wordsOf(e[k] || '')]);
    let matched = 0;
    let weight = 0;
    for (const g of groups) {
      const hit = fields.find(([, s, ws]) => g.some((alt) => altHit(s, ws, alt)));
      if (hit) { matched++; weight += hit[0]; }
    }
    if (groups.length && (requireAll ? matched < groups.length : matched === 0)) continue;
    const mult = matched ? 1 + 0.3 * (weight / matched - 1) : 1;
    out.push({ card: e.card, matched, mult, eff: e.eff || 0, final: mult * (e.eff || 0) });
  }
  // Relevance breaks ties BEFORE quality, so unscored services (eff 0) still
  // order by how well they match instead of arbitrarily.
  return out.sort((a, b) =>
    b.matched - a.matched || b.final - a.final || b.mult - a.mult || b.eff - a.eff ||
    (b.card.reviewCount || 0) - (a.card.reviewCount || 0));
}

const locMatches = (loc, city) => cityForms(city).some((c) => hasPhrase(loc || '', c));

// Never dead-end. Each step only runs if the one before found nothing:
//   exact            every topic word hits, inside the location/mode filters
//   partial          at least one topic word hits ("closest matches")
//   relaxed_topic    drop the topic, keep location/mode ("other services in Nagpur")
//   relaxed_location nothing in that city → online services, which work anywhere
function search(catalog, { category = '', service = '', q = '' } = {}) {
  const pool = (catalog || []).filter((e) =>
    (!category || e.prof === category) && (!service || e.svc === service));
  const p = parseQuery(q, (catalog || []).map((e) => e.city));
  const groups = p.tokens.map((t) => [t, ...(SYNONYMS[t] || [])]);
  const modeFilter = p.mode === 'online' || p.mode === 'offline' ? p.mode : '';
  const filtered = pool.filter((e) =>
    (!p.location || locMatches(e.loc, p.location)) && (!modeFilter || e.mode === modeFilter));

  let match = 'exact';
  let ranked = rank(filtered, groups, true);
  if (!ranked.length && groups.length) {
    match = 'partial';
    ranked = rank(filtered, groups, false);
  }
  if (!ranked.length && groups.length && (p.location || modeFilter)) {
    match = 'relaxed_topic';
    ranked = rank(filtered, [], true);
  }
  if (!ranked.length && p.location && modeFilter !== 'offline') {
    match = 'relaxed_location';
    const online = pool.filter((e) => e.mode === 'online');
    ranked = rank(online, groups, true);
    if (!ranked.length && groups.length) ranked = rank(online, groups, false);
  }
  if (!ranked.length) match = 'none';

  return {
    cards: ranked.slice(0, MAX_RESULTS).map((x) => x.card),
    parsed: { text: p.text, location: p.location ? titleCase(p.location) : '', mode: p.mode },
    match,
  };
}

module.exports = { search, parseQuery, norm, cityOf, MAX_RESULTS };
