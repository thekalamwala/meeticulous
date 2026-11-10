import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

let flagOn = false;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ startVendorGoogleAuth: vi.fn(), startLinkedinHostAuth: vi.fn(), user: null, mode: null, logout: vi.fn() }),
}));
vi.mock('../context/FeatureContext', () => ({
  useFeature: () => flagOn,
  useFeatures: () => ({ flags: flagOn ? { host_linkedin_login: true } : {} }),
}));
const toastError = vi.fn();
vi.mock('react-hot-toast', () => {
  const t = (...a) => toastError(...a);
  t.error = (...a) => toastError(...a);
  return { default: t };
});
vi.mock('../components/auth/AuthBrandPanel', () => ({ default: () => null }));
vi.mock('../components/auth/AuthMobilePattern', () => ({ default: () => null }));
vi.mock('../components/common/Seo', () => ({ default: () => null }));

// Host + guest share UnifiedLogin; the /login-as-vendor route defaults it to the host door.
import UnifiedLogin from '../pages/UnifiedLogin';

const COPY = {
  linkedin_failed: 'LinkedIn sign-in failed. Please try again.',
  linkedin_cancelled: 'LinkedIn sign-in was cancelled.',
  email_has_account: 'This email already has a host account. Sign in with Google.',
  linkedin_off: "LinkedIn sign-in isn't available right now.",
  email_unverified: 'Verify the email on your LinkedIn account, then try again.',
};

beforeEach(() => { vi.clearAllMocks(); flagOn = false; });

test.each(Object.entries(COPY))('error=%s shows exact copy', (code, msg) => {
  render(<MemoryRouter initialEntries={[`/login-as-vendor?error=${code}`]}><UnifiedLogin /></MemoryRouter>);
  expect(toastError).toHaveBeenCalledWith(msg);
});

// The Google calendar-account guard is live with the flag off too, so only point
// at LinkedIn when the LinkedIn button is actually there.
test('error=calendar_account with flag ON → points to LinkedIn', () => {
  flagOn = true;
  render(<MemoryRouter initialEntries={['/login-as-vendor?error=calendar_account']}><UnifiedLogin /></MemoryRouter>);
  expect(toastError).toHaveBeenCalledWith('This Google account is connected as a calendar to an existing host. Sign in with LinkedIn instead.');
});

test('error=calendar_account with flag OFF → no LinkedIn mention', () => {
  render(<MemoryRouter initialEntries={['/login-as-vendor?error=calendar_account']}><UnifiedLogin /></MemoryRouter>);
  expect(toastError).toHaveBeenCalledWith('This Google account is connected as a calendar to an existing host. Sign in with the account you used to sign up.');
});

test('"Already a host?" line only with flag on', () => {
  const { unmount } = render(<MemoryRouter initialEntries={['/login-as-vendor']}><UnifiedLogin /></MemoryRouter>);
  expect(screen.queryByText(/Already a host\?/)).toBeNull();
  expect(screen.getByRole('button', { name: /continue with linkedin/i })).toBeDisabled(); // inert Soon button
  unmount();
  flagOn = true;
  render(<MemoryRouter initialEntries={['/login-as-vendor']}><UnifiedLogin /></MemoryRouter>);
  expect(screen.getByText('Already a host? Use the same option you signed up with.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /continue with linkedin/i })).toBeEnabled();
});
