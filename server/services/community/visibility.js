'use strict';
// Single gate for "who can see this post/comment". Pure; callers load the ban/block sets.

function canView(item, { viewerId = null, bannedAuthorIds = new Set(), blockedPairs = new Set() } = {}) {
  const a = item.author_id;
  if (a && bannedAuthorIds.has(a)) return false;
  if (a && viewerId && (blockedPairs.has(`${viewerId}:${a}`) || blockedPairs.has(`${a}:${viewerId}`))) return false;
  if (item.status === 'visible') return true;
  // hidden = pending admin review; the author still sees their own item
  return item.status === 'hidden' && !!viewerId && viewerId === a;
}

const filterVisible = (items, ctx) => items.filter((i) => canView(i, ctx));

module.exports = { canView, filterVisible };
