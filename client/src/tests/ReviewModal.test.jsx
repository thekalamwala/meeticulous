import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({ createReview: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import { createReview } from '../services/api';
import ReviewModal from '../components/booking/ReviewModal';

beforeEach(() => vi.clearAllMocks());

test('select stars + submit calls createReview', async () => {
  createReview.mockResolvedValue({ data: { id: 'r1', rating: 4 } });
  const onDone = vi.fn();
  render(<ReviewModal open booking={{ id: 'b1' }} onClose={() => {}} onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }));
  fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
  await waitFor(() => expect(createReview).toHaveBeenCalledWith({ booking_id: 'b1', rating: 4, comment: '', direction: 'guest_to_host' }));
  expect(onDone).toHaveBeenCalled();
});

test('host_to_guest direction is forwarded to createReview', async () => {
  createReview.mockResolvedValue({ data: { id: 'r2', rating: 5 } });
  render(<ReviewModal open booking={{ id: 'b9', guest_name: 'Sam' }} direction="host_to_guest" onClose={() => {}} onDone={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /rate 5/i }));
  fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
  await waitFor(() => expect(createReview).toHaveBeenCalledWith({ booking_id: 'b9', rating: 5, comment: '', direction: 'host_to_guest' }));
});
