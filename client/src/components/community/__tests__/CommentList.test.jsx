import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommentList from '../CommentList';

// The API returns author: null for deleted/removed replies (serialize.js); nothing may name them.
test('tombstones with author null render, and replies to them do not name anyone', () => {
  const author = { id: 'u2', display_name: 'Ravi', role: 'guest', badge: null, avatar_url: null, profile_url: null };
  const comments = [
    { id: 'c1', post_id: 'p', parent_id: null, body: '', author: null, like_count: 0, created_at: '2026-11-01T10:00:00Z', edited_at: null, status: 'deleted', viewer: { liked: false } },
    { id: 'c2', post_id: 'p', parent_id: 'c1', body: 'Still useful', author, like_count: 0, created_at: '2026-11-01T11:00:00Z', edited_at: null, status: 'visible', viewer: { liked: false } },
  ];
  render(<MemoryRouter><CommentList comments={comments} viewerId="u1" /></MemoryRouter>);
  expect(screen.getByText(/deleted by its author/i)).toBeInTheDocument();
  expect(screen.getByText('Still useful')).toBeInTheDocument();
  expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
});

// A removed reply with no visible child is dropped (not shown as a "[removed]" row), so the
// rendered rows match the visible comment_count in the heading. A tombstone WITH a visible
// child is kept so the child's thread context still reads.
test('a childless tombstone is dropped, but one with a visible child is kept', () => {
  const author = { id: 'u2', display_name: 'Ravi', role: 'guest', badge: null, avatar_url: null, profile_url: null };
  const comments = [
    // removed, no children -> dropped
    { id: 'c1', post_id: 'p', parent_id: null, body: '', author: null, like_count: 0, created_at: '2026-11-01T10:00:00Z', edited_at: null, status: 'removed', viewer: { liked: false } },
    // deleted, but c3 replies to it -> kept
    { id: 'c2', post_id: 'p', parent_id: null, body: '', author: null, like_count: 0, created_at: '2026-11-01T10:30:00Z', edited_at: null, status: 'deleted', viewer: { liked: false } },
    { id: 'c3', post_id: 'p', parent_id: 'c2', body: 'Replying under the deleted one', author, like_count: 0, created_at: '2026-11-01T11:00:00Z', edited_at: null, status: 'visible', viewer: { liked: false } },
  ];
  render(<MemoryRouter><CommentList comments={comments} viewerId="u1" /></MemoryRouter>);
  expect(screen.queryByText(/Removed by a moderator/i)).toBeNull();      // childless c1 gone
  expect(screen.getByText(/deleted by its author/i)).toBeInTheDocument(); // c2 kept (has child)
  expect(screen.getByText('Replying under the deleted one')).toBeInTheDocument();
});

// A still-saving optimistic reply has a temp id the server would 400 on; its action row
// (Like / Reply / Mark as answer / More) must stay hidden until onSettle swaps in the real row.
test('a pending reply shows its body but no action buttons', () => {
  const author = { id: 'u1', display_name: 'You', role: 'guest', badge: null, avatar_url: null, profile_url: null };
  const comments = [
    { id: 'temp-123', post_id: 'p', parent_id: null, body: 'Posting this', author, like_count: 0, created_at: '2026-11-01T11:00:00Z', edited_at: null, status: 'visible', viewer: { liked: false }, pending: true },
  ];
  render(<MemoryRouter><CommentList comments={comments} viewerId="u1" canAccept onReply={() => {}} onAccept={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Posting this')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mark as answer' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Like/ })).toBeNull();
});

// Nested threading: replies indent under their parent; past MAX_DEPTH (3) they flatten and
// show a "Replying to X" breadcrumb so a long chain can't run off a narrow screen.
test('a reply chain nests, and only the flattened (depth > 3) reply shows a breadcrumb', () => {
  const A = (id) => ({ id, display_name: `U${id}`, role: 'guest', badge: null, avatar_url: null, profile_url: null });
  const mk = (id, parent_id) => ({ id, post_id: 'p', parent_id, body: `body ${id}`, author: A(id), like_count: 0, created_at: '2026-11-01T10:00:00Z', edited_at: null, status: 'visible', viewer: { liked: false } });
  const comments = [mk('c1', null), mk('c2', 'c1'), mk('c3', 'c2'), mk('c4', 'c3'), mk('c5', 'c4')];
  const { container } = render(<MemoryRouter><CommentList comments={comments} viewerId="u1" /></MemoryRouter>);
  // every reply in the chain renders
  ['body c1', 'body c2', 'body c3', 'body c4', 'body c5'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  // exactly one breadcrumb — the flattened c5 (depth 4), pointing at its parent U4
  const crumbs = container.querySelectorAll('a[href="#c-c4"]');
  expect(crumbs).toHaveLength(1);
  expect(screen.getByText(/Replying to/)).toBeInTheDocument();
  // a nested-but-not-flattened reply (c2, depth 1) has NO breadcrumb to its parent
  expect(container.querySelector('a[href="#c-c1"]')).toBeNull();
});

test('the accepted answer is pinned first, even when it was posted later', () => {
  const A = (id) => ({ id, display_name: `U${id}`, role: 'guest', badge: null, avatar_url: null, profile_url: null });
  const mk = (id, t) => ({ id, post_id: 'p', parent_id: null, body: `body ${id}`, author: A(id), like_count: 0, created_at: t, edited_at: null, status: 'visible', viewer: { liked: false } });
  const comments = [mk('c1', '2026-11-01T10:00:00Z'), mk('c2', '2026-11-01T11:00:00Z')];
  const { container } = render(<MemoryRouter><CommentList comments={comments} acceptedId="c2" viewerId="u1" /></MemoryRouter>);
  const bodies = [...container.querySelectorAll('p')].map((p) => p.textContent);
  expect(bodies[0]).toBe('body c2'); // accepted pinned first
  expect(screen.getByText('Accepted answer')).toBeInTheDocument();
});
