/**
 * tests/unit/badgeEngine.test.js
 * Badge engine tests — pure rule evaluation + mocked-DB evaluate() pass.
 */

const mockDb = {
  vendor_metrics: [],
  badges: [],
  badge_rules: [],
  vendor_badges: [],
  inserted: [],
  revokedIds: [],
};

jest.mock('../../config/supabase', () => {
  const filterRows = (rows, filters) =>
    rows.filter((r) => filters.every((f) => {
      if (f.op === 'eq') return r[f.col] === f.val;
      if (f.op === 'is') return r[f.col] === f.val;
      if (f.op === 'in') return f.val.includes(r[f.col]);
      return true;
    }));

  const admin = {
    from(table) {
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push({ op: 'eq', col, val }); return builder; },
        is(col, val) { filters.push({ op: 'is', col, val }); return builder; },
        in(col, val) { filters.push({ op: 'in', col, val }); return builder; },
        insert(rows) {
          mockDb.inserted.push(...[].concat(rows));
          return Promise.resolve({ error: null });
        },
        update(_changes) {
          return {
            in(_col, ids) {
              mockDb.revokedIds.push(...ids);
              return Promise.resolve({ error: null });
            },
          };
        },
        then(resolve) {
          resolve({ data: filterRows(mockDb[table] || [], filters), error: null });
        },
      };
      return builder;
    },
  };
  return { supabaseAdmin: admin, supabase: admin };
});

const {
  evaluateRule, evaluateBadge, evaluate, METRIC_FIELDS,
} = require('../../services/badgeEngine');

const SNAP = {
  vendor_id: 'v1', completed_bookings: 120, revenue: 50000, avg_rating: 4.9,
  review_count: 30, five_star_reviews: 25, one_star_reviews: 0,
  avg_response_time_minutes: 0, active_days: 80, login_streak: 0,
  repeat_customers: 12, customer_count: 90, cancellation_count: 2,
  inactive_days: 3, account_age_days: 400,
  // Attribute metrics (0/1) — see v3.173 (Google/LinkedIn verification badges).
  has_google_identity: 1, linkedin_verified: 0,
};

describe('badgeEngine — rule evaluation', () => {
  test('all metric fields (14 PRD + 2 attribute) are supported', () => {
    expect(METRIC_FIELDS).toHaveLength(16);
    expect(METRIC_FIELDS).toEqual(expect.arrayContaining(['has_google_identity', 'linkedin_verified']));
    METRIC_FIELDS.forEach((f) => expect(SNAP).toHaveProperty(f));
  });

  test('operators behave correctly', () => {
    expect(evaluateRule(SNAP, { field: 'completed_bookings', operator: '>=', value: 100 })).toBe(true);
    expect(evaluateRule(SNAP, { field: 'completed_bookings', operator: '<', value: 100 })).toBe(false);
    expect(evaluateRule(SNAP, { field: 'cancellation_count', operator: '=', value: 2 })).toBe(true);
    expect(evaluateRule(SNAP, { field: 'avg_rating', operator: '>', value: 4.8 })).toBe(true);
    expect(evaluateRule(SNAP, { field: 'inactive_days', operator: '<=', value: 3 })).toBe(true);
  });

  test('unknown field or operator fails closed', () => {
    expect(evaluateRule(SNAP, { field: 'made_up_field', operator: '>=', value: 1 })).toBe(false);
    expect(evaluateRule(SNAP, { field: 'revenue', operator: '!=', value: 1 })).toBe(false);
  });

  test('AND logic: all rules must pass', () => {
    const badge = { rule_logic: 'AND' };
    const rules = [
      { field: 'avg_rating', operator: '>=', value: 4.8, group_id: 0 },
      { field: 'review_count', operator: '>=', value: 25, group_id: 0 },
    ];
    expect(evaluateBadge(SNAP, badge, rules)).toBe(true);
    expect(evaluateBadge({ ...SNAP, review_count: 10 }, badge, rules)).toBe(false);
  });

  test('OR logic across groups: any group passing is enough', () => {
    const badge = { rule_logic: 'OR' };
    const rules = [
      { field: 'completed_bookings', operator: '>=', value: 1000, group_id: 0 }, // fails
      { field: 'avg_rating', operator: '>=', value: 4.8, group_id: 1 },          // passes
    ];
    expect(evaluateBadge(SNAP, badge, rules)).toBe(true);
  });

  test('badge with zero rules never awards', () => {
    expect(evaluateBadge(SNAP, { rule_logic: 'AND' }, [])).toBe(false);
  });
});

describe('badgeEngine — evaluate() pass', () => {
  const HUNDRED_CLUB = {
    id: 'b1', name: 'Hundred Club', badge_type: 'automatic', status: 'active', rule_logic: 'AND',
  };
  const RULE = { id: 'r1', badge_id: 'b1', field: 'completed_bookings', operator: '>=', value: 100, group_id: 0 };

  beforeEach(() => {
    mockDb.badges = [HUNDRED_CLUB];
    mockDb.badge_rules = [RULE];
    mockDb.vendor_metrics = [SNAP, { ...SNAP, vendor_id: 'v2', completed_bookings: 5 }];
    mockDb.vendor_badges = [];
    mockDb.inserted = [];
    mockDb.revokedIds = [];
  });

  test('awards qualifying vendor, skips non-qualifying', async () => {
    const result = await evaluate();
    expect(result.awarded).toBe(1);
    expect(mockDb.inserted[0]).toMatchObject({ vendor_id: 'v1', badge_id: 'b1', assigned_by: null });
  });

  test('does not duplicate an existing award', async () => {
    mockDb.vendor_badges = [{ id: 'vb1', vendor_id: 'v1', badge_id: 'b1', assigned_by: null, revoked_at: null }];
    const result = await evaluate();
    expect(result.awarded).toBe(0);
  });

  test('revokes engine-awarded badge when rules no longer pass', async () => {
    mockDb.vendor_metrics = [{ ...SNAP, completed_bookings: 50 }];
    mockDb.vendor_badges = [{ id: 'vb1', vendor_id: 'v1', badge_id: 'b1', assigned_by: null, revoked_at: null }];
    const result = await evaluate();
    expect(result.revoked).toBe(1);
    expect(mockDb.revokedIds).toContain('vb1');
  });

  test('NEVER auto-revokes a manually-assigned badge', async () => {
    mockDb.vendor_metrics = [{ ...SNAP, completed_bookings: 50 }];
    mockDb.vendor_badges = [{ id: 'vb1', vendor_id: 'v1', badge_id: 'b1', assigned_by: 'admin-1', revoked_at: null }];
    const result = await evaluate();
    expect(result.revoked).toBe(0);
  });

  test('no active automatic badges → no-op', async () => {
    mockDb.badges = [];
    const result = await evaluate();
    expect(result).toEqual({ evaluated: 0, awarded: 0, revoked: 0 });
  });
});
