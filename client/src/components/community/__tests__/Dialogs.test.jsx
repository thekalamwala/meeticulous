import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/communityApi', () => ({ createComment: vi.fn(), report: vi.fn(), acceptTerms: vi.fn() }));
vi.mock('../../../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { COMMUNITY_REPLY_CREATED: 'r', COMMUNITY_REPORTED: 'rep', COMMUNITY_TERMS_ACCEPTED: 't' },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', is_host: false } }) }));

import toast from 'react-hot-toast';
import { createComment, report } from '../../../services/communityApi';
import CommentForm from '../CommentForm';
import ReportDialog from '../ReportDialog';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('CommentForm', () => {
  it('optimistically hands over a temp reply, then reconciles with the saved comment', async () => {
    const saved = { id: 'c2' };
    createComment.mockResolvedValue({ comment: saved });
    const onCreated = vi.fn();
    const onSettle = vi.fn();
    wrap(<CommentForm itemId="i1" parent={{ id: 'c1', author: { display_name: 'Meera' } }} onCreated={onCreated} onSettle={onSettle} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Your reply'), 'Thanks!');
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    // optimistic: the temp reply is handed to the page immediately with the typed body
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ body: 'Thanks!', parent_id: 'c1', pending: true }));
    expect(createComment).toHaveBeenCalledWith('i1', { body: 'Thanks!', parent_id: 'c1' });
    // then reconciled with the server copy
    await waitFor(() => expect(onSettle).toHaveBeenCalledWith(expect.any(String), saved));
  });
});

describe('ReportDialog', () => {
  it('needs a reason, then reports and thanks the user', async () => {
    report.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    wrap(<ReportDialog target={{ type: 'comment', id: 'c1' }} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/Harassment/));
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(report).toHaveBeenCalledWith({ target_type: 'comment', target_id: 'c1', reason: 'harassment' });
    expect(toast.success).toHaveBeenCalledWith("Thanks — we've got your report.");
  });
});
