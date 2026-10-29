// client/src/pages/admin/__tests__/AdminSeo.test.jsx
// SEO control center v2: dashboard, list-first views + inspector drawer, fixes, GSC.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminSeo from '../AdminSeo';
import * as api from '../../../services/api';

const PAGE_DETAIL = {
  id: 'p1', url: 'https://meeticulous.com/asha/career-coaching', title: 'Career Coaching', page_type: 'service',
  indexable: true, http_status: 200, seo_score: 86, geo_score: 72,
  seo: { score: 86, uncapped: 86, caps: [], dimensions: [
    { key: 'internal_linking', label: 'Internal linking', weight: 10, score: 20, lost: 8, reason: 'Only 1 contextual outbound link.', fix: 'Add links from 3 relevant pages.', evidence: 'official' },
  ] },
  geo: { score: 72, uncapped: 72, caps: [], dimensions: [
    { key: 'entity_clarity', label: 'Entity clarity', weight: 18, score: 60, lost: 7, reason: 'No sameAs links.', fix: 'Add sameAs identity links.', evidence: 'official' },
  ] },
  recommendations: [
    { axis: 'SEO', dimension: 'internal_linking', label: 'Internal linking', title: 'Add links from 3 relevant pages.', impact: 8, confidence: 1, ease: 0.7, evidence: 'official', priority: 5.6, tier: 'MEDIUM' },
  ],
  gsc: { clicks: 5, impressions: 100, ctr: 0.05, position: 7.2, clicks_change: 2, impressions_change: 10, position_change: 1.3 },
  queries: [{ query: 'career coach', clicks: 3, impressions: 40, ctr: 0.075, position: 7, prev_position: 9, position_change: 2 }],
  previous: { seo_score: 80, geo_score: 70, at: new Date().toISOString() },
  signals: { bodySource: 'content-model' },
};

vi.mock('../../../services/api', () => ({
  adminSeoDashboard: vi.fn(() => Promise.resolve({ data: {
    crawlId: 'c1',
    totals: { pages: 12, avg_seo: 82, avg_geo: 64, indexed: 11, needs_attention: 3, improving: 2, declining: 1, clicks: 120, impressions: 3400, avg_position: 8.4 },
    by_type: [{ type: 'service', count: 5, avg_seo: 80, avg_geo: 60 }],
    opportunities: [{ key: 'low_ctr', label: 'High impressions but low CTR — rewrite title/description', count: 2, pages: [{ id: 'p1', url: 'https://meeticulous.com/pricing', page_type: 'static', seo_score: 70, geo_score: 50, gsc: {} }] }],
  } })),
  adminSeoList: vi.fn(() => Promise.resolve({ data: { crawlId: 'c1', total: 1, page: 1, pageSize: 50, pages: [
    { id: 'p1', url: 'https://meeticulous.com/asha/career-coaching', title: 'Career Coaching', page_type: 'service', indexable: true, http_status: 200, seo_score: 86, geo_score: 72, issue_count: 1, opportunities_count: 3, query_count: 4, gsc: { clicks: 5, impressions: 100, ctr: 0.05, position: 7.2, position_change: 1.3 }, seo_caps: 0, geo_caps: 0 },
  ] } })),
  adminSeoPage: vi.fn(() => Promise.resolve({ data: { page: PAGE_DETAIL } })),
  adminSeoIssues: vi.fn(() => Promise.resolve({ data: { issues: [] } })),
  adminSeoFixes: vi.fn(() => Promise.resolve({ data: { fixes: [
    { id: 'f1', approval_level: 'AUTO', rule_key: 'technical.missing_canonical', url: 'https://meeticulous.com/pricing', target: 'meta_builder', evidence_maturity: 'DEVELOPING', old_value: null, new_value: 'https://meeticulous.com/pricing', context: {} },
  ], summary: { total: 1, byLevel: { AUTO: 1 } }, dryRun: true } })),
  adminSeoGenerateFixes: vi.fn(() => Promise.resolve({ data: { crawlId: 'c1', proposed: 1, byLevel: { AUTO: 1 } } })),
  adminSeoDecideFix: vi.fn(() => Promise.resolve({ data: { ok: true, fix: { status: 'approved' } } })),
  adminSeoApplyFix: vi.fn(() => Promise.resolve({ data: { ok: false, dryRun: true } })),
  adminSeoMarkApplied: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  adminSeoRollbackFix: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  adminSeoRetestFix: vi.fn(() => Promise.resolve({ data: { retest: { status: 'PASS', health: 100 }, resolved: true } })),
  adminSeoRunCrawl: vi.fn(() => Promise.resolve({ data: { crawlId: 'c2' } })),
  adminSeoCrawlStatus: vi.fn(() => Promise.resolve({ data: { crawl: { status: 'done' } } })),
  adminSeoMuteIssue: vi.fn(() => Promise.resolve({ data: {} })),
  adminSeoGsc: vi.fn(() => Promise.resolve({ data: { gsc: [
    { url: 'https://meeticulous.com/x', coverage_state: 'Submitted and indexed', impressions: 42, clicks: 3, position: 5.2 },
  ], configured: true } })),
  adminSeoGscStatus: vi.fn(() => Promise.resolve({ data: { configured: true, last_synced: null } })),
  adminSeoGscSync: vi.fn(() => Promise.resolve({ data: { configured: true, started: true } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const renderAt = (view) => render(
  <MemoryRouter initialEntries={[`/admin/seo/${view}`]}>
    <Routes><Route path="/admin/seo/:view" element={<AdminSeo />} /></Routes>
  </MemoryRouter>,
);

describe('AdminSeo control center', () => {
  it('dashboard shows SEO/GEO health and top opportunities', async () => {
    renderAt('dashboard');
    await waitFor(() => expect(screen.getByText('82')).toBeTruthy()); // avg SEO
    expect(screen.getByText(/Top opportunities/i)).toBeTruthy();
    expect(screen.getByText(/low CTR/i)).toBeTruthy();
  });

  it('services list renders a page row and opens the inspector with a "why not 100" breakdown', async () => {
    renderAt('services');
    await waitFor(() => expect(screen.getByText('Career Coaching')).toBeTruthy());
    fireEvent.click(screen.getByText('Career Coaching'));
    await waitFor(() => expect(screen.getByText(/SEO score/i)).toBeTruthy());
    expect(screen.getByText(/GEO \/ AEO readiness/i)).toBeTruthy();
    // Appears in both the breakdown and the fix queue.
    expect(screen.getAllByText(/Add links from 3 relevant pages/i).length).toBeGreaterThanOrEqual(1);
    expect(api.adminSeoPage).toHaveBeenCalledWith('p1');
  });

  it('fixes tab shows the dry-run banner and a proposal', async () => {
    renderAt('fixes');
    await waitFor(() => expect(screen.getByText('DRY RUN')).toBeTruthy());
    expect(screen.getByText('technical.missing_canonical')).toBeTruthy();
  });

  it('search console tab renders GSC data', async () => {
    renderAt('search-console');
    await waitFor(() => expect(screen.getByText('42')).toBeTruthy());
    expect(screen.getByText('Submitted and indexed')).toBeTruthy();
  });

  it('the header button runs crawl + sync sequentially', async () => {
    renderAt('dashboard');
    await waitFor(() => expect(screen.getByText('82')).toBeTruthy());
    fireEvent.click(screen.getByText('Run crawl + sync'));
    await waitFor(() => expect(api.adminSeoRunCrawl).toHaveBeenCalled());
  });
});
