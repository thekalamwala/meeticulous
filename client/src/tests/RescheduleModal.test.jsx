import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({
  getAvailableSlots: vi.fn(), rescheduleBooking: vi.fn(), createRescheduleFeeOrder: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/useFeatureFlags', () => ({ default: () => ({ on: () => true }) }));
import { getAvailableSlots, rescheduleBooking } from '../services/api';
import RescheduleModal from '../components/booking/RescheduleModal';

const slot = '2099-01-02T06:00:00.000Z';
const slotLabel = new Date(slot).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const booking = { id: 'b1', host_id: 'h1', service_id: 's1', scheduled_at: '2099-01-01T05:00:00.000Z',
  reschedule_count: 0, services: { id: 's1', duration: 30 },
  'profiles!bookings_host_id_fkey': { reschedule_fee: 0 } };

beforeEach(() => vi.clearAllMocks());

test('free path: pick slot → calls rescheduleBooking', async () => {
  getAvailableSlots.mockResolvedValue({ data: { slots: [slot] } });
  rescheduleBooking.mockResolvedValue({ data: {} });
  const onDone = vi.fn();
  render(<RescheduleModal open booking={booking} onClose={() => {}} onDone={onDone} />);
  fireEvent.change(screen.getByTestId('resched-date'), { target: { value: '2099-01-02' } });
  await waitFor(() => screen.getByRole('button', { name: slotLabel }));
  fireEvent.click(screen.getByRole('button', { name: slotLabel }));
  fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
  await waitFor(() => expect(rescheduleBooking).toHaveBeenCalledWith('b1', { scheduled_at: slot }));
  expect(onDone).toHaveBeenCalled();
});
