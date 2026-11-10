import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

beforeEach(() => vi.clearAllMocks());

vi.mock('../../../services/communityApi', () => ({
  like: vi.fn(), unlike: vi.fn(), acceptTerms: vi.fn(),
}));
vi.mock('../../../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { COMMUNITY_LIKED: 'l', COMMUNITY_TERMS_ACCEPTED: 't' },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// Logged in: requireLogin passes, so the write runs and can hit the terms gate.
vi.mock('../useRequireLogin', () => ({ default: () => () => true }));

import toast from 'react-hot-toast';
import { like, acceptTerms } from '../../../services/communityApi';
import LikeButton from '../LikeButton';

const termsError = { response: { data: { code: 'COMMUNITY_TERMS_REQUIRED' } } };
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('LikeButton terms gate', () => {
  it('shows the house-rules dialog instead of a generic error when terms are unaccepted', async () => {
    like.mockRejectedValueOnce(termsError);
    wrap(<LikeButton targetType="item" id="i1" liked={false} count={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Like/ }));

    // The terms dialog appears; no scary "couldn't save" toast.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept and continue' })).toBeInTheDocument());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('retries the like once after the user accepts the terms', async () => {
    like.mockRejectedValueOnce(termsError).mockResolvedValueOnce({ ok: true });
    acceptTerms.mockResolvedValue({ ok: true });
    wrap(<LikeButton targetType="item" id="i1" liked={false} count={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Like/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and continue' }));

    await waitFor(() => expect(like).toHaveBeenCalledTimes(2));
    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
