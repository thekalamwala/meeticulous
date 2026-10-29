'use strict';
// seoFixService.js — read/stage helpers for the SEO fix queue (v3.148 seo_fixes).
// Phase 2 is DRY_RUN: approve/reject only move a proposal's status, they never
// touch a live page (apply lands in Phase 3). Fail soft when the table is missing
// (pre-migration) so the admin API degrades to an empty queue instead of 500ing.
const { supabaseAdmin } = require('../../config/supabase');

const MISSING = (e) => e && (e.code === '42P01' || /seo_fixes/.test(e.message || '') && /exist/.test(e.message || ''));

async function listFixes(filters = {}) {
  try {
    let q = supabaseAdmin.from('seo_fixes').select('*').order('created_at', { ascending: false });
    if (filters.crawlId) q = q.eq('crawl_id', filters.crawlId);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.approvalLevel) q = q.eq('approval_level', filters.approvalLevel);
    if (filters.limit) q = q.limit(Number(filters.limit));
    const { data, error } = await q;
    if (error) { if (MISSING(error)) return []; throw error; }
    return data || [];
  } catch (e) { if (MISSING(e)) return []; throw e; }
}

async function fixSummary({ crawlId } = {}) {
  const rows = await listFixes({ crawlId, limit: 5000 });
  const byLevel = {}; const byStatus = {};
  for (const r of rows) {
    byLevel[r.approval_level] = (byLevel[r.approval_level] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  return { total: rows.length, byLevel, byStatus };
}

async function getFix(id) {
  try {
    const { data, error } = await supabaseAdmin.from('seo_fixes').select('*').eq('id', id).maybeSingle();
    if (error) { if (MISSING(error)) return null; throw error; }
    return data;
  } catch (e) { if (MISSING(e)) return null; throw e; }
}

// Stage a decision. Phase 2: approve => 'approved' (queued for Phase 3 apply),
// reject => 'rejected'. Only a still-'proposed' row can transition (idempotent-ish
// guard against double clicks / already-applied rows).
async function decideFix(id, { decision, adminId } = {}) {
  const fix = await getFix(id);
  if (!fix) throw new Error('Fix not found');
  if (fix.status !== 'proposed') return fix; // already decided/applied — no-op
  const patch = decision === 'approve'
    ? { status: 'approved', approved_at: new Date().toISOString(), approved_by: adminId || null }
    : { status: 'rejected' };
  const { data, error } = await supabaseAdmin.from('seo_fixes').update(patch).eq('id', id).eq('status', 'proposed').select('*');
  if (error) throw error;
  return (data && data[0]) || { ...fix, ...patch };
}

module.exports = { listFixes, fixSummary, getFix, decideFix };
