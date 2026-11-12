/**
 * Static guard for v3.206 (anon/authenticated WRITE lockdown). The browser never
 * writes a public table through PostgREST, so anon + authenticated must hold no
 * INSERT/UPDATE/DELETE on public tables — otherwise a signed-in user can set their
 * own plan / mark a booking paid / inflate a payout straight through the anon key.
 */
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../migrations/v3.206_lockdown_anon_writes.sql'),
  'utf8',
);

describe('v3.206 anon write lockdown migration', () => {
  test('revokes INSERT/UPDATE/DELETE on all public tables from anon + authenticated', () => {
    expect(sql).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon,\s*authenticated;/i,
    );
  });

  test('revokes write by default on future postgres-owned tables', () => {
    expect(sql).toMatch(
      /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLES\s+FROM\s+anon,\s*authenticated;/i,
    );
  });

  test('never grants write back to anon / authenticated', () => {
    expect(sql).not.toMatch(/GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*TO[^;]*\b(anon|authenticated)\b/i);
  });
});
