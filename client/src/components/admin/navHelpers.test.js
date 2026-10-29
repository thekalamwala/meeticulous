import { describe, it, expect } from 'vitest';
import {
  itemActive, formatBadge, leafBadge, rollupBadge, filterTree, resolveChain, activeArea,
} from './navHelpers';
import { NAV as REAL_NAV } from './adminNav';

// Fixture: a flat area + an area with a module (deep leaf). Exercises exact index
// routes, longest-prefix resolution, permission filtering and badge roll-up.
const NAV = [
  { key: 'home', label: 'Home', color: '#111', children: [
    { label: 'Dashboard', to: '/super-dashboard', exact: true, perm: 'ops.view' },
    { label: 'Revenue',   to: '/super-dashboard/revenue', perm: 'analytics.view' },
  ]},
  { key: 'money', label: 'Money', color: '#222', children: [
    { key: 'payments', label: 'Payments', children: [
      { label: 'Finance', to: '/admin/finance', exact: true, perm: 'finance.view' },
      { label: 'Ledger',  to: '/admin/finance/ledger', perm: 'finance.view' },
      { label: 'Payouts', to: '/admin/finance/payouts', perm: 'payouts.view', badge: 'pending_payouts' },
    ]},
  ]},
];

describe('itemActive', () => {
  it('exact leaf matches only the exact path', () => {
    expect(itemActive('/admin/finance', { to: '/admin/finance', exact: true })).toBe(true);
    expect(itemActive('/admin/finance/ledger', { to: '/admin/finance', exact: true })).toBe(false);
  });
  it('prefix leaf matches the path and its sub-paths', () => {
    expect(itemActive('/admin/bookings', { to: '/admin/bookings' })).toBe(true);
    expect(itemActive('/admin/bookings/abandoned', { to: '/admin/bookings' })).toBe(true);
  });
  it('a shared string prefix is not a sub-path', () => {
    expect(itemActive('/admin/finance-x', { to: '/admin/finance' })).toBe(false);
  });
  it('handles missing item/to', () => {
    expect(itemActive('/x', null)).toBe(false);
    expect(itemActive('/x', { label: 'no-to' })).toBe(false);
  });
});

describe('resolveChain', () => {
  it('resolves a flat leaf to [area]', () => {
    const { leaf, chain } = resolveChain('/super-dashboard/revenue', NAV);
    expect(leaf.label).toBe('Revenue');
    expect(chain.map(n => n.key)).toEqual(['home']);
  });
  it('resolves a deep leaf to [area, module], longest prefix wins', () => {
    const { leaf, chain } = resolveChain('/admin/finance/ledger', NAV);
    expect(leaf.label).toBe('Ledger');
    expect(chain.map(n => n.key)).toEqual(['money', 'payments']);
  });
  it('an exact index route resolves to its own leaf, not a sibling', () => {
    expect(resolveChain('/admin/finance', NAV).leaf.label).toBe('Finance');
  });
  it('unknown path resolves to nothing', () => {
    expect(resolveChain('/nowhere', NAV)).toEqual({ leaf: null, chain: [] });
  });

  // Restructure landmarks: URLs are unchanged, but regrouped under new areas/modules.
  it('maps real routes to their new top-level area', () => {
    const area = (p) => activeArea(p, REAL_NAV)?.key;
    expect(area('/admin/gst/invoices')).toBe('money');        // GST folded into Money
    expect(area('/admin/finance/ledger')).toBe('money');
    expect(area('/admin/sales/leads')).toBe('sales');         // Sales is its own area
    expect(area('/admin/campaigns')).toBe('marketing');       // Marketing is its own area
    expect(area('/admin/marketing/sequences')).toBe('marketing');
    expect(area('/admin/content/blogs')).toBe('content');     // Create → Content
    expect(area('/admin/platform/appearance')).toBe('system');
    expect(area('/admin/seo/services')).toBe('seo');
  });
  it('deep routes carry their module in the chain', () => {
    expect(resolveChain('/admin/gst/invoices', REAL_NAV).chain.map(n => n.key)).toEqual(['money', 'gst']);
    expect(resolveChain('/admin/marketing/sequences', REAL_NAV).chain.map(n => n.key)).toEqual(['marketing', 'campaigns']);
  });
});

describe('badges', () => {
  const counts = { pending_payouts: 3, pending_reviews: 0 };
  it('leafBadge reads a live count, 0 when unset or zero', () => {
    expect(leafBadge({ badge: 'pending_payouts' }, counts)).toBe(3);
    expect(leafBadge({ badge: 'pending_reviews' }, counts)).toBe(0);
    expect(leafBadge({ badge: 'missing' }, counts)).toBe(0);
    expect(leafBadge({}, counts)).toBe(0);
  });
  it('rollupBadge sums every descendant leaf', () => {
    expect(rollupBadge(NAV[1], counts)).toBe(3);              // Money → Payments → Payouts:3
    expect(rollupBadge(NAV[1].children[0], counts)).toBe(3);  // the Payments module
    expect(rollupBadge(NAV[0], counts)).toBe(0);
    expect(rollupBadge(null, counts)).toBe(0);
  });
  it('rollupBadge handles a missing counts map', () => {
    expect(rollupBadge(NAV[1], undefined)).toBe(0);
  });
  it('formatBadge formats overflow', () => {
    expect(formatBadge(0)).toBe('0');
    expect(formatBadge(99)).toBe('99');
    expect(formatBadge(100)).toBe('99+');
    expect(formatBadge(4210)).toBe('99+');
  });
});

describe('filterTree', () => {
  it('keeps only leaves the session may see, drops empty branches', () => {
    const vis = filterTree(NAV, { permissions: ['finance.view'] }); // no ops/analytics/payouts
    expect(vis.map(a => a.key)).toEqual(['money']);          // Home leaves all gated out
    expect(vis[0].children[0].children.map(l => l.label)).toEqual(['Finance', 'Ledger']); // Payouts gated
  });
  it('wildcard sees everything', () => {
    const vis = filterTree(NAV, { permissions: ['*'] });
    expect(vis.map(a => a.key)).toEqual(['home', 'money']);
    expect(vis[1].children[0].children).toHaveLength(3);
  });
  it('no session sees nothing', () => {
    expect(filterTree(NAV, null)).toEqual([]);
  });
  it('does not mutate the input tree', () => {
    const before = JSON.stringify(NAV);
    filterTree(NAV, { permissions: ['finance.view'] });
    expect(JSON.stringify(NAV)).toBe(before);
  });
});
