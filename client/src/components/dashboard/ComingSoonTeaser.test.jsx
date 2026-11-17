import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  notifyFeatureInterest: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}));
import { notifyFeatureInterest } from '../../services/api';
import ComingSoonTeaser from './ComingSoonTeaser';

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('ComingSoonTeaser', () => {
  it('shows the coming-soon pitch and a Notify me button', () => {
    render(<ComingSoonTeaser feature="membership" title="Memberships" blurb="Recurring plans for your regulars." />);
    expect(screen.getByText('Memberships')).toBeInTheDocument();
    expect(screen.getByText(/Recurring plans/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeInTheDocument();
  });

  it('records interest on click and confirms it', async () => {
    render(<ComingSoonTeaser feature="membership" title="Memberships" blurb="x" />);
    fireEvent.click(screen.getByRole('button', { name: /notify me/i }));
    await waitFor(() => expect(notifyFeatureInterest).toHaveBeenCalledWith('membership'));
    expect(await screen.findByText(/we'll let you know/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull();
  });

  it('remembers a prior notify across reloads (per-viewer)', () => {
    try { localStorage.setItem('fi_coupons', '1'); } catch { /* ignore */ }
    render(<ComingSoonTeaser feature="coupons" title="Coupons" blurb="x" />);
    expect(screen.getByText(/we'll let you know/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull();
  });
});
