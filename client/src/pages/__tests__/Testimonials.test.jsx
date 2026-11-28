import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  getMyTestimonials: vi.fn(),
  createTestimonial: vi.fn(),
  updateTestimonial: vi.fn(),
  deleteTestimonial: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const auth = { user: { id: 'h1', plan: 'free' } };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

import * as api from '../../services/api';
import Testimonials from '../Testimonials';

const renderPage = () => render(<MemoryRouter><Testimonials /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'h1', plan: 'free' };
});

const rows = (n) => Array.from({ length: n }, (_, i) => ({
  id: `t${i}`, quote: `Quote ${i}`, author_name: `Author ${i}`, author_role: null, author_image_url: null,
}));

it('renders the host testimonials', async () => {
  api.getMyTestimonials.mockResolvedValue({ data: rows(2) });
  renderPage();
  expect(await screen.findByText(/Quote 0/)).toBeInTheDocument();
  expect(screen.getByText('Author 1')).toBeInTheDocument();
});

// Pricing v2 §4 item 6: testimonials are unlimited on every plan — no cap, no overlay.
it('a free host with many testimonials sees no upgrade overlay', async () => {
  api.getMyTestimonials.mockResolvedValue({ data: rows(12) });
  renderPage();
  await screen.findByText(/Quote 0/);
  await waitFor(() => expect(screen.queryByRole('link', { name: /upgrade to pro/i })).toBeNull());
});

it('does NOT show the upgrade overlay for a Pro host with 3 testimonials', async () => {
  auth.user = { id: 'h1', plan: 'premium' };
  api.getMyTestimonials.mockResolvedValue({ data: rows(3) });
  renderPage();
  await screen.findByText(/Quote 0/);
  await waitFor(() => expect(screen.queryByRole('link', { name: /upgrade to pro/i })).toBeNull());
});

it('shows the empty state when there are no testimonials', async () => {
  api.getMyTestimonials.mockResolvedValue({ data: [] });
  renderPage();
  expect(await screen.findByText(/no testimonials yet/i)).toBeInTheDocument();
});
