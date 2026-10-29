import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../services/api', () => ({ getBlogs: vi.fn() }));
vi.mock('../../components/common/Seo', () => ({ default: () => null }));

import { getBlogs } from '../../services/api';
import Blog from '../Blog';

// 22 posts — enough to fill page 1 (13) and leave a short page 2 (9).
const POSTS = Array.from({ length: 22 }, (_, i) => ({
  slug: `post-${i + 1}`,
  title: `Post ${i + 1}`,
  excerpt: 'Excerpt.',
  category: 'News',
  author: 'Shubham N Datarkar',
  date: 'JUL 15, 2026',
  readMins: 5,
  image: null,
  icons: [],
}));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog" element={<Blog />} />
      </Routes>
    </MemoryRouter>
  );

// Post cards only — the pager and the footer CTA are links too. Waits for the
// cards themselves: the CTA renders during the loading skeleton, so a plain
// findAllByRole('link') resolves before a single post has arrived.
const postCards = async () => {
  let cards = [];
  await waitFor(() => {
    cards = screen
      .getAllByRole('link')
      .filter((a) => /^\/blog\/[^/]+$/.test(a.getAttribute('href') || ''));
    expect(cards.length).toBeGreaterThan(0);
  });
  return cards;
};

describe('Blog index paging', () => {
  beforeEach(() => {
    getBlogs.mockResolvedValue({ data: { posts: POSTS } });
  });

  it('puts 13 posts on page 1 (1 featured + 12 in the grid)', async () => {
    renderAt('/blog');
    expect(await postCards()).toHaveLength(13);
  });

  it('carries the remainder onto page 2', async () => {
    renderAt('/blog?page=2');
    const cards = await postCards();
    expect(cards).toHaveLength(9);
    expect(cards[0]).toHaveAttribute('href', '/blog/post-14');
  });

  it('clamps an out-of-range page to the last one', async () => {
    renderAt('/blog?page=99');
    expect(await postCards()).toHaveLength(9);
  });

  it.each(['/blog?page=0', '/blog?page=-3', '/blog?page=abc', '/blog?page='])(
    'falls back to page 1 for %s',
    async (path) => {
      renderAt(path);
      expect(await postCards()).toHaveLength(13);
    }
  );

  it('hides the pager when every post fits on one page', async () => {
    getBlogs.mockResolvedValue({ data: { posts: POSTS.slice(0, 5) } });
    renderAt('/blog');
    expect(await postCards()).toHaveLength(5);
    expect(screen.queryByRole('navigation', { name: /blog pages/i })).toBeNull();
  });

  it('bylines each card with the post author', async () => {
    renderAt('/blog');
    expect(await screen.findAllByText('Shubham N Datarkar')).toHaveLength(13);
  });
});
