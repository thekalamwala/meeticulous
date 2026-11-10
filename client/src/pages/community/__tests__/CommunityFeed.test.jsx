import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../services/communityApi', () => ({
  getFeed: vi.fn(),
  getSpaces: vi.fn(),
  like: vi.fn(),
  unlike: vi.fn(),
}));
vi.mock('../../../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { COMMUNITY_VIEWED: 'community_viewed', COMMUNITY_LIKED: 'community_liked' },
}));
const auth = { user: null };
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));

import { getFeed, getSpaces, like } from '../../../services/communityApi';
import { analytics } from '../../../services/analytics';
import CommunityFeed from '../CommunityFeed';

const author = { id: 'u1', display_name: 'Asha', avatar_url: null, role: 'guest', badge: null, profile_url: null };
const item = (id, over = {}) => ({
  id, kind: 'post', format: 'text', slug: `s-${id}`, url: `/community/p/s-${id}`, title: null,
  body: `Body ${id}`, space: null, author, like_count: 5, comment_count: 1,
  created_at: '2026-11-01T10:00:00.000Z', edited_at: null, last_activity_at: '2026-11-01T10:00:00.000Z',
  is_pinned: false, status: 'visible', is_indexable: true, accepted_comment_id: null, media: [], viewer: { liked: false },
  ...over,
});

function LoginProbe() {
  const loc = useLocation();
  return <p>login page {loc.search}</p>;
}

const renderFeed = () => render(
  <MemoryRouter initialEntries={['/community']}>
    <Routes>
      <Route path="/community" element={<CommunityFeed />} />
      <Route path="/login" element={<LoginProbe />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  getSpaces.mockResolvedValue({ spaces: [] });
  getFeed.mockResolvedValue({ items: [item('a'), item('b')], next_cursor: null });
});

test('renders one ItemCard per feed item and tracks the view once', async () => {
  renderFeed();
  await waitFor(() => expect(screen.getAllByTestId('item-card')).toHaveLength(2));
  expect(getFeed).toHaveBeenCalledWith({ tab: 'everyone', cursor: null });
  await waitFor(() => expect(analytics.track).toHaveBeenCalledWith('community_viewed', { tab: 'everyone' }));
  // the view fires exactly once (the sidebar ad in the layout also tracks, so filter to this event)
  expect(analytics.track.mock.calls.filter((c) => c[0] === 'community_viewed')).toHaveLength(1);
});

test('like while logged out goes to login with a return path', async () => {
  renderFeed();
  const [btn] = await screen.findAllByRole('button', { name: /^like/i });
  await userEvent.click(btn);
  expect(await screen.findByText(/login page/)).toBeTruthy();
  expect(screen.getByText(/login page/).textContent).toContain('redirect=%2Fcommunity');
  expect(like).not.toHaveBeenCalled();
});

test('a like whose API call fails reverts the count', async () => {
  auth.user = { id: 'me', is_host: false };
  let reject;
  like.mockImplementation(() => new Promise((_, r) => { reject = r; }));
  renderFeed();
  const [btn] = await screen.findAllByRole('button', { name: /^like, 5 likes/i });
  await userEvent.click(btn);
  expect(btn.textContent).toContain('6');
  expect(btn.getAttribute('aria-pressed')).toBe('true');
  expect(like).toHaveBeenCalledWith('post', 'a');
  reject(new Error('boom'));
  await waitFor(() => expect(btn.textContent).toContain('5'));
  expect(btn.getAttribute('aria-pressed')).toBe('false');
});

test('a 404 from the community gate renders the NotFound page', async () => {
  getFeed.mockRejectedValue({ response: { status: 404 } });
  renderFeed();
  await waitFor(() => expect(screen.queryAllByTestId('item-card')).toHaveLength(0));
  expect(await screen.findByText(/pulled a vanishing act/)).toBeTruthy(); // ErrorPage 404 title
});
