// Auto-generated usernames: {adjective}-{noun}-{suffix}, lowercase.
// e.g. slow-bolt-nigr0, black-panther-x4k9, blue-obsidian-r8m2, north-star-q7v1
//
// Suffix scales to billions: base36 over crypto-random bytes. With ~80 adjectives
// × ~80 nouns × 36^5 suffixes the space is ~3.8e11 per default suffix length, and
// generateUnique() retries on the (rare) collision against existing history.

const crypto = require('crypto');
const { isReserved } = require('./reservedUsernames');

const ADJECTIVES = [
  'slow', 'black', 'blue', 'north', 'swift', 'calm', 'bright', 'bold', 'brave',
  'quiet', 'lucky', 'mellow', 'noble', 'royal', 'amber', 'crimson', 'golden',
  'silver', 'jade', 'ivory', 'cosmic', 'lunar', 'solar', 'misty', 'frost',
  'ember', 'velvet', 'mighty', 'gentle', 'clever', 'eager', 'humble', 'sunny',
  'stormy', 'wild', 'wise', 'zesty', 'fuzzy', 'snug', 'spry', 'breezy', 'cozy',
  'dapper', 'feral', 'glossy', 'hazy', 'jolly', 'keen', 'lush', 'merry', 'nimble',
  'placid', 'rustic', 'sleek', 'tidy', 'urban', 'vivid', 'witty', 'azure',
  'coral', 'dusky', 'fabled', 'grand', 'hardy', 'icy', 'plush', 'quaint', 'sage',
  'teal', 'tawny', 'sparse', 'rapid', 'stark', 'fond', 'fleet', 'feisty',
];

const NOUNS = [
  'bolt', 'panther', 'obsidian', 'star', 'falcon', 'comet', 'otter', 'cedar',
  'maple', 'raven', 'lynx', 'heron', 'badger', 'willow', 'ember', 'quartz',
  'onyx', 'koala', 'sloth', 'fox', 'wolf', 'hawk', 'crane', 'finch', 'bison',
  'cobra', 'gecko', 'ibis', 'jaguar', 'kraken', 'lotus', 'moose', 'newt',
  'osprey', 'puma', 'quail', 'robin', 'salmon', 'tiger', 'urchin', 'viper',
  'walrus', 'yak', 'zebra', 'aspen', 'birch', 'coral', 'dune', 'fern', 'glade',
  'harbor', 'island', 'jetty', 'knoll', 'lagoon', 'marsh', 'oasis', 'pine',
  'reef', 'summit', 'thicket', 'vale', 'wharf', 'canyon', 'delta', 'fjord',
  'grove', 'ridge', 'meadow', 'brook', 'cliff', 'cove', 'mesa', 'peak',
];

function pick(arr) {
  return arr[crypto.randomInt(arr.length)];
}

// Short, lowercase base36 suffix from crypto-random bytes.
function randomSuffix(len = 5) {
  let s = '';
  while (s.length < len) {
    s += crypto.randomBytes(4).readUInt32BE(0).toString(36);
  }
  return s.slice(0, len);
}

function generateCandidate(suffixLen = 5) {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${randomSuffix(suffixLen)}`;
}

// Produce a candidate guaranteed not-reserved and not-already-used.
// `existsFn(slug) => Promise<boolean>` checks the username_history table (injected
// for testability). Falls back to a longer suffix if 20 tries all collide.
async function generateUnique(existsFn) {
  for (let i = 0; i < 20; i++) {
    const candidate = generateCandidate();
    if (isReserved(candidate)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await existsFn(candidate))) return candidate;
  }
  // Extremely unlikely fallback: widen the suffix space.
  for (let i = 0; i < 5; i++) {
    const candidate = generateCandidate(10);
    // eslint-disable-next-line no-await-in-loop
    if (!isReserved(candidate) && !(await existsFn(candidate))) return candidate;
  }
  throw new Error('Could not generate a unique username');
}

module.exports = { generateCandidate, generateUnique, randomSuffix, ADJECTIVES, NOUNS };
