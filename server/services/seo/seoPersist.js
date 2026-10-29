// server/services/seo/seoPersist.js
// Persists one crawl's results to Supabase (seo_crawls/seo_crawl_pages/seo_issues/
// seo_score_snapshots, mute-aware via seo_issue_mutes). No I/O beyond supabaseAdmin.
const { supabaseAdmin } = require('../../config/supabase');

async function createCrawl({ trigger, triggeredBy }) {
  const { data, error } = await supabaseAdmin
    .from('seo_crawls')
    .insert({ status: 'running', trigger, triggered_by: triggeredBy })
    .select('id');
  if (error) throw error;
  return data[0].id;
}

async function finishCrawl(id, { status, counts, error: crawlError } = {}) {
  const patch = { status, finished_at: new Date().toISOString() };
  if (counts) {
    if (counts.url_count != null) patch.url_count = counts.url_count;
    if (counts.page_count != null) patch.page_count = counts.page_count;
    if (counts.issue_count != null) patch.issue_count = counts.issue_count;
  }
  if (crawlError != null) patch.error = crawlError;
  const { error } = await supabaseAdmin.from('seo_crawls').update(patch).eq('id', id);
  if (error) throw error;
}

// A muted issue matches on rule_key, and either the mute is rule-wide
// (url_pattern null) or it names this exact affected URL.
function isMuted(issue, mutes) {
  return mutes.some((m) => m.rule_key === issue.ruleKey && (m.url_pattern == null || m.url_pattern === issue.affectedUrl));
}

async function saveResults(crawlId, pages, issues, scores) {
  const { data: mutes, error: muteError } = await supabaseAdmin.from('seo_issue_mutes').select('rule_key,url_pattern');
  if (muteError) throw muteError;

  const pageRows = pages.map((p) => ({
    crawl_id: crawlId,
    url: p.url,
    page_type: p.pageType,
    http_status: p.httpStatus,
    final_url: p.finalUrl,
    redirect_chain: p.redirectChain,
    response_ms: p.responseMs,
    title: p.title,
    meta_description: p.metaDescription,
    canonical: p.canonical,
    robots: p.robots,
    h1: p.h1,
    word_count: p.wordCount,
    indexable: p.indexable,
    in_sitemap: p.inSitemap,
    raw_signals: {
      headings: p.headings, links: p.links, images: p.images,
      jsonLd: p.jsonLd, viewport: p.viewport, fetchError: p.fetchError,
      // DB-derived content model for host/service pages (null for body-crawled
      // static/blog, which carry real parsed signals above). Read by the v2 scorer.
      contentModel: p.contentModel || null,
      // Truncated body text (body-crawled pages only) for GEO evidence detection
      // (statistics/quotes/citations). Capped so raw_signals stays small.
      bodyText: p.bodyText ? String(p.bodyText).slice(0, 4000) : null,
    },
  }));
  const { data: savedPages, error: pagesError } = await supabaseAdmin
    .from('seo_crawl_pages').insert(pageRows).select('id,url');
  if (pagesError) throw pagesError;
  const pageIdByUrl = new Map(savedPages.map((row) => [row.url, row.id]));

  const issueRows = issues
    .filter((issue) => !isMuted(issue, mutes))
    .map((issue) => ({
      crawl_id: crawlId,
      page_id: pageIdByUrl.get(issue.affectedUrl) || null,
      rule_key: issue.ruleKey,
      category: issue.category,
      severity: issue.severity,
      priority_score: issue.priorityScore,
      confidence: issue.confidence,
      title: issue.title,
      detail: issue.detail,
      evidence: issue.evidence,
      affected_url: issue.affectedUrl,
      auto_fixable: issue.autoFixable,
      first_seen_crawl_id: crawlId,
    }));
  const { error: issuesError } = await supabaseAdmin.from('seo_issues').insert(issueRows).select('id');
  if (issuesError) throw issuesError;

  const { overall, technical, onpage, content, indexability, internal_linking, breakdown } = scores;
  const { error: snapshotError } = await supabaseAdmin
    .from('seo_score_snapshots')
    .insert({ crawl_id: crawlId, overall, technical, onpage, content, indexability, internal_linking, breakdown })
    .select('id');
  if (snapshotError) throw snapshotError;
}

module.exports = { createCrawl, finishCrawl, saveResults };
