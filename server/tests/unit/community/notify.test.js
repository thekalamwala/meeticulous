// Fake supabase: from(table) -> thenable chain resolving to {data: tables[table]} (filters ignored).
const mockTables = {};
jest.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: (t) => {
      const c = {};
      for (const m of ['select', 'in', 'eq', 'maybeSingle']) c[m] = jest.fn(() => c);
      c.then = (res, rej) => Promise.resolve({ data: mockTables[t] ?? [], error: null }).then(res, rej);
      c.calls = t;
      return c;
    },
  },
}));
jest.mock('../../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));
jest.mock('../../../services/notificationEngine', () => ({ send: jest.fn(async () => ({})) }));

const { inAppNotify } = require('../../../utils/inAppNotify');
const engine = require('../../../services/notificationEngine');
const { onComment, onMentions, onRemoved } = require('../../../services/community/notify');

const prof = (id, o = {}) => ({ id, is_host: false, is_banned: false, first_name: id.toUpperCase(), name: null, username: id, email: `${id.toLowerCase()}@x.com`, ...o });
const item = { id: 'P1', slug: 's', kind: 'thread', title: 'Hello world', body: 'b', author_id: 'B' };
const comment = { id: 'C1', post_id: 'P1', parent_id: null, author_id: 'A', body: 'nice' };
const setup = ({ profiles, members = [], comments = [] }) => {
  mockTables.profiles = profiles; mockTables.community_members = members; mockTables.community_comments = comments;
  mockTables.in_app_notifications = [];
};
beforeEach(() => { jest.clearAllMocks(); });

test('reply: in-app + email for item author', async () => {
  setup({ profiles: [prof('A'), prof('B')] });
  await onComment({ item, comment, actorId: 'A' });
  expect(inAppNotify).toHaveBeenCalledTimes(1);
  const a = inAppNotify.mock.calls[0][0];
  expect(a.userId).toBe('B');
  expect(a.role).toBe('guest');
  expect(a.dedupeKey).toMatch(/^community_reply:B:P1:\d{10}$/);
  expect(a.link).toBe('/community/t/s#c-C1');
  expect(engine.send).toHaveBeenCalledTimes(1);
  const s = engine.send.mock.calls[0][0];
  expect(s.event).toBe('COMMUNITY_REPLY');
  expect(s.data.email).toBe('b@x.com');
  expect(s.data.inApp).toBeUndefined();
  expect(JSON.stringify([a, s.data.emailData])).not.toMatch(/phone|@x\.com/);
});

test('self reply: nothing', async () => {
  setup({ profiles: [prof('B')] });
  await onComment({ item, comment: { ...comment, author_id: 'B' }, actorId: 'B' });
  expect(inAppNotify).not.toHaveBeenCalled();
  expect(engine.send).not.toHaveBeenCalled();
});

test('email_replies:false -> in-app only', async () => {
  setup({ profiles: [prof('A'), prof('B')], members: [{ user_id: 'B', email_replies: false }] });
  await onComment({ item, comment, actorId: 'A' });
  expect(inAppNotify).toHaveBeenCalledTimes(1);
  expect(engine.send).not.toHaveBeenCalled();
});

test('skips ai badge, banned and deleted authors', async () => {
  setup({ profiles: [prof('A'), prof('B', { is_banned: true })] });
  await onComment({ item, comment, actorId: 'A' });
  setup({ profiles: [prof('A'), prof('B')], members: [{ user_id: 'B', badge: 'ai' }] });
  await onComment({ item, comment, actorId: 'A' });
  await onComment({ item: { ...item, author_id: null }, comment, actorId: 'A' });
  expect(inAppNotify).not.toHaveBeenCalled();
});

test('host recipient gets role host; parent author also notified', async () => {
  setup({ profiles: [prof('A'), prof('B', { is_host: true }), prof('D')], comments: [{ id: 'PC', author_id: 'D' }] });
  await onComment({ item, comment: { ...comment, parent_id: 'PC' }, actorId: 'A' });
  const by = Object.fromEntries(inAppNotify.mock.calls.map(([c]) => [c.userId, c]));
  expect(by.B.role).toBe('host');
  expect(by.D.role).toBe('guest');
});

test('already-notified this hour: skipped', async () => {
  setup({ profiles: [prof('A'), prof('B')] });
  mockTables.in_app_notifications = [{ dedupe_key: `community_reply:B:P1:${new Date().toISOString().slice(0, 13).replace(/\D/g, '')}` }];
  await onComment({ item, comment, actorId: 'A' });
  expect(inAppNotify).not.toHaveBeenCalled();
  expect(engine.send).not.toHaveBeenCalled();
});

test('mentions: actor skipped, 2 in-app', async () => {
  setup({ profiles: [prof('a'), prof('b'), prof('actor')] });
  await onMentions({ item, comment: null, usernames: ['a', 'b', 'actor'], actorId: 'actor' });
  expect(inAppNotify).toHaveBeenCalledTimes(2);
  expect(inAppNotify.mock.calls[0][0].dedupeKey).toBe('community_mention:a:P1');
  expect(engine.send.mock.calls[0][0].event).toBe('COMMUNITY_MENTION');
});

test('mention of someone who gets the reply: reply wins', async () => {
  setup({ profiles: [prof('B'), prof('x')] });
  await onMentions({ item, comment, usernames: ['B', 'x'], actorId: 'A' });
  expect(inAppNotify.mock.calls.map(([c]) => c.userId)).toEqual(['x']);
  expect(inAppNotify.mock.calls[0][0].dedupeKey).toBe('community_mention:x:C1');
});

test('removed: always emails, dedupe by target', async () => {
  setup({ profiles: [prof('B')], members: [{ user_id: 'B', email_replies: false }] });
  await onRemoved({ targetType: 'post', item, comment: null });
  expect(inAppNotify.mock.calls[0][0].dedupeKey).toBe('community_removed:P1');
  expect(engine.send.mock.calls[0][0].event).toBe('COMMUNITY_CONTENT_REMOVED');
});

test('never rejects', async () => {
  setup({ profiles: [prof('A'), prof('B')] });
  inAppNotify.mockImplementation(() => { throw new Error('boom'); });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(onComment({ item, comment, actorId: 'A' })).resolves.toBeUndefined();
  expect(spy).toHaveBeenCalledWith('[community-notify]', 'boom');
  inAppNotify.mockReset(); spy.mockRestore();
});
