'use strict';
// Spec §7.5. Recompute on every write that can change it.

const ALWAYS_INDEXABLE = ['slot_drop', 'service', 'announcement'];

function computeIndexable({ status, kind, format, body, accepted_comment_id, authorBanned, otherVisibleReplies = 0, visibleReplies = 0 }) {
  if (status !== 'visible' || authorBanned) return false;
  const len = String(body ?? '').length;
  if (kind === 'thread') return len >= 200 || otherVisibleReplies >= 1;
  if (ALWAYS_INDEXABLE.includes(format)) return true;
  if (format === 'question' && accepted_comment_id) return true;
  return len >= 140 || visibleReplies >= 2;
}

module.exports = { computeIndexable };
