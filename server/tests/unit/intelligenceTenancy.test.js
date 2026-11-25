/**
 * Tenant isolation for Creator Intelligence.
 *
 * §12.3 asks for this by name: "Tenant isolation is host_id = req.user.id in
 * every query, with a test that fails if any Intelligence query lacks it."
 *
 * Worth the unusual approach. One missing `.eq('host_id', …)` here would serve
 * one host's revenue, guest names and commission to another — the worst class
 * of bug this feature can have, silent, and invisible in review because the
 * query would still look fine on its own line.
 *
 * Two assertions, deliberately different in kind:
 *   1. BEHAVIOURAL — drive the controller with a fake Supabase and assert the
 *      filter is applied with the session's id.
 *   2. STRUCTURAL — read the source and assert no `.from('…')` escapes without
 *      a host filter. This catches a query added later that the behavioural
 *      test does not happen to exercise.
 */
const fs = require('fs');
const path = require('path');

const CONTROLLER = path.join(__dirname, '..', '..', 'controllers', 'intelligenceController.js');

/* ── 1. Behavioural ──────────────────────────────────────────────────────── */
const calls = [];
const makeQuery = (rows) => {
  const q = {
    select: jest.fn(() => q),
    eq: jest.fn((col, val) => { calls.push({ col, val }); return q; }),
    gte: jest.fn(() => q),
    lte: jest.fn(() => q),
    maybeSingle: jest.fn(() => Promise.resolve({ data: { plan: 'free' } })),
    then: (res) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return q;
};

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn(() => makeQuery([])) },
}));
jest.mock('../../services/planService', () => ({
  getLimit: jest.fn().mockResolvedValue(0),
  resolveVendorPlan: jest.fn(() => 'free'),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { getMoney, getOverview } = require('../../controllers/intelligenceController');

const HOST = 'host-aaaa-bbbb-cccc';
const OTHER = 'someone-else-entirely';

const run = async (handler, query = {}) => {
  calls.length = 0;
  supabaseAdmin.from.mockImplementation(() => makeQuery([]));
  const res = { json: jest.fn(() => res), status: jest.fn(() => res) };
  await handler({ user: { id: HOST }, query }, res);
  return res;
};

describe('every query is scoped to the signed-in host', () => {
  it('scopes the money endpoint', async () => {
    await run(getMoney);
    expect(calls).toContainEqual({ col: 'host_id', val: HOST });
  });

  it('scopes the overview endpoint', async () => {
    await run(getOverview);
    expect(calls).toContainEqual({ col: 'host_id', val: HOST });
  });

  it('takes the id from the session, never from the query string', async () => {
    // The attack this blocks: ?host_id=<someone else>.
    await run(getMoney, { host_id: OTHER, hostId: OTHER });
    expect(calls.some((c) => c.val === OTHER)).toBe(false);
    expect(calls).toContainEqual({ col: 'host_id', val: HOST });
  });

  it('reads the plan for the same host it reports on', async () => {
    await run(getOverview);
    const profileScope = calls.filter((c) => c.col === 'id');
    expect(profileScope.every((c) => c.val === HOST)).toBe(true);
  });
});

/* ── 2. Structural ───────────────────────────────────────────────────────── */
describe('the source itself cannot grow an unscoped query', () => {
  const src = fs.readFileSync(CONTROLLER, 'utf8');

  it('filters every table read by host, or by the host’s own id', () => {
    // Split on each .from(...) and require a host filter before the next one.
    const chunks = src.split(/\.from\(/).slice(1);
    expect(chunks.length).toBeGreaterThan(0);

    const unscoped = chunks
      .map((c) => c.split(/\.from\(/)[0])
      .filter((c) => !/\.eq\(\s*['"](host_id|id)['"]\s*,/.test(c));

    // If this fails, a query was added without scoping it. Add the filter —
    // this test is the only thing standing between a new query and one host
    // reading another's revenue.
    expect(unscoped).toEqual([]);
  });

  it('never scopes from a request parameter', () => {
    // req.query / req.params must not reach a host_id filter.
    expect(src).not.toMatch(/\.eq\(\s*['"]host_id['"]\s*,\s*req\.(query|params|body)/);
  });
});
