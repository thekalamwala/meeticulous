/**
 * PriceBenchmark chip — advisory "what similar hosts charge".
 * On-demand fetch; hides itself when the sample is thin; taps fill the input.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({ getPriceBenchmark: vi.fn() }));

import { getPriceBenchmark } from '../services/api';
import { PriceBenchmark } from '../pages/services/ServiceForm';

beforeEach(() => vi.clearAllMocks());

describe('PriceBenchmark', () => {
  test('fetches on tap and fills the price via a chip', async () => {
    getPriceBenchmark.mockResolvedValue({ data: { low: 800, median: 1200, high: 1500, sample_size: 9, basis: 'category' } });
    const onPick = vi.fn();
    render(<PriceBenchmark category="portrait" onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: /See what similar hosts charge/i }));
    await waitFor(() => expect(getPriceBenchmark).toHaveBeenCalledWith('portrait'));

    const median = await screen.findByRole('button', { name: /Median ₹1200/i });
    fireEvent.click(median);
    expect(onPick).toHaveBeenCalledWith(1200);
  });

  test('shows the "not enough" message when the sample is thin (median null)', async () => {
    getPriceBenchmark.mockResolvedValue({ data: { low: null, median: null, high: null, sample_size: 2, basis: null } });
    render(<PriceBenchmark category="rare" onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /See what similar hosts charge/i }));
    await screen.findByText(/Not enough similar listings/i);
  });

  test('degrades to an error line when the request fails', async () => {
    getPriceBenchmark.mockRejectedValue(new Error('boom'));
    render(<PriceBenchmark onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /See what similar hosts charge/i }));
    await screen.findByText(/Could not load pricing data/i);
  });
});
