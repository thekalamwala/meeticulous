/**
 * Creator Intelligence store — against a REAL Postgres, not a mock.
 *
 * §15 of the design makes this a Phase 2 prerequisite, and it is the right call:
 * every other server test in this repo mocks Supabase wholesale, which can
 * prove we called the right method but never that the schema accepts the row,
 * that the unique index actually dedupes, or that our counts match what SQL
 * says. Those are exactly the three things a host is charged for.
 *
 * Skips cleanly without DATABASE_URL_TEST, so local runs and the pre-push hook
 * are unaffected. CI provides it via a postgres service.
 *
 *   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=mttest -p 55432:5432 postgres:16
 *   DATABASE_URL_TEST=postgres://postgres:test@localhost:55432/mttest npx jest tests/integration
 */
const fs = require('fs');
const path = require('path');

const URL = process.env.DATABASE_URL_TEST;
const describeDb = URL ? describe : describe.skip;

describeDb('analytics store (real Postgres)', () => {
  let Client;
  let db;

  const HOST = '11111111-1111-4111-8111-111111111111';
  const migration = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', f), 'utf8');

  beforeAll(async () => {
    ({ Client } = require('pg'));
    db = new Client({ connectionString: URL });
    await db.connect();

    // Supabase's roles exist on every real project; a vanilla Postgres has none
    // of them, and the migration's REVOKEs name them.
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.query(`DO $$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }

    // The two parents the migration references. Minimal on purpose: this test
    // is about the analytics schema, not about reproducing the product's.
    await db.query(`
      DROP TABLE IF EXISTS booking_attribution, analytics_daily_dim, analytics_daily,
                           analytics_events, benchmark_daily, bookings, profiles CASCADE;
      CREATE TABLE profiles (id uuid PRIMARY KEY);
      CREATE TABLE bookings (
        id uuid PRIMARY KEY,
        host_id uuid REFERENCES profiles(id),
        service_id uuid,
        payment_status text,
        created_at timestamptz
      );
      INSERT INTO profiles (id) VALUES ('${HOST}');
    `);

    await db.query(migration('v3.217_creator_intelligence.sql'));
    await db.query(migration('v3.218_analytics_size_fn.sql'));
  }, 60_000);

  afterAll(async () => { if (db) await db.end(); });

  beforeEach(async () => {
    await db.query('TRUNCATE analytics_events, analytics_daily, analytics_daily_dim, booking_attribution');
  });

  const insert = (e) => db.query(
    `INSERT INTO analytics_events
       (host_id, visitor_id, event, service_id, occurred_at, source, medium, device_type, ingest_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (ingest_id) DO NOTHING`,
    [e.host_id || HOST, e.visitor_id || 'v1', e.event, e.service_id || null,
      e.occurred_at, e.source || null, e.medium || null, e.device_type || null, e.ingest_id],
  );

  it('applies the migration and creates every table', async () => {
    const { rows } = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
        ('analytics_events','analytics_daily','analytics_daily_dim','booking_attribution','benchmark_daily')
      ORDER BY table_name`);
    expect(rows.map((r) => r.table_name)).toEqual([
      'analytics_daily', 'analytics_daily_dim', 'analytics_events', 'benchmark_daily', 'booking_attribution',
    ]);
  });

  it('dedupes a replayed beacon — the property the unique index exists for', async () => {
    const e = { event: 'host_profile_viewed', occurred_at: '2026-11-17T06:00:00Z', ingest_id: 'replay-me' };
    await insert(e);
    await insert(e); // the same beacon, flushed twice after a failed response
    await insert(e);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM analytics_events');
    expect(rows[0].n).toBe(1);
  });

  it('counts what SQL counts', async () => {
    // Hand-written expectation, deliberately not computed by the code under test.
    const events = [
      { event: 'host_profile_viewed', visitor_id: 'a', source: 'instagram', device_type: 'mobile' },
      { event: 'host_profile_viewed', visitor_id: 'a', source: 'instagram', device_type: 'mobile' },
      { event: 'host_profile_viewed', visitor_id: 'b', source: 'whatsapp', device_type: 'desktop' },
      { event: 'service_viewed', visitor_id: 'b', source: 'whatsapp', service_id: null },
      { event: 'booking_started', visitor_id: 'b', source: 'whatsapp' },
      { event: 'checkout_started', visitor_id: 'b', source: 'whatsapp' },
    ];
    await Promise.all(events.map((e, i) => insert({
      ...e, occurred_at: '2026-11-17T06:00:00Z', ingest_id: `c-${i}`,
    })));

    const { rows: sql } = await db.query(`
      SELECT count(*) FILTER (WHERE event = 'host_profile_viewed')::int AS profile_views,
             count(*) FILTER (WHERE event = 'service_viewed')::int      AS service_views,
             count(*) FILTER (WHERE event = 'booking_started')::int     AS booking_starts,
             count(*) FILTER (WHERE event = 'checkout_started')::int    AS checkout_starts,
             count(DISTINCT visitor_id)::int                            AS unique_visitors
      FROM analytics_events`);

    const { rows: raw } = await db.query('SELECT * FROM analytics_events ORDER BY occurred_at');
    const { fold } = require('../../services/intelRollup');
    const counters = fold(raw).daily.get(HOST);

    expect(counters).toMatchObject({
      profile_views: sql[0].profile_views,
      service_views: sql[0].service_views,
      booking_starts: sql[0].booking_starts,
      checkout_starts: sql[0].checkout_starts,
      unique_visitors: sql[0].unique_visitors,
    });
    // And the numbers are what a person would count by hand.
    expect(counters).toMatchObject({ profile_views: 3, unique_visitors: 2, new_visitors: 2 });
  });

  it('refuses a benchmark row that would break k-anonymity', async () => {
    // The CHECK is the privacy guarantee; a code path that forgets it must fail
    // loudly at the database rather than publish a 4-host median.
    await expect(db.query(
      `INSERT INTO benchmark_daily (cohort_key, day, host_count) VALUES ('nutritionist', '2026-11-17', 4)`,
    )).rejects.toThrow(/benchmark_daily_k_anonymity_check/);

    await expect(db.query(
      `INSERT INTO benchmark_daily (cohort_key, day, host_count) VALUES ('nutritionist', '2026-11-17', 5)`,
    )).resolves.toBeTruthy();
  });

  it('rejects a dimension type outside the allowed set', async () => {
    await expect(db.query(
      `INSERT INTO analytics_daily_dim (host_id, day, dim_type, dim_value) VALUES ($1,'2026-11-17','ip_address','1.2.3.4')`,
      [HOST],
    )).rejects.toThrow(/analytics_daily_dim_type_check/);
  });

  it('reports its own size, which is what the ingest guard reads', async () => {
    await insert({ event: 'host_profile_viewed', occurred_at: '2026-11-17T06:00:00Z', ingest_id: 'size-1' });
    const { rows } = await db.query('SELECT analytics_events_size_bytes() AS bytes');
    expect(Number(rows[0].bytes)).toBeGreaterThan(0);
  });

  it('keeps analytics unreadable through the anon key', async () => {
    // v3.186 / v3.206 posture: the publishable key ships in the client bundle,
    // and a host's traffic is their commercial data.
    const { rows } = await db.query(`
      SELECT count(*)::int AS n
      FROM information_schema.role_table_grants
      WHERE table_name = 'analytics_events' AND grantee IN ('anon','authenticated')`);
    expect(rows[0].n).toBe(0);
  });
});
