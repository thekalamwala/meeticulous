/**
 * Static guards for v3.186 (anon lockdown) and for every later migration:
 * a view created in public without security_invoker runs with OWNER rights and
 * is readable through the public anon key — the host_activation leak.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../migrations');
const sql = fs.readFileSync(path.join(DIR, 'v3.186_lockdown_anon_rpc_and_views.sql'), 'utf8');

// [major, minor] from "v3.186_x.sql"
const versionOf = (f) => (f.match(/^v(\d+)\.(\d+)/) || []).slice(1).map(Number);
const atLeast = ([a, b], [x, y]) => a > x || (a === x && b >= y);

describe('v3.186 anon lockdown migration', () => {
  const FUNCTIONS = [
    'change_username', 'compute_service_score', 'handle_new_user', 'increment_invite_visit',
    'increment_product_purchase_count', 'is_reserved_slug', 'merge_lead_rows', 'post_journal_entry',
    'recompute_all_service_scores', 'rls_auto_enable', 'set_onboarding_username',
    'trg_recompute_service_score', 'try_acquire_job_lock',
  ];

  test.each(FUNCTIONS)('revokes EXECUTE on %s from PUBLIC, anon, authenticated', (fn) => {
    expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\)\\s+FROM PUBLIC, anon, authenticated;`));
  });

  test.each(['host_activation', 'host_activation_funnel', 'vendor_metrics'])('%s becomes security_invoker', (v) => {
    expect(sql).toMatch(new RegExp(`ALTER VIEW public\\.${v}\\s+SET \\(security_invoker = true\\);`));
    expect(sql).toMatch(new RegExp(`REVOKE ALL ON [^;]*public\\.${v}[^;]*FROM anon, authenticated;`));
  });

  test('never grants anything to anon or authenticated', () => {
    expect(sql).not.toMatch(/GRANT[^;]*TO[^;]*\b(anon|authenticated|PUBLIC)\b/i);
  });

  test('future postgres-owned functions get no automatic anon EXECUTE', () => {
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;/);
  });
});

describe('views created from v3.186 on', () => {
  const later = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql') && atLeast(versionOf(f), [3, 186]));

  test.each(later)('%s: every CREATE VIEW sets security_invoker', (f) => {
    const body = fs.readFileSync(path.join(DIR, f), 'utf8');
    const views = body.match(/CREATE\s+(OR\s+REPLACE\s+)?VIEW[\s\S]*?\bAS\b/gi) || [];
    for (const v of views) expect(v).toMatch(/security_invoker\s*=\s*(true|on)/i);
  });
});

/**
 * A SECURITY DEFINER function runs as its OWNER, so whatever the CALLER's
 * search_path resolves an unqualified table name to is what runs with owner
 * rights. v3.204 shipped increment_coupon_redemption with the revoke but
 * without the pin - the same class of miss v3.186 exists to stop, one layer
 * down - and v3.221 fixed it. This is the guard, so the next one is caught
 * here rather than by a security advisor months later.
 */
describe('SECURITY DEFINER functions from v3.186 on pin search_path', () => {
  const later = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql') && atLeast(versionOf(f), [3, 186]));

  // Header = CREATE FUNCTION up to the body delimiter, with -- comments stripped
  // so words in a comment above a function cannot satisfy or trip the check.
  const headers = (body) =>
    (body.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[\s\S]*?\bAS\s+\$/gi) || [])
      .map((h) => h.replace(/--[^\r\n]*/g, ''));

  test.each(later)('%s', (f) => {
    for (const h of headers(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      if (/SECURITY\s+DEFINER/i.test(h)) expect(h).toMatch(/SET\s+search_path\s*=/i);
    }
  });

  test('the matcher sees a definition it should reject', () => {
    // Without this, a regex that silently matched nothing would make the suite
    // above pass for every migration forever.
    const bad = 'create or replace function f(x uuid)\n returns void language sql security definer as $$ select 1; $$;';
    expect(headers(bad)).toHaveLength(1);
    expect(headers(bad)[0]).not.toMatch(/SET\s+search_path\s*=/i);

    const good = 'create function g() returns void language sql security definer set search_path = public, pg_temp as $$ select 1; $$;';
    expect(headers(good)[0]).toMatch(/SET\s+search_path\s*=/i);
  });

  test('a definition whose only search_path is in a comment does not count', () => {
    const sneaky = '-- set search_path = public\ncreate function h() returns void language sql security definer as $$ select 1; $$;';
    expect(headers(sneaky)[0]).not.toMatch(/SET\s+search_path\s*=/i);
  });

  test('v3.221 pins the function v3.204 left open', () => {
    const fix = fs.readFileSync(path.join(DIR, 'v3.221_coupon_fn_search_path.sql'), 'utf8');
    // pg_temp named explicitly: when it is absent from the path Postgres searches
    // the temp schema FIRST, so "= public" alone still allows a temp-table shadow.
    expect(fix).toMatch(/ALTER FUNCTION public\.increment_coupon_redemption\(uuid\)\s+SET search_path = public, pg_temp;/);
  });
});
