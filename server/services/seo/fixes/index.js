// server/services/seo/fixes/index.js
// Phase 2 proposal engine. Turns the latest crawl's issues into seo_fixes rows
// (status='proposed'). DRY_RUN default true — but note Phase 2 never touches live
// pages anyway; DRY_RUN gates the APPLY step (Phase 3). Proposals are the review
// queue, so they are always written. Schema-fallback safe: a missing seo_fixes
// table (pre-migration) degrades to a no-op instead of throwing.
// Only pure deps at import time. Everything that transitively eager-requires
// config/supabase (it throws when SUPABASE_SERVICE_ROLE_KEY is unset, see #868) —
// seoAuditService, jobLock, supabaseAdmin — is lazy-required inside the job, so
// importing this module for buildRow (pure) stays safe in tests.
const { planForRule, classify, CAPS, newCounters } = require('./planner');

const SOURCE = 'seo-fix-planner@1';
const DRY_RUN = (process.env.SEO_FIX_DRY_RUN || 'true') !== 'false'; // gates Phase 3 apply, exported for it

function buildRow(issue, page, siblings, counters) {
  const plan = planForRule(issue.rule_key);
  if (!plan) return null;
  const target = plan.target(page.page_type);
  const level = classify(issue, page, plan, counters, CAPS);
  const g = plan.gen(page, issue, siblings);
  const oldValue = plan.field === 'meta_description' ? (page.meta_description || null)
    : plan.field === 'canonical' ? (page.canonical || null)
    : plan.field === 'h1' ? ((page.h1 || [])[0] || null) : null;
  return {
    crawl_id: page.crawl_id, issue_id: issue.id || null, url: page.url,
    page_type: page.page_type, category: page.category, rule_key: issue.rule_key,
    target, field: plan.field, old_value: oldValue, new_value: g.newValue,
    diff: g.newValue != null ? { from: oldValue, to: g.newValue } : {},
    reason: g.reason, confidence: g.confidence, approval_level: level, status: 'proposed',
    evidence_maturity: page.evidence_maturity || null, context: g.context || {}, source: SOURCE,
    test_before: { status: page.status, health: page.health }, test_after: {}, rollback: {},
  };
}

async function generateProposals({ crawlId } = {}) {
  const { supabaseAdmin } = require('../../../config/supabase');
  const audit = require('../seoAuditService');
  const { runLocked } = require('../../../utils/jobLock');
  return runLocked('seo-fix-plan', async () => {
    const { crawlId: id, pages } = await audit.pageReports({ crawlId });
    if (!id) return { crawlId: null, proposed: 0, byLevel: {} };
    const pageByUrl = new Map(pages.map((p) => [p.url, p]));
    const byCategory = new Map();
    for (const p of pages) { if (!byCategory.has(p.category)) byCategory.set(p.category, []); byCategory.get(p.category).push(p); }

    const issues = await audit.listIssues({ crawlId: id, limit: 5000 });
    // Highest-priority issues first so blast-radius AUTO budget goes to what matters.
    issues.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

    const counters = newCounters();
    const rows = [];
    for (const iss of issues) {
      if (!planForRule(iss.rule_key)) continue;
      const page = pageByUrl.get(iss.affected_url);
      if (!page) continue;
      const siblings = (byCategory.get(page.category) || []).filter((s) => s.url !== page.url);
      const row = buildRow({ id: iss.id, rule_key: iss.rule_key, detail: iss.detail, evidence: iss.evidence, confidence: iss.confidence }, page, siblings, counters);
      if (row) rows.push(row);
    }

    const byLevel = {};
    for (const r of rows) byLevel[r.approval_level] = (byLevel[r.approval_level] || 0) + 1;

    if (rows.length) {
      try {
        const { error } = await supabaseAdmin.from('seo_fixes').upsert(rows, { onConflict: 'crawl_id,url,rule_key,field', ignoreDuplicates: false });
        if (error) {
          // 42P01 = undefined_table (migration not applied yet) → degrade to a no-op.
          if (error.code === '42P01') return { crawlId: id, proposed: 0, byLevel: {}, skipped: 'seo_fixes table missing' };
          throw error;
        }
      } catch (e) {
        if (e && e.code === '42P01') return { crawlId: id, proposed: 0, byLevel: {}, skipped: 'seo_fixes table missing' };
        throw e;
      }
    }
    return { crawlId: id, proposed: rows.length, byLevel };
  });
}

module.exports = { generateProposals, buildRow, DRY_RUN, SOURCE };
