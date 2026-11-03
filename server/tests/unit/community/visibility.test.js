const { canView, filterVisible } = require('../../../services/community/visibility');
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
