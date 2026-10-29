// Coverage guard: every first-segment in the CLIENT route manifest
// (client/src/config/reservedSegments.js) must be reserved server-side (L1).
// This binds the two sides without a cross-package import: if the client adds a
// route segment but the server doesn't reserve it, server enforcement would have
// a hole — this test fails first. Reads the client file as text via fs.
const fs = require('fs');
const path = require('path');
const { RESERVED_SET } = require('../../config/reservedNamespaces');
const { normalizeSlug } = require('../../utils/slugNormalize');

const clientManifestPath = path.resolve(
  __dirname,
  '../../../client/src/config/reservedSegments.js',
);

describe('client route manifest is fully reserved in server L1', () => {
  const src = fs.readFileSync(clientManifestPath, 'utf8');
  // Extract the array body of RESERVED_FIRST_SEGMENTS, then the quoted tokens.
  const body = src.slice(
    src.indexOf('RESERVED_FIRST_SEGMENTS'),
    src.indexOf('];', src.indexOf('RESERVED_FIRST_SEGMENTS')),
  );
  const segments = [...body.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);

  it('parsed a sane number of segments', () => {
    expect(segments.length).toBeGreaterThan(20);
  });

  it.each(segments)('server L1 reserves "%s"', (seg) => {
    expect(RESERVED_SET.has(normalizeSlug(seg))).toBe(true);
  });
});
