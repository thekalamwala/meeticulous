import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSupportUnread from '../hooks/useSupportUnread';

const { api } = vi.hoisted(() => ({ api: { getSupportUnread: vi.fn() } }));

vi.mock('../services/api', () => ({ getSupportUnread: api.getSupportUnread }));
vi.mock('../services/supabaseClient', () => ({
  getSupabase: vi.fn(() => Promise.resolve({
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: vi.fn(),
  })),
}));

beforeEach(() => { api.getSupportUnread.mockReset(); });

describe('useSupportUnread', () => {
  it('returns the server unread count', async () => {
    api.getSupportUnread.mockResolvedValue({ data: { count: 4, thread_id: 't1' } });
    const { result } = renderHook(() => useSupportUnread());
    await waitFor(() => expect(result.current).toBe(4));
  });

  it('refetches when SupportChat signals a read', async () => {
    api.getSupportUnread
      .mockResolvedValueOnce({ data: { count: 2, thread_id: 't1' } })
      .mockResolvedValue({ data: { count: 0, thread_id: 't1' } });
    const { result } = renderHook(() => useSupportUnread());
    await waitFor(() => expect(result.current).toBe(2));
    act(() => window.dispatchEvent(new Event('support:unread-changed')));
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('stays at 0 on error, never throwing', async () => {
    api.getSupportUnread.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSupportUnread());
    await waitFor(() => expect(api.getSupportUnread).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });
});
