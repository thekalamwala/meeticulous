// server/tests/unit/seoFixes.test.js — Phase 2 proposal planner/generators.
const { buildRow } = require('../../services/seo/fixes');
const { classify, planForRule, newCounters } = require('../../services/seo/fixes/planner');
const gen = require('../../services/seo/fixes/generators');

const page = (over = {}) => ({
  crawl_id: 'c1', url: 'https://bookasloth.com/pricing', page_type: 'static', category: 'Static',
  meta_description: null, canonical: null, h1: ['Pricing'], raw_signals: { images: [] },
  evidence_maturity: 'DEVELOPING', status: 'WARNING', health: 80, ...over,
});
const issue = (rule, over = {}) => ({ id: 'i1', rule_key: rule, detail: null, evidence: {}, confidence: 0.9, ...over });

describe('generators', () => {
  test('canonical is the self URL', () => {
    expect(gen.canonical(page()).newValue).toBe('https://bookasloth.com/pricing');
  });
  test('description proposes NO text (context pack only)', () => {
    const g = gen.description(page());
    expect(g.newValue).toBeNull();
    expect(g.context.entity).toBe('pricing');
  });
  test('advisory carries recommendations, never a value', () => {
    const g = gen.advisory(page(), issue('content.potential_cannibalization'));
    expect(g.newValue).toBeNull();
    expect(g.context.recommendations).toContain('differentiate');
  });
});

describe('buildRow', () => {
  test('missing_canonical on a static page is an AUTO meta_builder fix with a diff', () => {
    const row = buildRow(issue('technical.missing_canonical'), page(), [], newCounters());
    expect(row.approval_level).toBe('AUTO');
    expect(row.target).toBe('meta_builder');
    expect(row.new_value).toBe('https://bookasloth.com/pricing');
    expect(row.diff).toEqual({ from: null, to: 'https://bookasloth.com/pricing' });
    expect(row.test_before).toEqual({ status: 'WARNING', health: 80 });
  });
  test('missing_canonical on a host page is demoted to REVIEW (UGC) + prerender target', () => {
    const row = buildRow(issue('technical.missing_canonical'), page({ page_type: 'host', category: 'Profiles', url: 'https://bookasloth.com/jane' }), [], newCounters());
    expect(row.target).toBe('prerender');
    expect(row.approval_level).toBe('REVIEW');
  });
  test('cannibalization is DO_NOT and advisory-only', () => {
    const row = buildRow(issue('content.potential_cannibalization'), page(), [], newCounters());
    expect(row.approval_level).toBe('DO_NOT');
    expect(row.new_value).toBeNull();
  });
  test('a legal URL forces REVIEW even for an AUTO rule', () => {
    const row = buildRow(issue('technical.missing_canonical'), page({ url: 'https://bookasloth.com/terms' }), [], newCounters());
    expect(row.approval_level).toBe('REVIEW');
  });
  test('an unmapped rule yields no proposal', () => {
    expect(buildRow(issue('technical.slow_response'), page(), [], newCounters())).toBeNull();
  });
});

describe('blast radius (classify)', () => {
  test('AUTO fixes past the per-rule cap fall to REVIEW', () => {
    const caps = { total: 100, urls: 100, perRule: 2, perCategory: 100 };
    const counters = newCounters();
    const plan = planForRule('technical.missing_canonical');
    const levels = [];
    for (let i = 0; i < 4; i++) {
      const p = page({ url: `https://bookasloth.com/p${i}` });
      levels.push(classify(issue('technical.missing_canonical'), p, plan, counters, caps));
    }
    expect(levels).toEqual(['AUTO', 'AUTO', 'REVIEW', 'REVIEW']);
  });
});
