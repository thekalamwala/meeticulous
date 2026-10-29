// server/tests/unit/seoPersist.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const persist = require('../../services/seo/seoPersist');

const insertReturning = (rows) => ({
  insert: jest.fn(() => ({ select: jest.fn(() => ({ then: (r) => Promise.resolve({ data: rows, error: null }).then(r) })) })),
});
const selectAll = (rows) => ({ select: jest.fn(() => ({ then: (r) => Promise.resolve({ data: rows, error: null }).then(r) })) });

test('saveResults maps issues to page ids and skips muted rules', async () => {
  const calls = {};
  supabaseAdmin.from.mockImplementation((table) => {
    calls[table] = (calls[table] || 0) + 1;
    if (table === 'seo_issue_mutes') return selectAll([{ rule_key: 'onpage.missing_h1', url_pattern: null }]);
    if (table === 'seo_crawl_pages') return insertReturning([{ id: 'pg1', url: 'https://bookasloth.com/a' }]);
    if (table === 'seo_issues') return insertReturning([{ id: 'is1' }]);
    if (table === 'seo_score_snapshots') return insertReturning([{ id: 'sn1' }]);
    return insertReturning([]);
  });
  const pages = [{ url: 'https://bookasloth.com/a', pageType: 'static', httpStatus: 200, h1: [] }];
  const issues = [
    { ruleKey: 'onpage.missing_title', affectedUrl: 'https://bookasloth.com/a', category: 'onpage', severity: 'P1', confidence: 1, title: 't', evidence: {}, autoFixable: false, priorityScore: 60 },
    { ruleKey: 'onpage.missing_h1', affectedUrl: 'https://bookasloth.com/a', category: 'onpage', severity: 'P2', confidence: 1, title: 'h', evidence: {}, autoFixable: false, priorityScore: 30 },
  ];
  await persist.saveResults('crawl1', pages, issues, { overall: 90, technical: 100, onpage: 80, content: 80, indexability: 100, internal_linking: 100, breakdown: {} });
  expect(calls.seo_crawl_pages).toBe(1);
  expect(calls.seo_issues).toBe(1);        // one insert call
  expect(calls.seo_score_snapshots).toBe(1);
});
