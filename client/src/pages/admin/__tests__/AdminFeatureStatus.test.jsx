import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../../../services/api', () => ({
  adminGetFeatures: vi.fn(), adminToggleFeature: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import { adminGetFeatures, adminToggleFeature } from '../../../services/api';
import AdminFeatureStatus from '../AdminFeatureStatus';

beforeEach(() => vi.clearAllMocks());

test('lists flags and toggles one', async () => {
  adminGetFeatures.mockResolvedValue({ data: [
    { key: 'reschedule', label: 'Booking Reschedule', description: 'x', enabled: true },
  ] });
  adminToggleFeature.mockResolvedValue({ data: { key: 'reschedule', enabled: false } });
  render(<AdminFeatureStatus />);
  await waitFor(() => screen.getByText('Booking Reschedule'));
  fireEvent.click(screen.getByRole('switch', { name: /Booking Reschedule/i }));
  await waitFor(() => expect(adminToggleFeature).toHaveBeenCalledWith('reschedule', false));
});
