import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  whatsappSendOtp: vi.fn(() => Promise.resolve({ data: { success: true } })),
  whatsappVerifyOtp: vi.fn(() => Promise.resolve({ data: { success: true, verified: true } })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { whatsappSendOtp, whatsappVerifyOtp } from '../../services/api';
import WhatsAppVerify from './WhatsAppVerify';

describe('WhatsAppVerify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends OTP then shows the OTP screen, then verifies', async () => {
    const onVerified = vi.fn();
    render(<WhatsAppVerify initialCountry="+91" onVerified={onVerified} />);

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));

    await waitFor(() => expect(whatsappSendOtp).toHaveBeenCalledWith('+919876543210'));
    const otpInput = await screen.findByLabelText(/enter otp/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    await waitFor(() => expect(whatsappVerifyOtp).toHaveBeenCalledWith('+919876543210', '123456'));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('+919876543210'));
  });
});
