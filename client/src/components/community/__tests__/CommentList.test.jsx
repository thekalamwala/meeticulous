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
