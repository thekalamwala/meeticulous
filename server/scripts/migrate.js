/**
 * Migration runner — apply a SQL file to staging or prod.
 *
 * Usage:
 *   node scripts/migrate.js staging path/to/migration.sql
 *   node scripts/migrate.js prod    path/to/migration.sql
 *   node scripts/migrate.js staging --seed   ← apply full schema dump (first-time setup)
 *
 * Requires DATABASE_URL in the target env file:
 *   .env.staging  (for staging)
 *   .env          (for prod — already exists)
 *
 * Get DATABASE_URL from:
 *   Supabase dashboard → Project Settings → Database → URI (mode: Session)
 *   Format: postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

const [,, target, filePath] = process.argv;

if (!target || !filePath) {
  console.error('Usage: node scripts/migrate.js <staging|prod> <path/to/file.sql|--seed>');
  process.exit(1);
}

const envFile = target === 'staging' ? '.env.staging' : '.env';
const envPath = path.join(__dirname, '..', envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envFile} — copy .env.staging.example and fill in staging credentials.`);
  process.exit(1);
}

require('dotenv').config({ path: envPath });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(`DATABASE_URL not set in ${envFile}`);
  process.exit(1);
}

const sqlFile = filePath === '--seed'
  ? path.join(__dirname, '..', '..', 'staging_schema.sql')
  : path.resolve(filePath);

if (!fs.existsSync(sqlFile)) {
  console.error(`File not found: ${sqlFile}`);
  process.exit(1);
}

async function run() {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  console.log(`\nTarget : ${target}`);
  console.log(`File   : ${path.basename(sqlFile)} (${(sql.length / 1024).toFixed(1)} KB)`);
  console.log('Running...\n');

  await client.connect();
  try {
    await client.query(sql);
    console.log('Done.');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
