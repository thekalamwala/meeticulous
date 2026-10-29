// server/services/seo/fixes/apply.js — Phase 3 apply → re-test → rollback.
//
// Two apply paths (spec §3a):
//   • db_field  → a guarded direct DB write (allowlist below; EMPTY by default so
//                 nothing UGC is ever auto-written — a safe column is opted in
//                 deliberately via FIELD_MAP + SEO_APPLY_DB_FIELDS).
//   • code/content (meta_builder | prerender | content) → NOT written here. Claude
//     Code lands the change as a PR; the admin then calls markApplied with the PR
//     ref. The server never edits source or opens PRs.
//
// Nothing is marked FIXED on a successful write alone (spec §3b): the URL is
// re-crawled and re-scored, and the fix is FIXED only if its rule no longer fires.
// DRY_RUN (SEO_FIX_DRY_RUN, default true) blocks every write.

// Which (page_type, field) may be auto-written, and where the row lives. EMPTY by
// default — auto-DB-apply is inert until a genuinely SEO-only, non-identity column
// is opted in here. Example shape (commented, not active):
//   'blog:meta_description': { table: 'blogs', column: 'meta_description', match: 'urlSlug' },
const FIELD_MAP = {};
const ENABLED = new Set((process.env.SEO_APPLY_DB_FIELDS || '').split(',').map((s) => s.trim()).filter(Boolean));

const isDryRun = () => (process.env.SEO_FIX_DRY_RUN || 'true') !== 'false';

// Re-crawl ONE url + re-run the per-page rules → {status, health, ruleKeys}.
async function retest(url, pageType, inSitemap = false) {
  const crawler = require('../seoCrawler');
  const { buildContext, runRules } = require('../rules');
  const { scorePage } = require('../healthScore');
  const page = await crawler.crawlOne({ url, pageType, inSitemap: !!inSitemap });
  const ctx = buildContext([page], new Set(inSitemap ? [url.replace(/\/$/, '')] : []));
  const issues = runRules(page, ctx);
  const decorated = issues.map((i) => ({ severity: i.severity, category: i.category, ruleKey: i.ruleKey }));
  const sp = scorePage(decorated, pageType);
  return { status: sp.status, health: sp.health, ruleKeys: issues.map((i) => i.ruleKey), httpStatus: page.httpStatus };
}

const resolved = (fix, r) => !r.ruleKeys.includes(fix.rule_key);

async function finishWithRetest(supabaseAdmin, fix, patch) {
  const r = await retest(fix.url, fix.page_type, false);
  const ok = resolved(fix, r);
  const full = { ...patch, test_after: { status: r.status, health: r.health, resolved: ok }, status: ok ? 'applied' : 'failed' };
  const { data, error } = await supabaseAdmin.from('seo_fixes').update(full).eq('id', fix.id).select('*');
  if (error) throw error;
  return { ok, retest: r, fix: (data && data[0]) || { ...fix, ...full } };
}

// Direct DB write for an allowlisted db_field fix. Throws NotConfigured otherwise.
async function writeDbField(supabaseAdmin, fix) {
  const key = `${fix.page_type}:${fix.field}`;
  const map = FIELD_MAP[key];
  if (!map || !ENABLED.has(key)) { const e = new Error(`No writable DB field configured for ${key}`); e.code = 'NOT_CONFIGURED'; throw e; }
  if (fix.new_value == null) { const e = new Error('Fix has no new_value to write'); e.code = 'NO_VALUE'; throw e; }
  // match strategy resolves which row to update from the fix URL.
  const slug = fix.url.replace(/\/$/, '').split('/').pop();
  const { error } = await supabaseAdmin.from(map.table).update({ [map.column]: fix.new_value }).eq(map.matchColumn || 'slug', slug);
  if (error) throw error;
}

async function applyFix(id, { adminId } = {}) {
  const { supabaseAdmin } = require('../../../config/supabase');
  const { getFix } = require('../seoFixService');
  const fix = await getFix(id);
  if (!fix) throw new Error('Fix not found');
  if (fix.status !== 'approved') return { ok: false, reason: `status is ${fix.status}, not approved` };
  if (isDryRun()) return { ok: false, dryRun: true, message: 'DRY_RUN — set SEO_FIX_DRY_RUN=false to apply.' };

  // Code/content fixes are landed by Claude Code as a PR, not written here.
  if (fix.target !== 'db_field') {
    return { ok: false, requiresPr: true, message: 'Code/content fix — land it as a PR, then call markApplied with the PR ref.' };
  }

  try {
    await writeDbField(supabaseAdmin, fix);
  } catch (e) {
    if (e.code === 'NOT_CONFIGURED' || e.code === 'NO_VALUE') return { ok: false, requiresConfig: true, message: e.message };
    throw e;
  }
  const patch = { applied_at: new Date().toISOString(), applied_by: adminId || null, rollback: { field: fix.field, old_value: fix.old_value } };
  return finishWithRetest(supabaseAdmin, fix, patch);
}

// A code/content fix already merged via PR — record it + re-test to confirm.
async function markApplied(id, { ref, adminId } = {}) {
  const { supabaseAdmin } = require('../../../config/supabase');
  const { getFix } = require('../seoFixService');
  const fix = await getFix(id);
  if (!fix) throw new Error('Fix not found');
  if (fix.status !== 'approved') return { ok: false, reason: `status is ${fix.status}, not approved` };
  const patch = { applied_at: new Date().toISOString(), applied_by: adminId || null, rollback: { pr: ref || null } };
  return finishWithRetest(supabaseAdmin, fix, patch);
}

// Reverse an applied fix. db_field → restore old_value; code/content → mark
// rolled_back and surface that the PR must be reverted (server can't revert code).
async function rollbackFix(id, { adminId } = {}) {
  const { supabaseAdmin } = require('../../../config/supabase');
  const { getFix } = require('../seoFixService');
  const fix = await getFix(id);
  if (!fix) throw new Error('Fix not found');
  if (fix.status !== 'applied' && fix.status !== 'failed') return { ok: false, reason: `status is ${fix.status}, not applied` };

  let note = null;
  if (fix.target === 'db_field') {
    if (isDryRun()) return { ok: false, dryRun: true };
    const key = `${fix.page_type}:${fix.field}`;
    const map = FIELD_MAP[key];
    if (map && ENABLED.has(key)) {
      const slug = fix.url.replace(/\/$/, '').split('/').pop();
      const { error } = await supabaseAdmin.from(map.table).update({ [map.column]: fix.old_value }).eq(map.matchColumn || 'slug', slug);
      if (error) throw error;
    }
  } else {
    note = 'Code/content fix — revert the PR manually to fully roll back.';
  }
  const { data, error } = await supabaseAdmin.from('seo_fixes')
    .update({ status: 'rolled_back', applied_by: adminId || fix.applied_by })
    .eq('id', id).select('*');
  if (error) throw error;
  return { ok: true, note, fix: (data && data[0]) || fix };
}

module.exports = { retest, applyFix, markApplied, rollbackFix, resolved, FIELD_MAP };
