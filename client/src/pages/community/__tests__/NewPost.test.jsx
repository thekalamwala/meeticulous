import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../../services/communityApi', () => ({
  getSpaces: vi.fn().mockResolvedValue({ spaces: [] }),
  getMe: vi.fn().mockResolvedValue({ member: null }),
  createItem: vi.fn(), acceptTerms: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ uploadImage: vi.fn() }));
vi.mock('../../../services/analytics', () => ({ analytics: { track: vi.fn() }, EVENTS: {} }));
const auth = { user: { id: 'u1', is_host: false, name: 'Pat' } };
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../components/common/Seo', () => ({ default: () => null }));

import NewPost from '../NewPost';

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/community/new" element={<NewPost />} />
      <Route path="/community" element={<div>Feed</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { auth.user = { id: 'u1', is_host: false, name: 'Pat' }; });

it('shows the New post heading and the composer', async () => {
  renderAt('/community/new');
  expect(screen.getByRole('heading', { name: 'New post' })).toBeInTheDocument();
  expect(await screen.findByLabelText(/on your mind/i)).toBeInTheDocument();
});

it('shows New thread when kind=thread', () => {
  renderAt('/community/new?kind=thread');
  expect(screen.getByRole('heading', { name: 'New thread' })).toBeInTheDocument();
});

it('redirects a signed-out visitor back to the feed', () => {
  auth.user = null;
  renderAt('/community/new');
  expect(screen.getByText('Feed')).toBeInTheDocument();
});
