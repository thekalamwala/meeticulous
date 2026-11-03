const { canView, filterVisible, canViewComment, filterVisibleComments } = require('../../../services/community/visibility');
const item = (o) => ({ status: 'visible', author_id: 'a1', ...o });
test('hidden: visible to author only', () => {
  expect(canView(item({ status: 'hidden' }), { viewerId: 'a1' })).toBe(true);
  expect(canView(item({ status: 'hidden' }), { viewerId: 'x' })).toBe(false);
  expect(canView(item({ status: 'hidden' }), {})).toBe(false);
});
test('removed/deleted visible to nobody', () => {
  expect(canView(item({ status: 'removed' }), { viewerId: 'a1' })).toBe(false);
  expect(canView(item({ status: 'deleted' }), { viewerId: 'a1' })).toBe(false);
});
test('banned author and blocked pairs', () => {
  expect(canView(item(), { bannedAuthorIds: new Set(['a1']) })).toBe(false);
  expect(canView(item(), { viewerId: 'v', blockedPairs: new Set(['v:a1']) })).toBe(false);
  expect(canView(item(), { viewerId: 'v', blockedPairs: new Set(['a1:v']) })).toBe(false);
  expect(canView(item(), { viewerId: 'v' })).toBe(true);
});
test('deleted-account author (null) is visible', () => {
  expect(canView(item({ author_id: null }), {})).toBe(true);
});
test('filterVisible', () => {
  expect(filterVisible([item(), item({ status: 'removed' })], {})).toHaveLength(1);
});
test('comment tombstones visible to anyone; body blanked', () => {
  const { serializeComment } = require('../../../services/community/serialize');
  for (const status of ['deleted', 'removed']) {
    const c = { id: 'c', post_id: 'p', body: 'secret', status, author_id: 'a1' };
    expect(canViewComment(c, {})).toBe(true);
    expect(serializeComment(c, {}).body).toBe('');
  }
});
test('hidden comment only to author; banned author hidden', () => {
  const c = item({ status: 'hidden' });
  expect(canViewComment(c, { viewerId: 'a1' })).toBe(true);
  expect(canViewComment(c, { viewerId: 'x' })).toBe(false);
  expect(canViewComment(item(), { bannedAuthorIds: new Set(['a1']) })).toBe(false);
  expect(filterVisibleComments([item(), item({ status: 'deleted' }), c], {})).toHaveLength(2);
});
