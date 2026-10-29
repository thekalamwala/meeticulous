'use strict';
/**
 * seoAdminController.js — SEO Audit Engine admin API (read-only reporting +
 * an on-demand crawl trigger). Mirrors gstAdminController's shape: every
 * method is async(req,res) with try { … res.json(...) } catch (e) { safeError(res, e); }.
 * All numbers come from the v3.145 crawl tables via seoAuditService — this
 * controller does zero crawling/scoring itself.
 */
const { safeError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const crawler = require('../services/seo/seoCrawler');
const svc = require('../services/seo/seoAuditService');
const fixSvc = require('../services/seo/seoFixService');
const fixEngine = require('../services/seo/fixes');
const fixApply = require('../services/seo/fixes/apply');

// ── GET /admin/seo/overview ───────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const { crawl, scores, counts } = await svc.latestOverview();
    res.json({ crawl, scores, counts });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/issues ─────────────────────────────────────
const getIssues = async (req, res) => {
  try {
    const { crawlId, severity, category, status, limit } = req.query || {};
    const issues = await svc.listIssues({ crawlId, severity, category, status, limit });
    res.json({ issues });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/issues/:id ─────────────────────────────────
const getIssue = async (req, res) => {
  try {
    const issue = await svc.getIssue(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json({ issue });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/pages ──────────────────────────────────────
const getPages = async (req, res) => {
  try {
    const { crawlId, pageType, indexable, limit } = req.query || {};
    const filters = { crawlId, pageType, limit };
    if (indexable != null) filters.indexable = indexable === 'true';
    const pages = await svc.listPages(filters);
    res.json({ pages });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/pages/:id ───────────────────────────────────
const getPage = async (req, res) => {
  try {
    const page = await svc.getPage(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json({ page });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/categories ─────────────────────────────────
// Category → page rollups for the hierarchy view (Phase 1, spec §1d).
const getCategories = async (req, res) => {
  try {
    const { crawlId } = req.query || {};
    const { crawlId: id, rollups } = await svc.categoryRollups({ crawlId });
    res.json({ crawlId: id, rollups });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/reports ────────────────────────────────────
// Per-page report: each page + hard status, health, dimensions, evidence maturity.
const getReports = async (req, res) => {
  try {
    const { crawlId } = req.query || {};
    const { crawlId: id, pages } = await svc.pageReports({ crawlId });
    res.json({ crawlId: id, pages });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/list ───────────────────────────────────────
// List-first views (spec §2): services/profiles/blogs/pages via ?type=, with
// search/sort/filter/pagination. One code path powers every list.
const getList = async (req, res) => {
  try {
    const { crawlId, type, search, sort, dir, page, pageSize, indexable, status } = req.query || {};
    const filters = { crawlId, type, search, sort, dir, page, pageSize, status };
    if (indexable != null) filters.indexable = indexable === 'true';
    res.json(await svc.pageList(filters));
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/dashboard ──────────────────────────────────
// Decision-first overview (spec §13): SEO/GEO health, indexed, attention, trend,
// by-type breakdown and top opportunities.
const getDashboard = async (req, res) => {
  try {
    res.json(await svc.dashboard({ crawlId: req.query?.crawlId }));
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/opportunities ──────────────────────────────
const getOpportunities = async (req, res) => {
  try {
    res.json(await svc.opportunities({ crawlId: req.query?.crawlId }));
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/link-graph ─────────────────────────────────
// Internal-link network (nodes = crawled pages, edges = internal links) for the
// interactive graph view. Read-only, from the latest done crawl (or ?crawlId).
const getLinkGraph = async (req, res) => {
  try {
    res.json(await svc.linkGraph({ crawlId: req.query?.crawlId }));
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/changes ────────────────────────────────────
// "What changed since the previous crawl?" (Phase 1 historical baseline, §1h).
const getChanges = async (req, res) => {
  try {
    res.json(await svc.changedSincePrevious());
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/scores/history ─────────────────────────────
const getScoreHistory = async (req, res) => {
  try {
    const history = await svc.scoreHistory();
    res.json({ history });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/fixes ──────────────────────────────────────
// The fix queue (Phase 2). Proposals + a summary by level/status.
const getFixes = async (req, res) => {
  try {
    const { crawlId, status, approvalLevel, limit } = req.query || {};
    const [fixes, summary] = await Promise.all([
      fixSvc.listFixes({ crawlId, status, approvalLevel, limit }),
      fixSvc.fixSummary({ crawlId }),
    ]);
    res.json({ fixes, summary, dryRun: fixEngine.DRY_RUN });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/fixes/:id ──────────────────────────────────
const getFix = async (req, res) => {
  try {
    const fix = await fixSvc.getFix(req.params.id);
    if (!fix) return res.status(404).json({ message: 'Fix not found' });
    res.json({ fix });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/generate ────────────────────────────
// Regenerate proposals from the latest crawl. Writes seo_fixes rows only (no live
// change). No-ops gracefully if the v3.148 table isn't applied yet.
const postGenerateFixes = async (req, res) => {
  try {
    const result = await fixEngine.generateProposals({ crawlId: req.body?.crawlId });
    await audit(req, { action: 'SEO_FIXES_GENERATED', resource_type: 'seo_crawl', resource_id: result.crawlId, after: { proposed: result.proposed, byLevel: result.byLevel } });
    res.json(result);
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/:id/decide ──────────────────────────
// body: { decision: 'approve' | 'reject' }. Phase 2 staging only — approve queues
// the fix for Phase 3 apply; it does NOT publish anything.
const postDecideFix = async (req, res) => {
  try {
    const decision = req.body?.decision === 'approve' ? 'approve' : 'reject';
    const fix = await fixSvc.decideFix(req.params.id, { decision, adminId: req.admin?.id });
    await audit(req, { action: 'SEO_FIX_DECIDED', resource_type: 'seo_fix', resource_id: req.params.id, after: { decision, status: fix.status } });
    res.json({ ok: true, fix });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/:id/apply ───────────────────────────
// Phase 3. db_field fixes write directly (guarded); code/content fixes return
// requiresPr. Blocked by DRY_RUN. Re-tests after any write.
const postApplyFix = async (req, res) => {
  try {
    const result = await fixApply.applyFix(req.params.id, { adminId: req.admin?.id });
    if (result.ok) await audit(req, { action: 'SEO_FIX_APPLIED', resource_type: 'seo_fix', resource_id: req.params.id, after: { status: result.fix?.status, resolved: result.fix?.test_after?.resolved } });
    res.json(result);
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/:id/mark-applied ────────────────────
// A code/content fix landed via PR — record + re-test to confirm FIXED/FAILED.
const postMarkApplied = async (req, res) => {
  try {
    const result = await fixApply.markApplied(req.params.id, { ref: req.body?.ref, adminId: req.admin?.id });
    if (result.ok) await audit(req, { action: 'SEO_FIX_MARKED_APPLIED', resource_type: 'seo_fix', resource_id: req.params.id, after: { ref: req.body?.ref, resolved: result.fix?.test_after?.resolved } });
    res.json(result);
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/:id/rollback ────────────────────────
const postRollbackFix = async (req, res) => {
  try {
    const result = await fixApply.rollbackFix(req.params.id, { adminId: req.admin?.id });
    if (result.ok) await audit(req, { action: 'SEO_FIX_ROLLED_BACK', resource_type: 'seo_fix', resource_id: req.params.id, after: { note: result.note } });
    res.json(result);
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/fixes/:id/retest ──────────────────────────
// Re-crawl + re-score the fix's URL without applying anything.
const postRetestFix = async (req, res) => {
  try {
    const fix = await fixSvc.getFix(req.params.id);
    if (!fix) return res.status(404).json({ message: 'Fix not found' });
    const result = await fixApply.retest(fix.url, fix.page_type, false);
    res.json({ retest: result, resolved: fixApply.resolved(fix, result) });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/crawl ─────────────────────────────────────
// Kicks off a crawl in the background (seoCrawler.start resolves as soon as
// the crawl row exists — the crawl itself keeps running after this returns).
const postCrawl = async (req, res) => {
  try {
    const crawlId = await crawler.start({ trigger: 'manual', triggeredBy: req.admin.id });
    res.json({ crawlId });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/crawl/:id ───────────────────────────────────
const getCrawl = async (req, res) => {
  try {
    const crawl = await svc.getCrawl(req.params.id);
    if (!crawl) return res.status(404).json({ message: 'Crawl not found' });
    res.json({ crawl });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/issues/:id/mute ───────────────────────────
// body: { ruleType: 'rule' | 'url' } — 'rule' silences the rule everywhere,
// 'url' silences it only for this issue's affected URL.
const postMuteIssue = async (req, res) => {
  try {
    const mute = await svc.muteIssue(req.params.id, { ruleType: req.body?.ruleType, mutedBy: req.admin?.id });
    await audit(req, {
      action: 'SEO_ISSUE_MUTED', resource_type: 'seo_issue', resource_id: req.params.id,
      after: { rule_key: mute.rule_key, url_pattern: mute.url_pattern },
    });
    res.json({ ok: true, mute });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/gsc ─────────────────────────────────────────
const getGsc = async (req, res) => {
  try {
    const gsc = await svc.listGscUrls(req.query);
    const configured = require('../services/seo/gscClient').isConfigured();
    res.json({ gsc, configured });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/seo/gsc/status ──────────────────────────────────
// Newest last_synced + whether GSC is configured — lets the client confirm a sync
// actually landed (poll until last_synced advances).
const getGscStatus = async (req, res) => {
  try {
    const status = await svc.gscStatus();
    const configured = require('../services/seo/gscClient').isConfigured();
    res.json({ ...status, configured });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/seo/gsc/sync ────────────────────────────────────
// Manual trigger for the GSC sync (normally nightly-only). Fire-and-forget —
// gscSync.run() holds its own lock (gsc-sync-exec) so this can't overlap a
// concurrent run; we don't await it here, just kick it off and return.
const postGscSync = async (req, res) => {
  try {
    const configured = require('../services/seo/gscClient').isConfigured();
    if (!configured) return res.json({ configured: false, started: false });
    require('../services/seo/gscSync').run().catch((e) => console.error('[gsc-sync manual] error:', e.message));
    res.json({ configured: true, started: true });
  } catch (e) { safeError(res, e); }
};

module.exports = {
  getOverview, getIssues, getIssue, getPages, getPage,
  getList, getDashboard, getOpportunities, getLinkGraph,
  getCategories, getReports, getChanges,
  getFixes, getFix, postGenerateFixes, postDecideFix,
  postApplyFix, postMarkApplied, postRollbackFix, postRetestFix,
  getScoreHistory, postCrawl, getCrawl, postMuteIssue, getGsc, getGscStatus, postGscSync,
};
