'use strict';
/**
 * Prints idempotent SQL that upserts the 8 Cold Calling templates into crm_templates.
 * Run the output via Supabase MCP execute_sql on STAGING (xwvciqkayammbvsidqig) then
 * PROD (ayjhlwyzszykqtnaktpb). (Local .env points at staging only.) Re-runnable:
 * content updates, is_active is NOT touched on conflict so an approved WhatsApp
 * template stays approved.
 *
 *   node scripts/seedColdCallTemplates.js > cold_call_templates.sql
 */
const { COLD_CALL_TEMPLATES } = require('../services/crm/coldCallTemplates');

const q = (s) => (s == null ? 'NULL' : `$cc$${s}$cc$`);
const values = COLD_CALL_TEMPLATES.map((t) =>
  `(${q(t.channel)}, ${q(t.name)}, ${q(t.label)}, ${q(t.category)}, ${q(JSON.stringify(t.variables))}::jsonb, ${q(t.subject)}, ${q(t.body)}, ${t.is_active}, 'seed:cold_call')`);

process.stdout.write(`INSERT INTO crm_templates (channel, name, label, category, variables, subject, body, is_active, created_by)
VALUES
${values.join(',\n')}
ON CONFLICT (channel, lower(name)) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, variables = EXCLUDED.variables,
  subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();
`);
