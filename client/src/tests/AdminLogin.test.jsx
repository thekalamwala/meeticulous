/**
 * tests/AdminLogin.test.jsx
 * Three-phase admin login:
 *   Phase 1 — password (all paths)
 *   Phase 2a — twofa_required → verify existing TOTP
 *   Phase 2b — enroll_required → setup QR + confirm new TOTP
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AdminLogin from '../pages/AdminLogin';

// Mock API calls (all 4 functions used by the component)
vi.mock('../services/api', () => ({
  adminLoginUser:  vi.fn(),
  admin2faSetup:   vi.fn(),
  admin2faConfirm: vi.fn(),
  admin2faVerify:  vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { adminLoginUser, admin2faSetup, admin2faConfirm, admin2faVerify } from '../services/api';

const ADMIN_SESSION = {
  token: 'adm-tok',
  type: 'admin',
  role: 'super',
  name: 'Super Admin',
  username: 'superadmin',
  email: 'superadmin@meeticulous.com',
  permissions: ['*'],
};

const renderComponent = () =>
  render(<MemoryRouter><AdminLogin /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Phase 1 — password form (basic render + submit + back-compat token path)
// ---------------------------------------------------------------------------
describe('AdminLogin — password step', () => {
  test('renders username and password fields', () => {
    renderComponent();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  test('calls adminLoginUser with identifier + password on submit', async () => {
    adminLoginUser.mockResolvedValueOnce({ data: ADMIN_SESSION });
    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    fireEvent.submit(screen.getByRole('button', { name: /grant access/i }));
    await waitFor(() =>
      expect(adminLoginUser).toHaveBeenCalledWith({
        identifier: 'superadmin',
        password: 'Sloth$Super#2026',
      })
    );
  });

  // Back-compat: server returns full token directly (no 2FA configured yet)
  test('back-compat: stores session under bas_admin and navigates when token returned directly', async () => {
    adminLoginUser.mockResolvedValueOnce({ data: ADMIN_SESSION });
    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bas_admin') || 'null');
      expect(stored?.role).toBe('super');
      expect(stored?.token).toBe('adm-tok');
      // Must NOT overwrite the regular user session
      expect(localStorage.getItem('user')).toBeNull();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/super-dashboard');
  });

  test('shows error toast on bad credentials', async () => {
    const toast = await import('react-hot-toast');
    adminLoginUser.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials.' } },
    });
    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));
    await waitFor(() => expect(toast.default.error).toHaveBeenCalled());
    expect(localStorage.getItem('bas_admin')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 2a — twofa_required: enter existing TOTP code
// ---------------------------------------------------------------------------
describe('AdminLogin — twofa_required flow', () => {
  test('shows code input after password step when twofa_required', async () => {
    adminLoginUser.mockResolvedValueOnce({
      data: { twofa_required: true, pending_token: 'pt' },
    });
    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));
    await waitFor(() => {
      // A code input must appear (6-digit authenticator code)
      const codeInput =
        screen.queryByPlaceholderText(/123456/i) ||
        screen.queryByLabelText(/authenticator code/i) ||
        screen.queryByLabelText(/6.digit/i) ||
        screen.queryByLabelText(/totp/i) ||
        screen.queryByLabelText(/code/i);
      expect(codeInput).toBeTruthy();
    });
    // Username/password inputs should no longer be visible
    expect(screen.queryByLabelText(/^username$/i)).toBeNull();
  });

  test('calls admin2faVerify with pending_token + code, stores session, navigates', async () => {
    adminLoginUser.mockResolvedValueOnce({
      data: { twofa_required: true, pending_token: 'pt' },
    });
    admin2faVerify.mockResolvedValueOnce({ data: ADMIN_SESSION });

    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));

    // Wait for code step to render
    const codeInput = await waitFor(() => {
      const el =
        screen.queryByPlaceholderText(/123456/i) ||
        screen.queryByLabelText(/authenticator code/i) ||
        screen.queryByLabelText(/6.digit/i) ||
        screen.queryByLabelText(/totp/i) ||
        screen.queryByLabelText(/code/i);
      expect(el).toBeTruthy();
      return el;
    });

    await userEvent.type(codeInput, '123456');
    // Submit the code form
    const submitBtn = screen.getByRole('button', { name: /verify|confirm|submit/i });
    await userEvent.click(submitBtn);

    await waitFor(() =>
      expect(admin2faVerify).toHaveBeenCalledWith({
        pending_token: 'pt',
        code: '123456',
      })
    );

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bas_admin') || 'null');
      expect(stored?.token).toBe('adm-tok');
      expect(stored?.role).toBe('super');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/super-dashboard');
  });
});

// ---------------------------------------------------------------------------
// Phase 2b — enroll_required: show QR, confirm new TOTP, show recovery codes
// ---------------------------------------------------------------------------
describe('AdminLogin — enroll_required flow', () => {
  const SETUP_RESPONSE = {
    qr_data_url: 'data:image/png;base64,AAAA',
    otpauth_uri: 'otpauth://totp/x',
    secret: 'SECRET123',
  };

  test('calls admin2faSetup with pending_token and renders QR image', async () => {
    adminLoginUser.mockResolvedValueOnce({
      data: { enroll_required: true, pending_token: 'pe' },
    });
    admin2faSetup.mockResolvedValueOnce({ data: SETUP_RESPONSE });

    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() =>
      expect(admin2faSetup).toHaveBeenCalledWith({ pending_token: 'pe' })
    );

    // QR <img> must appear with the data: URL
    const img = await waitFor(() => {
      const el = screen.getByRole('img');
      expect(el.src).toMatch(/^data:image/);
      return el;
    });
    expect(img).toBeTruthy();
  });

  test('enroll full flow: confirm code → show recovery codes → continue → stores session', async () => {
    const RECOVERY_SESSION = {
      ...ADMIN_SESSION,
      recovery_codes: ['AAAA-BBBB', 'CCCC-DDDD'],
    };

    adminLoginUser.mockResolvedValueOnce({
      data: { enroll_required: true, pending_token: 'pe' },
    });
    admin2faSetup.mockResolvedValueOnce({ data: SETUP_RESPONSE });
    admin2faConfirm.mockResolvedValueOnce({ data: RECOVERY_SESSION });

    renderComponent();
    await userEvent.type(screen.getByLabelText(/username/i), 'superadmin');
    await userEvent.type(screen.getByLabelText(/password/i), 'Sloth$Super#2026');
    await userEvent.click(screen.getByRole('button', { name: /grant access/i }));

    // Wait for enroll step
    await waitFor(() => expect(admin2faSetup).toHaveBeenCalled());

    // Code input in enroll step
    const codeInput = await waitFor(() => {
      const el =
        screen.queryByPlaceholderText(/123456/i) ||
        screen.queryByLabelText(/authenticator code/i) ||
        screen.queryByLabelText(/6.digit/i) ||
        screen.queryByLabelText(/totp/i) ||
        screen.queryByLabelText(/code/i);
      expect(el).toBeTruthy();
      return el;
    });

    await userEvent.type(codeInput, '654321');
    const activateBtn = screen.getByRole('button', { name: /activate|enable|confirm|verify/i });
    await userEvent.click(activateBtn);

    await waitFor(() =>
      expect(admin2faConfirm).toHaveBeenCalledWith({
        pending_token: 'pe',
        code: '654321',
      })
    );

    // Recovery codes must be shown
    await waitFor(() => {
      expect(screen.getByText('AAAA-BBBB')).toBeTruthy();
      expect(screen.getByText('CCCC-DDDD')).toBeTruthy();
    });

    // Click Continue → store session + navigate
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    await userEvent.click(continueBtn);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bas_admin') || 'null');
      expect(stored?.token).toBe('adm-tok');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/super-dashboard');
  });
});
