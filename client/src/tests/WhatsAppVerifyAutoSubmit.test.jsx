/**
 * WhatsAppVerify onboarding OTP auto-submit (Principle #2).
 * Verifies the instant the 6th digit lands — no Verify click. A wrong code
 * keeps the input (existing behaviour) and must NOT re-fire in a loop.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import WhatsAppVerify from '../components/whatsapp/WhatsAppVerify';

vi.mock('../services/api', () => ({
  whatsappSendOtp: vi.fn(() => Promise.resolve({ data: { success: true } })),
  whatsappVerifyOtp: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { whatsappVerifyOtp } from '../services/api';

async function reachOtp() {
  fireEvent.change(screen.getByPlaceholderText('98765 43210'), {
    target: { value: '9876543210' },
  });
  fireEvent.click(screen.getByText('Send OTP'));
  return screen.findByPlaceholderText('––––––');
}

beforeEach(() => vi.clearAllMocks());

describe('WhatsAppVerify auto-submit', () => {
  it('verifies automatically on the 6th digit, no button click', async () => {
    whatsappVerifyOtp.mockResolvedValue({ data: { verified: true } });
    const onVerified = vi.fn();
    render(<WhatsAppVerify onVerified={onVerified} />);
    const input = await reachOtp();

    fireEvent.change(input, { target: { value: '123456' } });

    await waitFor(() => expect(whatsappVerifyOtp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it('does not re-fire the same wrong code (no loop)', async () => {
    whatsappVerifyOtp.mockResolvedValue({ data: { verified: false, message: 'Invalid OTP.' } });
    render(<WhatsAppVerify onVerified={vi.fn()} />);
    const input = await reachOtp();

    fireEvent.change(input, { target: { value: '000000' } });

    await waitFor(() => expect(whatsappVerifyOtp).toHaveBeenCalledTimes(1));
    // Code is kept on error; the effect must not resubmit it.
    await waitFor(() => expect(screen.getByText('Invalid OTP.')).toBeTruthy());
    expect(input.value).toBe('000000');
    expect(whatsappVerifyOtp).toHaveBeenCalledTimes(1);
  });
});
