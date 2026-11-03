/**
 * tests/SubmitReview.test.jsx
 * /submit-review — signed-in hosts/guests review Meeticulous itself.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getMyPlatformReview:  vi.fn(),
  saveMyPlatformReview: vi.fn(),
}));
let mockAuth = { user: null, loading: false };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

import { getMyPlatformReview, saveMyPlatformReview } from '../services/api';
import SubmitReview from '../pages/SubmitReview';

const renderPage = () => render(<MemoryRouter><SubmitReview /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth = { user: null, loading: false };
});

test('signed out: offers host (Google) and guest (WhatsApp) sign-in, no form', () => {
  renderPage();
  expect(screen.getByRole('button', { name: /host.*google/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /guest.*whatsapp/i })).toHaveAttribute('href', '/login?redirect=%2Fsubmit-review');
  expect(screen.queryByRole('button', { name: /submit my review/i })).not.toBeInTheDocument();
  expect(getMyPlatformReview).not.toHaveBeenCalled();
});

test('signed in: consent is unticked by default and is sent as chosen', async () => {
  mockAuth = { user: { id: 'u1' }, loading: false };
  getMyPlatformReview.mockResolvedValue({ data: null });
  saveMyPlatformReview.mockResolvedValue({ data: { id: 'p1', status: 'pending', consent_public: true } });
  renderPage();

  const consent = await screen.findByRole('checkbox');
  expect(consent.checked).toBe(false);

  await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
  await userEvent.type(screen.getByPlaceholderText(/what has meeticulous changed/i), 'Saves me hours every week');
  await userEvent.click(consent);
  await userEvent.click(screen.getByRole('button', { name: /submit my review/i }));

  await waitFor(() => expect(saveMyPlatformReview).toHaveBeenCalledWith({
    rating: 5, title: '', body: 'Saves me hours every week', consent_public: true,
  }));
  expect(await screen.findByText(/once it's approved/i)).toBeInTheDocument();
});
