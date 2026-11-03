const { serializeAuthor, serializeItem, serializeComment } = require('../../../services/community/serialize');
const guest = { id: 'g', first_name: '', last_name: 'K', phone: '9876543210', email: 'x@y.com', username: 'g1', is_host: false, is_banned: false, profile_image: null };
test('guest serializes to whitelisted keys, no PII', () => {
  const a = serializeAuthor(guest, null);
  expect(Object.keys(a).sort()).toEqual(['avatar_url', 'badge', 'display_name', 'id', 'profile_url', 'role']);
  expect(a.display_name).toBe('Member');
  expect(a.profile_url).toBeNull();
  const s = JSON.stringify(a);
  expect(s).not.toContain('9876543210');
  expect(s).not.toContain('x@y.com');
  expect(s).not.toContain('"K"');
});
test('host and badge', () => {
  const a = serializeAuthor({ id: 'h', name: ' Asha R ', username: 'asha', is_host: true, profile_image: 'i.png', phone: '1' }, { badge: 'official' });
  expect(a).toEqual({ id: 'h', display_name: 'Asha R', avatar_url: 'i.png', role: 'host', badge: 'official', profile_url: '/asha' });
});
test('null profile', () => {
  expect(serializeAuthor(null).display_name).toBe('Deleted account');
  expect(serializeAuthor(null).role).toBe('deleted');
});
const row = { id: 'p', kind: 'thread', format: 'text', slug: 's', title: 'T', body: 'B', like_count: 1, comment_count: 2, created_at: 'c', edited_at: null, last_activity_at: 'l', is_pinned: false, status: 'visible', is_indexable: true, accepted_comment_id: null, author_id: 'g', phone: 'leak' };
test('serializeItem', () => {
  const o = serializeItem(row, { author: guest, member: null, space: { key: 'k', name: 'N' }, media: [{ url: 'u', width: 1, height: 2, alt: 'a', position: 1, id: 'z' }, { url: 'u0', position: 0 }] });
  expect(o.url).toBe('/community/t/s');
  expect(o.viewer).toEqual({ liked: false });
  expect(o.media.map((m) => m.url)).toEqual(['u0', 'u']);
  expect(JSON.stringify(o)).not.toContain('leak');
  expect(serializeItem({ ...row, kind: 'post' }, {}).url).toBe('/community/p/s');
});
test('removed item blanked', () => {
  const o = serializeItem({ ...row, status: 'removed' }, { author: guest });
  expect(o.body).toBe('');
  expect(o.title).toBeNull();
});
test('serializeComment blanks deleted/removed', () => {
  const c = { id: 'c', post_id: 'p', parent_id: null, body: 'hi', like_count: 0, created_at: 'c', edited_at: null, status: 'deleted' };
  expect(serializeComment(c, { author: guest }).body).toBe('');
  expect(serializeComment({ ...c, status: 'visible' }, { author: guest }).body).toBe('hi');
});

test('serializeComment: tombstones expose no author', () => {
  const guest = { id: 'g1', is_host: false, first_name: 'Asha', name: 'Asha S', username: null };
  for (const status of ['deleted', 'removed']) {
    expect(serializeComment({ id: 'c', post_id: 'p', body: 'x', status }, { author: guest }).author).toBeNull();
  }
  expect(serializeComment({ id: 'c', post_id: 'p', body: 'x', status: 'visible' }, { author: guest }).author).toMatchObject({ id: 'g1' });
});
