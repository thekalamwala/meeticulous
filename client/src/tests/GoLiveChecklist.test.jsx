/**
 * tests/GoLiveChecklist.test.jsx
 * The host activation checklist: step completion from real state, the
 * money-waiting KYC subtitle, the copy-link action, and hiding when fully live.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { markLinkShared: vi.fn() } }));
vi.mock('../services/api', () => api);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, toast) }));

import GoLiveChecklist from '../components/dashboard/GoLiveChecklist';

const renderIt = (props) =>
  render(<MemoryRouter><GoLiveChecklist hasPaidService={false} kyc={null} username="asha" {...props} /></MemoryRouter>);

// The checklist is now a "Setup N/3" pill; the steps live in a dropdown that
// opens on click. Open it before asserting on step content.
const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /Setup/i }));

beforeEach(() => { vi.clearAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

describe('GoLiveChecklist', () => {
  it('shows all three steps and 0/3 for a brand-new host', () => {
    renderIt();
    expect(screen.getByText('0/3')).toBeInTheDocument(); // pill, before opening
    openPanel();
    expect(screen.getByText('Add a paid service')).toBeInTheDocument();
    expect(screen.getByText('Verify to get paid')).toBeInTheDocument();
    expect(screen.getByText('Share your booking link')).toBeInTheDocument();
  });

  it('counts a paid service as done', () => {
    renderIt({ hasPaidService: true });
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('shows the money-waiting subtitle on the KYC step', () => {
    renderIt({ kyc: { status: 'none', pending_earnings: 2500, payouts_ready: false } });
    openPanel();
    expect(screen.getByText(/₹2,500 is waiting — finish KYC to withdraw/i)).toBeInTheDocument();
  });

  it('copies the booking link and marks the step done', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    renderIt();
    openPanel();
    fireEvent.click(screen.getByText(/Copy link/));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/asha')));
    expect(api.markLinkShared).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());
  });

  it('hides entirely once all three are done', () => {
    try { localStorage.setItem('mt_golive_link_shared', '1'); } catch { /* ignore */ }
    const { container } = renderIt({ hasPaidService: true, kyc: { status: 'approved' } });
    expect(container.firstChild).toBeNull();
  });
});
