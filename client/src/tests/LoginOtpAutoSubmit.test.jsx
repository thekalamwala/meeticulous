/**
 * Guest OTP login auto-submit (Principle #2 — act immediately on input).
 * The code must verify the instant the 6th digit lands — no Verify click — and
 * a wrong code must clear the input (which also stops the effect re-firing).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Login from '../pages/Login';

const loginWithOtp = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ loginWithOtp }),
}));

vi.mock('../services/api', () => ({
  sendOtp: vi.fn(() => Promise.resolve({})),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Toasts are noise here.
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);

// Walk phone step → OTP step, return the OTP input element.
async function reachOtpStep() {
  fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), {
    target: { value: '+91 98765 43210' },
  });
  fireEvent.click(screen.getByText('Send code on WhatsApp'));
  return screen.findByPlaceholderText('123456');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login OTP auto-submit', () => {
  it('verifies automatically when the 6th digit is entered, no button click', async () => {
    loginWithOtp.mockResolvedValue({ is_host: false });
    renderLogin();
    const input = await reachOtpStep();

    fireEvent.change(input, { target: { value: '123456' } });

    await waitFor(() => expect(loginWithOtp).toHaveBeenCalledWith('+91 98765 43210', '123456'));
    expect(loginWithOtp).toHaveBeenCalledTimes(1);
  });

  it('clears the input after a wrong code (prevents re-fire loop)', async () => {
    loginWithOtp.mockRejectedValue({ response: { data: { message: 'Invalid code' } } });
    renderLogin();
    const input = await reachOtpStep();

    fireEvent.change(input, { target: { value: '000000' } });

    await waitFor(() => expect(loginWithOtp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input.value).toBe(''));
    // Still exactly one attempt — the cleared input did not re-trigger.
    expect(loginWithOtp).toHaveBeenCalledTimes(1);
  });
});
