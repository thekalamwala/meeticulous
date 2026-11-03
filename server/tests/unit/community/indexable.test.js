const { computeIndexable } = require('../../../services/community/indexable');
const b = (n) => 'a'.repeat(n);
const base = { status: 'visible', kind: 'thread', format: 'text', body: '', otherVisibleReplies: 0, visibleReplies: 0 };
test.each([
  [{ body: b(200) }, true],
  [{ body: b(50) }, false],
  [{ body: b(50), otherVisibleReplies: 1 }, true],
  [{ kind: 'post', body: b(139), visibleReplies: 1 }, false],
  [{ kind: 'post', body: b(139), visibleReplies: 2 }, true],
  [{ kind: 'post', body: b(140) }, true],
  [{ kind: 'post', format: 'announcement', body: 'x' }, true],
  [{ kind: 'post', format: 'slot_drop', body: 'x' }, true],
  [{ kind: 'post', format: 'question', body: 'x' }, false],
  [{ kind: 'post', format: 'question', body: 'x', accepted_comment_id: 'c' }, true],
  [{ status: 'removed', body: b(500) }, false],
  [{ status: 'hidden', body: b(500) }, false],
  [{ body: b(500), authorBanned: true }, false],
  [{ kind: 'post', format: 'announcement', authorBanned: true }, false],
])('%j -> %s', (o, want) => expect(computeIndexable({ ...base, ...o })).toBe(want));
