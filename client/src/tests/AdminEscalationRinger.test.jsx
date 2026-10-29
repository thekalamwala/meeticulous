import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminEscalationRinger from '../components/admin/AdminEscalationRinger';

// Hoisted so the vi.mock factories can reference them.
const { store, toastFn } = vi.hoisted(() => ({
  store: { handlers: {} },
  toastFn: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}));

// Capturing channel: records the broadcast handler so the test can fire an event.
vi.mock('../services/supabaseClient', () => ({
  getSupabase: vi.fn(() => Promise.resolve({
    channel: () => {
      const c = { on: (_t, filter, cb) => { store.handlers[filter.event] = cb; return c; }, subscribe: () => c };
      return c;
    },
    removeChannel: vi.fn(),
  })),
}));
vi.mock('react-hot-toast', () => ({ default: toastFn }));

beforeEach(() => { store.handlers = {}; toastFn.mockClear(); document.title = 'Admin'; });

describe('AdminEscalationRinger', () => {
  it('subscribes to the station channel and toasts on an escalation', async () => {
    render(<MemoryRouter><AdminEscalationRinger /></MemoryRouter>);
    await waitFor(() => expect(typeof store.handlers.escalation).toBe('function'));

    act(() => store.handlers.escalation({ payload: { thread_id: 't1', reference: 'SUP-ABC123', participant_type: 'host' } }));

    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(toastFn.mock.calls[0][1]).toMatchObject({ id: 'esc-t1' });
  });

  it('does not throw when audio is unavailable (jsdom has no AudioContext)', async () => {
    render(<MemoryRouter><AdminEscalationRinger /></MemoryRouter>);
    await waitFor(() => expect(typeof store.handlers.escalation).toBe('function'));
    expect(() => act(() => store.handlers.escalation({ payload: { thread_id: 't2', reference: 'SUP-XYZ' } }))).not.toThrow();
  });
});
