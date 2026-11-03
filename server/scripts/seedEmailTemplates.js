/**
 * seedEmailTemplates.js — sync config/emailTemplates.js into `email_templates`.
 *
 * Production does this automatically on every boot (server.js →
 * services/email/templateSync), keeping rows edited in the admin editor. Run by
 * hand only to sync another DB, or with --force to overwrite admin edits too.
 *
 * Run: node scripts/seedEmailTemplates.js [--force]
 */
require('dotenv').config();
const { syncTemplates } = require('../services/email/templateSync');

syncTemplates({ force: process.argv.includes('--force') })
  .then((r) => {
    if (r.skipped) console.log(`Email template sync skipped: ${r.skipped}`);
    console.log(`Email templates: ${r.inserted} inserted, ${r.updated} updated, ${r.unchanged} unchanged.`);
    if (r.kept.length) console.log(`Kept admin edits (use --force to overwrite): ${r.kept.join(', ')}`);
    process.exit(0);
  })
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
