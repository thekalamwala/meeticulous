// client/src/components/admin/__tests__/adminNav.test.js
import { describe, it, expect } from 'vitest';
import { NAV, IC, PATH_LABELS, flattenDestinations, flattenAllDestinations, sessionCan } from '../adminNav';

const SUPER = { permissions: ['*'] };

// Every leaf (has `to`) at any depth in the tree.
const leaves = (nav) => {
  const out = [];
  const walk = (n) => (n.children || []).forEach(c => (c.children ? walk(c) : c.to && out.push(c)));
  nav.forEach(walk);
  return out;
};
// Every branch (area or module).
const branches = (nav) => {
  const out = [];
  const walk = (nodes) => (nodes || []).forEach(n => { if (n.children) { out.push(n); walk(n.children); } });
  walk(nav);
  return out;
};

describe('adminNav tree', () => {
  it('has 10 or fewer priority-ordered top-level areas with a valid shape', () => {
    expect(NAV.length).toBeGreaterThan(0);
    expect(NAV.length).toBeLessThanOrEqual(10);
    NAV.forEach(area => {
      expect(area.key).toBeTruthy();
      expect(area.label).toBeTruthy();
      expect(IC[area.icon], `area "${area.key}" icon "${area.icon}" missing from IC`).toBeDefined();
      expect(area.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(Array.isArray(area.children)).toBe(true);
      expect(area.children.length).toBeGreaterThan(0);
    });
  });

  it('Sales and Marketing are distinct top-level areas', () => {
    const keys = NAV.map(a => a.key);
    expect(keys).toContain('sales');
    expect(keys).toContain('marketing');
  });

  it('every branch key is unique across the whole tree', () => {
    const keys = branches(NAV).map(b => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a node is either a branch or a leaf, never both', () => {
    leaves(NAV).forEach(l => expect(l.children, `leaf "${l.label}" must not have children`).toBeUndefined());
    branches(NAV).forEach(b => expect(b.to, `branch "${b.key}" must not have a route`).toBeUndefined());
  });

  it('every branch has a real IC icon', () => {
    branches(NAV).forEach(b => expect(IC[b.icon], `branch "${b.key}" icon "${b.icon}" missing`).toBeDefined());
  });

  it('every leaf has a route, a permission, and (when set) a real IC icon', () => {
    leaves(NAV).forEach(leaf => {
      expect(leaf.to).toMatch(/^\//);
      expect(typeof leaf.perm, `leaf "${leaf.label}" needs a perm`).toBe('string');
      if (leaf.icon) expect(IC[leaf.icon], `leaf "${leaf.label}" icon "${leaf.icon}" missing`).toBeDefined();
    });
  });

  it('no duplicate destination across the whole tree', () => {
    const tos = leaves(NAV).map(l => l.to);
    const dupes = tos.filter((t, i) => tos.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it('every path segment has a PATH_LABELS entry (breadcrumbs)', () => {
    const segs = new Set();
    leaves(NAV).forEach(l => l.to.split('/').filter(Boolean).forEach(s => segs.add(s)));
    [...segs].forEach(s => expect(PATH_LABELS[s], `missing PATH_LABELS entry for segment "${s}"`).toBeDefined());
  });

  it('no retired /admin/dept links remain', () => {
    leaves(NAV).forEach(l => expect(l.to.startsWith('/admin/dept')).toBe(false));
  });
});

describe('flattenDestinations', () => {
  it('returns permission-filtered, deduped leaves', () => {
    const dests = flattenDestinations(NAV, SUPER);
    expect(dests.length).toBeGreaterThan(0);
    dests.forEach(d => {
      expect(typeof d.to).toBe('string');
      expect(d.to.length).toBeGreaterThan(0);
      expect(d.section).toBeTruthy();
    });
    const tos = dests.map(d => d.to);
    expect(new Set(tos).size).toBe(tos.length); // deduped
  });

  it('tags a deep leaf with its top-level AREA label', () => {
    const dests = flattenDestinations(NAV, SUPER);
    expect(dests.find(d => d.to === '/admin/gst/invoices').section).toBe('Money');
  });

  it('flattenAllDestinations is the back-compat alias', () => {
    expect(flattenAllDestinations).toBe(flattenDestinations);
  });

  it('honours permissions', () => {
    const limited = { permissions: ['bookings.view'] };
    const dests = flattenDestinations(NAV, limited);
    expect(dests.find(d => d.to === '/admin/bookings')).toBeTruthy();
    expect(dests.find(d => d.to === '/admin/settings')).toBeUndefined();
  });
});

describe('sessionCan', () => {
  it('wildcard passes, missing perm fails, empty perm allows, no session fails', () => {
    expect(sessionCan({ permissions: ['*'] }, 'anything')).toBe(true);
    expect(sessionCan({ permissions: ['x'] }, 'y')).toBe(false);
    expect(sessionCan({ permissions: ['x'] }, null)).toBe(true);
    expect(sessionCan(null, 'x')).toBe(false);
  });
});
