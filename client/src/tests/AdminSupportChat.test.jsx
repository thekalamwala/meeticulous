import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import AdminSupportChat from '../pages/admin/AdminSupportChat';

// Realtime client — no-op channel that chains .on().subscribe().
vi.mock('../services/supabaseClient', () => ({
  getSupabase: vi.fn(() => Promise.resolve({
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: vi.fn(),
  })),
}));

vi.mock('../services/api', () => ({
  adminSupportQueue: vi.fn(() => Promise.resolve({ data: {
    threads: [{ id: 't1', reference: 'SUP-ABC123', status: 'waiting', participant_type: 'host', admin_unread: 2, last_message_at: '2026-08-25T10:00:00Z', subject: 'Payout is late' }],
  } })),
  adminGetSupportThread: vi.fn(() => Promise.resolve({ data: {
    thread: { id: 't1', reference: 'SUP-ABC123', status: 'waiting', participant_type: 'host' },
    messages: [{ id: 'm1', sender: 'user', sender_name: 'Riya', body: 'My payout is late', created_at: '2026-08-25T10:00:00Z' }],
  } })),
  adminReplySupport: vi.fn((id, { body }) => Promise.resolve({ data: { id: 'm2', sender: 'admin', sender_name: 'Support', body, created_at: '2026-08-25T10:01:00Z' } })),
  adminResolveSupport: vi.fn(() => Promise.resolve({ data: {} })),
  adminAssignSupport: vi.fn(() => Promise.resolve({ data: { thread: {} } })),
  adminSupportContext: vi.fn(() => Promise.resolve({ data: { context: { kind: 'guest', profile: {}, bookings: [], host: null } } })),
  adminListEscalations: vi.fn(() => Promise.resolve({ data: { escalations: [] } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import { adminReplySupport, adminResolveSupport } from '../services/api';

beforeAll(() => { window.HTMLElement.prototype.scrollIntoView = vi.fn(); });

const openThread = async () => {
  render(<AdminSupportChat />);
  await waitFor(() => expect(screen.getByText('Payout is late')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Payout is late')); // the queue card is one clickable button
  await waitFor(() => expect(screen.getByText('My payout is late')).toBeInTheDocument());
};

// A waiting thread shows no composer — the agent must claim it first, which flips
// the dock into the reply composer.
const claimThread = async () => {
  await openThread();
  fireEvent.click(screen.getByRole('button', { name: /assign to me/i }));
  await waitFor(() => expect(screen.getByLabelText('Reply')).toBeInTheDocument());
};

describe('AdminSupportChat', () => {
  it('lists queued threads with reference and unread badge', async () => {
    render(<AdminSupportChat />);
    await waitFor(() => expect(screen.getByText('SUP-ABC123')).toBeInTheDocument());
    expect(screen.getByText('2 new')).toBeInTheDocument();
  });

  it('opens a thread and shows its transcript', async () => {
    await openThread();
    expect(screen.getByText('Riya')).toBeInTheDocument();
  });

  it('shows the assign CTA (not a composer) while a thread is unassigned', async () => {
    await openThread();
    expect(screen.getByText(/take ownership of this conversation/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply')).not.toBeInTheDocument();
  });

  it('replies to the thread and appends the admin message', async () => {
    await claimThread();
    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'On it — checking now' } });
    fireEvent.click(screen.getByRole('button', { name: /^send/i }));
    await waitFor(() => expect(adminReplySupport).toHaveBeenCalledWith('t1', { body: 'On it — checking now' }));
    await waitFor(() => expect(screen.getByText('On it — checking now')).toBeInTheDocument());
  });

  it('auto-sends a quick reply on one click', async () => {
    await claimThread();
    fireEvent.click(screen.getByRole('button', { name: 'Thanks' }));
    await waitFor(() => expect(adminReplySupport).toHaveBeenCalledWith('t1', { body: expect.stringMatching(/thank you so much/i) }));
  });

  it('requires a reason before the thread can be resolved', async () => {
    await claimThread();
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i })); // opens the reason picker
    const confirm = screen.getByRole('button', { name: /resolve ticket/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'host_payout' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(adminResolveSupport).toHaveBeenCalledWith('t1', { reason_code: 'host_payout' }));
  });

  it('does not carry a picked reason over to the next opened thread', async () => {
    await claimThread();
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'host_payout' } });
    fireEvent.click(screen.getByRole('button', { name: /back to queue/i }));
    await waitFor(() => expect(screen.getByText('Payout is late')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Payout is late'));
    await waitFor(() => expect(screen.getByText('My payout is late')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /assign to me/i }));
    await waitFor(() => expect(screen.getByLabelText('Reply')).toBeInTheDocument());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
