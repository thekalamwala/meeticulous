'use strict';
/**
 * ingestService.js — the CRM integration layer (audit Phase 5).
 *
 * External sources (Meta Lead Ads, Zoho, forms) FEED this; they never become the
 * identity store. Every inbound lead is mapped, deduped on (provider, external_id),
 * fed through leadService.upsertLead (which owns phone/email identity + merge), and
 * recorded in lead_imports for idempotency, retry and audit.
 *
 * Schema-tolerant: if lead_imports doesn't exist yet (v3.121 not applied), the lead
 * is still upserted — the audit row is best-effort, never a hard dependency.
 */
const { supabaseAdmin } = require('../../config/supabase');
const leadService = require('./leadService');
const { mapPayload } = require('./ingest/mappers');

function isMissingTable(error) {
  const code = error?.code || '';
  return code === '42P01' || /relation .*lead_imports.* does not exist/i.test(error?.message || '');
}

// Has this (provider, external_id) already been upserted? Returns the prior row
// or null. Swallows a missing-table error (fresh DB) → treat as not-seen.
async function findPrior(provider, externalId) {
  if (!externalId) return null;
  const { data, error } = await supabaseAdmin.from('lead_imports')
    .select('id, status, lead_id').eq('provider', provider).eq('external_id', externalId).maybeSingle();
  if (error && !isMissingTable(error)) throw error;
  return data || null;
}

async function record(row) {
  try {
    const { data } = await supabaseAdmin.from('lead_imports').insert(row).select('id').single();
    return data?.id || null;
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[crm] lead_imports insert failed:', e?.message || e);
    return null;
  }
}

async function finish(id, patch) {
  if (!id) return;
  try { await supabaseAdmin.from('lead_imports').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); }
  catch (e) { if (!isMissingTable(e)) console.warn('[crm] lead_imports update failed:', e?.message || e); }
}

/**
 * Ingest one external lead. Idempotent per (provider, external_id).
 * @returns {{ ok, status, leadId?, reason? }}
 *   status: 'upserted' | 'duplicate' | 'skipped' | 'error'
 */
async function ingest({ provider, payload }) {
  let mapped;
  try {
    mapped = mapPayload(provider, payload);
  } catch (e) {
    return { ok: false, status: 'error', reason: e.message };  // unknown provider / bad shape
  }
  const { patch, externalId, source, attribution, usable } = mapped;

  // Idempotency — a repeated webhook for the same external lead is a no-op.
  const prior = await findPrior(provider, externalId);
  if (prior && prior.status === 'upserted') {
    return { ok: true, status: 'duplicate', leadId: prior.lead_id };
  }

  if (!usable) {
    await record({ provider, external_id: externalId, status: 'skipped', raw: payload, mapped: patch, error: 'no identity fields' });
    return { ok: false, status: 'skipped', reason: 'no name/email/phone in payload' };
  }

  const importId = await record({ provider, external_id: externalId, status: 'received', raw: payload, mapped: patch, attempts: 1 });

  try {
    const res = await leadService.upsertLead(patch, { source, attribution, createdBy: `ingest:${provider}` });
    const leadId = res?.lead?.id || null;
    await finish(importId, { status: 'upserted', lead_id: leadId });
    return { ok: true, status: 'upserted', leadId };
  } catch (e) {
    await finish(importId, { status: 'failed', error: String(e?.message || e).slice(0, 500) });
    return { ok: false, status: 'error', reason: 'upsert failed' };
  }
}

module.exports = { ingest };
