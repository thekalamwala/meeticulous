import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const start = vi.fn();
let flagOn = false;
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ startLinkedinHostAuth: start }) }));
vi.mock('../context/FeatureContext', () => ({
  useFeature: () => flagOn,
  useFeatures: () => ({ flags: flagOn ? { host_linkedin_login: true } : {} }),
}));
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({ default: { error: (...a) => toastError(...a) } }));

import ContinueWithLinkedIn from '../components/ContinueWithLinkedIn';

beforeEach(() => { vi.clearAllMocks(); flagOn = false; });

test('hidden when flag off', () => {
  render(<ContinueWithLinkedIn intent="login" />);
  expect(screen.queryByRole('button')).toBeNull();
});

test('on: click calls startLinkedinHostAuth(intent) once even on double click', async () => {
  flagOn = true;
  start.mockReturnValue(new Promise(() => {}));
  render(<ContinueWithLinkedIn intent="signup" />);
  const btn = screen.getByRole('button', { name: /continue with linkedin/i });
  expect(btn).toHaveAttribute('type', 'button');
  fireEvent.click(btn);
  fireEvent.click(btn);
  expect(start).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledWith('signup');
});

test('rejection toasts and re-enables', async () => {
  flagOn = true;
  start.mockRejectedValue(new Error('x'));
  render(<ContinueWithLinkedIn intent="login" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't start LinkedIn sign-in. Try again."));
  expect(screen.getByRole('button')).not.toBeDisabled();
});

test('onStart runs before the LinkedIn redirect starts', async () => {
  flagOn = true;
  const order = [];
  start.mockImplementation(async () => { order.push('start'); });
  render(<ContinueWithLinkedIn intent="signup" onStart={() => order.push('onStart')} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(order).toEqual(['onStart', 'start']));
});
