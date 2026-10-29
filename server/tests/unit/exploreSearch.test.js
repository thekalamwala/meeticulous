// exploreSearch: deterministic query parse + in-memory match/rank + fallbacks.
const { search, parseQuery, norm, cityOf } = require('../../lib/exploreSearch');

// Minimal catalog entry, shaped like exploreController.toEntry().
const entry = (id, o = {}) => ({
  card: { id, reviewCount: o.reviews || 0 },
  eff: o.eff ?? 50,
  prof: o.prof || '',
  svc: o.svc || '',
  mode: o.mode || 'online',
  title: norm(o.title),
  labels: norm(o.labels),
  host: norm(o.host),
  desc: norm(o.desc),
  loc: norm(o.loc),
  city: cityOf(o.loc),
});

const CATALOG = [
  entry('resume', { title: 'Review your resume', desc: 'CV feedback', loc: 'Pune, Maharashtra', eff: 40 }),
  entry('mock', { title: 'Mock Interviews', labels: 'Mock Interview mock-interview', mode: 'offline', loc: 'Nagpur, Maharashtra', eff: 30 }),
  entry('ca', { title: '1:1 Session', labels: '1:1 Session 11-session Chartered Accountant chartered-accountant', prof: 'chartered-accountant', svc: '11-session', host: 'Priya Sharma priya_s', loc: 'Mumbai' }),
  entry('advocate', { title: 'Divorce consultation', labels: 'Advocate advocate', prof: 'advocate', mode: 'offline', loc: 'Nagpur' }),
  entry('code', { title: 'Code review', desc: 'Review your codebase', loc: 'Pune', eff: 90 }),
];
const ids = (r) => r.cards.map((c) => c.id);

describe('parseQuery', () => {
  test('peels mode + city off the topic words', () => {
    expect(parseQuery('Mock Interview Offline Nagpur')).toEqual({
      tokens: ['mock', 'interview'], text: 'mock interview', location: 'nagpur', mode: 'offline',
    });
  });
  test('multi-word mode phrase, aliases, stopwords', () => {
    const p = parseQuery('best yoga in person near me in Bengaluru');
    expect(p).toMatchObject({ tokens: ['yoga'], location: 'bangalore', mode: 'offline' });
  });
  test('pure location / mode queries leave no topic', () => {
    expect(parseQuery('online')).toMatchObject({ tokens: [], mode: 'online' });
    expect(parseQuery('Chandrapur')).toMatchObject({ tokens: [], location: 'chandrapur' });
  });
  test('cities from host data are recognised too', () => {
    expect(parseQuery('yoga wadi', ['wadi']).location).toBe('wadi');
  });
});

describe('search', () => {
  test('word order does not matter (old phrase-ILIKE missed this)', () => {
    expect(ids(search(CATALOG, { q: 'resume review' }))[0]).toBe('resume');
  });
  test('synonym bridges cv → resume', () => {
    expect(ids(search(CATALOG, { q: 'cv' }))).toEqual(['resume']);
  });
  test('profession label + host name are searchable; slugs are words', () => {
    expect(ids(search(CATALOG, { q: 'chartered accountant' }))).toEqual(['ca']);
    expect(ids(search(CATALOG, { q: 'CA' }))).toEqual(['ca']);
    expect(ids(search(CATALOG, { q: 'priya' }))).toEqual(['ca']);
    expect(ids(search(CATALOG, { q: 'lawyer' }))).toEqual(['advocate']);
  });
  test('prefix + plural slack', () => {
    expect(ids(search(CATALOG, { q: 'interviews' }))).toEqual(['mock']);
    expect(ids(search(CATALOG, { q: 'mock interv' }))).toEqual(['mock']);
  });
  test('equal relevance (both title hits) → quality score orders', () => {
    // "review": code (title, eff 90 ×1.6) ahead of resume (title, eff 40 ×1.6).
    const r = search(CATALOG, { q: 'review' });
    expect(ids(r)).toEqual(['code', 'resume']);
    expect(r.match).toBe('exact');
  });
  test('location + mode filters, exact', () => {
    const r = search(CATALOG, { q: 'mock interview offline nagpur' });
    expect(ids(r)).toEqual(['mock']);
    expect(r.parsed).toEqual({ text: 'mock interview', location: 'Nagpur', mode: 'offline' });
  });
  test('partial: not every word hits → closest matches, flagged', () => {
    const r = search(CATALOG, { q: 'resume for software engineers' });
    expect(ids(r)[0]).toBe('resume');
    expect(r.match).toBe('partial');
  });
  test('relaxed_topic: topic absent in city → other services there, flagged', () => {
    const r = search(CATALOG, { q: 'yoga nagpur' });
    expect(ids(r).sort()).toEqual(['advocate', 'mock']);
    expect(r.match).toBe('relaxed_topic');
  });
  test('relaxed_location: no hosts in city → online services for the topic', () => {
    const r = search(CATALOG, { q: 'resume delhi' });
    expect(ids(r)).toEqual(['resume']);
    expect(r.match).toBe('relaxed_location');
    expect(r.parsed.location).toBe('Delhi');
  });
  test('no result at all → match none', () => {
    expect(search(CATALOG, { q: 'zzzz qqqq' })).toMatchObject({ cards: [], match: 'none' });
  });
  test('category / service filters still scope the pool', () => {
    expect(ids(search(CATALOG, { category: 'advocate' }))).toEqual(['advocate']);
    expect(ids(search(CATALOG, { category: 'chartered-accountant', service: '11-session' }))).toEqual(['ca']);
    expect(ids(search(CATALOG, { category: 'advocate', q: 'resume' }))).toEqual([]);
  });
  test('empty query lists everything by quality score', () => {
    expect(ids(search(CATALOG, {}))[0]).toBe('code');
  });
});
