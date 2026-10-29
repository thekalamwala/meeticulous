// adultContentFilter.isBlocked — tiered adult/sexual-content slug guard.
// Pure (no mocks): asserts the substring/performer/hard/token tiers, leetspeak
// folding, and the Scunthorpe-problem false-positive protections.
const { isBlocked, blockedTerm } = require('../../utils/adultContentFilter');

describe('adult content filter — blocks', () => {
  test.each([
    'pornhub', 'xnxx', 'onlyfans', 'chaturbate', 'brazzers', // domains/brands
    'bestpornhub', 'xnxxfan', 'myonlyfans', 'onlyfans-official', // substring embeds
    'miakhalifa', 'miakhalifa99', 'riley-reid', 'angelawhite-yoga', // performers
    'porn', 'xxx-studio', 'hentai-club', 'nsfw', 'cumshot-cam', // hard keywords
    'sex', 'sexy-coach', 'nude-art', 'anal', 'escort-service', 'milf', // token keywords
    'sex-therapy', 'escort-in-mumbai', 'cam-girl', // token inside hyphenated slug
  ])('blocks %s', (slug) => {
    expect(isBlocked(slug)).toBe(true);
  });

  test.each([
    ['h3ntai', 'hentai via 3->e'],
    ['0nlyfans', 'onlyfans via 0->o'],
    ['s3x-coach', 'sex via 3->e'],
    ['p0rn-star', 'porn via 0->o'],
    ['x-n-x-x', 'xnxx via separator strip'],
    ['s1ut', 'slut via 1->l'],
    ['d1ck', 'dick via 1->i'],
    ['ｐｏｒｎ', 'porn via NFKC fullwidth fold'],
  ])('blocks leet/unicode evasion %s (%s)', (slug) => {
    expect(isBlocked(slug)).toBe(true);
  });
});

describe('adult content filter — allows (no false positives)', () => {
  test.each([
    'sussex-yoga', 'essex-tutor', 'middlesex-clinic', // -sex- inside a token
    'analysis-pro', 'business-analyst', 'canal-tours', // anal inside a token
    'cucumber-farm', 'cumberland-cafe', 'accumulate', // cum inside a token
    'scunthorpe-fc', 'penistone-spa', // classic Scunthorpe cases (cunt/penis tokens)
    'peacock-designs', 'cockpit-crew', 'hancock-legal', // cock inside a token
    'dickson-plumbing', 'benedict-arts', // dick inside a token
    'jane-doe', 'yoga-with-priya', 'north-star-studio', // ordinary slugs
  ])('allows %s', (slug) => {
    expect(isBlocked(slug)).toBe(false);
  });
});

describe('adult content filter — mechanics', () => {
  test('blockedTerm returns the offending term for logging', () => {
    expect(blockedTerm('bestpornhub')).toBe('pornhub');
    expect(blockedTerm('sex-coach')).toBe('sex');
    expect(blockedTerm('jane-doe')).toBeNull();
  });

  test('empty / nullish is not blocked (format gate owns that)', () => {
    expect(isBlocked('')).toBe(false);
    expect(isBlocked(null)).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });

  test('token match strips leading/trailing digits (sex1 / 69sex)', () => {
    expect(isBlocked('sex1-coach')).toBe(true);
    expect(isBlocked('69sex')).toBe(true);
  });
});
