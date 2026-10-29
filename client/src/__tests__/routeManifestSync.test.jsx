// Drift guard: every static first-segment in the React Router config must be
// reserved (present in reservedSegments.js). Adding "/pricing" to App.jsx
// without reserving "pricing" fails THIS test — so a route can never silently
// become claimable as a username.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RESERVED_FIRST_SEGMENTS } from '../config/reservedSegments';

const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.jsx'), 'utf8');
// Capture path="..." on <Route> elements (router file: paths are the only such attr).
const routePaths = [...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

describe('route manifest covers the router', () => {
  it('extracts a sane number of route paths', () => {
    expect(routePaths.length).toBeGreaterThan(20);
  });

  it('every static first-segment is reserved', () => {
    const manifest = new Set(RESERVED_FIRST_SEGMENTS);
    const missing = [];
    for (const p of routePaths) {
      // Only top-level (absolute) routes claim a URL first-segment. A relative
      // child path like <Route path="start"> under <Route path="/dashboard/kyc/flow">
      // resolves to /dashboard/kyc/flow/start — its first segment is the parent's
      // ("dashboard"), already covered — so it's not a claimable username segment.
      if (!p.startsWith('/')) continue;
      const seg = p.replace(/^\//, '').split('/')[0];
      if (!seg || seg.startsWith(':') || seg === '*') continue; // dynamic / catch-all / index
      if (!manifest.has(seg)) missing.push(seg);
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
