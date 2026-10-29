// client/src/components/admin/navHelpers.js
// Pure nav resolution helpers for the 3-level stacked sidebar — no React, no DOM.
// Unit-tested in navHelpers.test.js. Consumed by StackSidebar + AdminLayout.
//
// Tree shape (see adminNav.js NAV): AREA → (MODULE →)? LEAF.
//   branch = has `children`; leaf = has `to`. A leaf is identified by its `to`.

import { sessionCan } from './adminNav';

// Is a single leaf the active one for this path?
// `exact` leaves highlight only on an exact match (module index routes that are a
// prefix of their siblings, e.g. /admin/finance vs /admin/finance/ledger). Others
// match the exact path or any sub-path (/admin/bookings → /admin/bookings/abandoned).
// The trailing "/" guard stops /admin/finance-x matching /admin/finance.
export const itemActive = (pathname, item) => {
  if (!item || !item.to) return false;
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + '/');
};

// Overflow-safe display for a badge pill/dot.
export const formatBadge = (n) => (n > 99 ? '99+' : String(n));

// Live count for one leaf's badge, from the ops-summary counts map. 0 if unset.
export const leafBadge = (leaf, counts) => {
  const n = leaf && leaf.badge ? counts?.[leaf.badge] : 0;
  return n > 0 ? n : 0;
};

// Attention count under any node = sum of every descendant leaf's badge. Drives
// the roll-up dot on a module and its area.
export const rollupBadge = (node, counts) => {
  if (!node) return 0;
  if (node.badge) return leafBadge(node, counts);
  return (node.children || []).reduce((sum, c) => sum + rollupBadge(c, counts), 0);
};

// Recursively drop leaves the session may not see; drop branches left empty. The
// result is a tree of the same shape holding only what this admin can reach — so
// an area/module with zero visible descendants disappears entirely (no empty panel).
export const filterTree = (nav, session) =>
  (nav || [])
    .map(node => {
      if (node.to) return sessionCan(session, node.perm) ? node : null;   // leaf
      const kids = filterTree(node.children, session);                    // branch
      return kids.length ? { ...node, children: kids } : null;
    })
    .filter(Boolean);

// Resolve a pathname to its active leaf + the branch chain that leads to it.
// Longest-matching `to` wins (a deep leaf beats a shorter sibling index), mirroring
// the old activeSection resolution. Returns { leaf, chain } where `chain` is the
// ordered list of BRANCH ancestors to open in the stack ([area] or [area, module]),
// excluding the leaf itself. { leaf:null, chain:[] } for an unmatched path.
export const resolveChain = (pathname, nav) => {
  let leaf = null, bestLen = -1, chain = [];
  const walk = (node, trail) => {
    (node.children || []).forEach(child => {
      if (child.to) {
        const match = pathname === child.to || pathname.startsWith(child.to + '/');
        if (match && child.to.length > bestLen) { leaf = child; bestLen = child.to.length; chain = trail; }
      } else if (child.children) {
        walk(child, trail.concat(child));
      }
    });
  };
  (nav || []).forEach(area => walk(area, [area]));
  return { leaf, chain };
};

// The top-level area that owns a path (first element of the resolved chain), or
// null. Kept as a thin convenience for breadcrumb/active-area needs.
export const activeArea = (pathname, nav) => resolveChain(pathname, nav).chain[0] || null;
