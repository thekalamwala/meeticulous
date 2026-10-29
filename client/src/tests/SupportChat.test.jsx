import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import SupportChat from '../components/chat/SupportChat';

// Realtime client — a no-op channel that chains .on().subscribe().
vi.mock('../services/supabaseClient', () => ({
  getSupabase: vi.fn(() => Promise.resolve({
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: vi.fn(),
  })),
}));

vi.mock('../services/api', () => ({
  getSupportThread: vi.fn(() => Promise.resolve({ data: {
    thread: { id: 't1', status: 'bot' },
    messages: [{ id: 'm1', sender: 'bot', body: 'Hi, I am Bolt', created_at: '2026-08-25T10:00:00Z' }],
  } })),
  sendSupportMessage: vi.fn((id, { body }) => Promise.resolve({ data: { id: 'm2', sender: 'user', body, created_at: '2026-08-25T10:01:00Z' } })),
  escalateSupport: vi.fn(() => Promise.resolve({ data: { thread: { id: 't1', status: 'waiting' }, open: true } })),
  markSupportRead: vi.fn(() => Promise.resolve({})),
  getSupportHours: vi.fn(() => Promise.resolve({ data: { open: true, label: 'Mon–Fri, 10am–6pm IST' } })),
  getSupportThreads: vi.fn(() => Promise.resolve({ data: { threads: [] } })),
  getSupportMessages: vi.fn(() => Promise.resolve({ data: { thread: { id: 't1', status: 'bot' }, messages: [] } })),
  startSupportTopic: vi.fn(() => Promise.resolve({ data: { thread: { id: 't-new', status: 'bot' }, messages: [] } })),
  rateSupportThread: vi.fn(() => Promise.resolve({ data: { thread: { id: 't1', status: 'resolved', rating: 5 } } })),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import { getSupportThread, sendSupportMessage, escalateSupport } from '../services/api';

beforeAll(() => { window.HTMLElement.prototype.scrollIntoView = vi.fn(); });

describe('SupportChat', () => {
  it('loads the thread and shows the Bolt message + the "Talk to a human" action', async () => {
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /talk to a human/i })).toBeInTheDocument();
  });

  it('sends a message and appends it', async () => {
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'my payout is late' } });
    fireEvent.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(sendSupportMessage).toHaveBeenCalledWith('t1', { body: 'my payout is late' }));
    await waitFor(() => expect(screen.getByText('my payout is late')).toBeInTheDocument());
  });

  it('collects a detailed problem before escalating to a human', async () => {
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    // The nudge appears only after Bolt has replied.
    fireEvent.click(screen.getByRole('button', { name: /talk to a human/i }));
    // Intake requires real detail — a too-short message can't submit.
    const box = screen.getByLabelText('Describe your problem');
    const submit = screen.getByRole('button', { name: /connect me to a human/i });
    fireEvent.change(box, { target: { value: 'help' } });
    expect(submit).toBeDisabled();
    fireEvent.change(box, { target: { value: 'My payout for booking SUP-1234 is 3 days late' } });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    await waitFor(() => expect(escalateSupport).toHaveBeenCalledWith('t1', { summary: 'My payout for booking SUP-1234 is 3 days late' }));
  });

  it('shows "Raise a ticket" instead of "Talk to a human" outside support hours', async () => {
    const { getSupportHours } = await import('../services/api');
    getSupportHours.mockResolvedValueOnce({ data: { open: false, label: 'Mon–Fri, 10am–6pm IST' } });
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /raise a ticket/i })).toBeInTheDocument());
  });

  it('renders bot markdown as formatting, not raw asterisks/link syntax', async () => {
    getSupportThread.mockResolvedValueOnce({ data: {
      thread: { id: 't1', status: 'bot' },
      messages: [{ id: 'm1', sender: 'bot', body: 'Your **payout** clears in 2 days. See [help](https://meeticulous.com/help).', created_at: '2026-08-25T10:00:00Z' }],
    } });
    const { container } = render(<SupportChat />);
    await waitFor(() => expect(container.querySelector('strong')?.textContent).toBe('payout'));
    expect(container.querySelector('a[href="https://meeticulous.com/help"]')).not.toBeNull();
    expect(container.textContent).not.toContain('**');
  });

  it('shows a "Bolt is typing" indicator after the user sends, in the bot phase', async () => {
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'help me' } });
    fireEvent.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByRole('status', { name: /bolt is typing/i })).toBeInTheDocument());
  });

  it('renders bot markdown as formatting, not raw asterisks/link syntax', async () => {
    getSupportThread.mockResolvedValueOnce({ data: {
      thread: { id: 't1', status: 'bot' },
      messages: [{ id: 'm1', sender: 'bot', body: 'Your **payout** clears in 2 days. See [help](https://meeticulous.com/help).', created_at: '2026-08-25T10:00:00Z' }],
    } });
    const { container } = render(<SupportChat />);
    await waitFor(() => expect(container.querySelector('strong')?.textContent).toBe('payout'));
    expect(container.querySelector('a[href="https://meeticulous.com/help"]')).not.toBeNull();
    expect(container.textContent).not.toContain('**');
  });

  it('shows a "Bolt is typing" indicator after the user sends, in the bot phase', async () => {
    render(<SupportChat />);
    await waitFor(() => expect(screen.getByText('Hi, I am Bolt')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'help me' } });
    fireEvent.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByRole('status', { name: /bolt is typing/i })).toBeInTheDocument());
  });
});
