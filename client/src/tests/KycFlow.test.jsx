import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { KycProvider } from '../context/KycContext';
import PageTransition from '../components/dashboard/ui/PageTransition';
import KycFlow from '../pages/kyc/KycFlow';
import KycStart from '../pages/kyc/KycStart';
import KycBank from '../pages/kyc/KycBank';

vi.mock('../services/api', () => ({ submitKyc: vi.fn(), uploadKycFile: vi.fn() }));
// One frozen object, returned by identity — KycStart's prefill effect depends on
// `user`, so a fresh literal per call would re-fire it forever (setPersonal →
// render → new user → effect...). The real AuthContext memoizes its value.
vi.mock('../context/AuthContext', () => {
  const value = { user: { name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' } };
  return { useAuth: () => value };
});
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

// PageTransition is keyed on pathname, so everything below it remounts on every
// step. This mirrors the real DashboardLayout nesting: if KycProvider ever moves
// back inside KycFlow, the flow state dies on Continue and <Guard> bounces the
// host to step one — the bug this test exists to catch.
const renderFlow = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/kyc/flow/start']}>
      <Routes>
        <Route
          path="/dashboard/kyc/flow"
          element={<KycProvider><PageTransition><KycFlow /></PageTransition></KycProvider>}
        >
          <Route path="start" element={<KycStart />} />
          <Route path="bank" element={<KycBank />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('KYC flow step persistence', () => {
  it('keeps personal details and advances to Bank instead of resetting to step one', async () => {
    renderFlow();

    await waitFor(() => expect(screen.getByLabelText(/Full name/i).value).toBe('Asha Rao'));
    fireEvent.change(screen.getByLabelText(/PAN number/i), { target: { value: 'ABCDE1234F' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => expect(screen.getByText('Bank account')).toBeTruthy());

    // AnimatePresence mode="wait" keeps the OUTGOING subtree mounted until its
    // exit animation finishes — asserting before that passes even when the
    // provider is doomed to remount. Let the transition settle, then check that
    // <Guard> has not bounced us back to step one.
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.getByText('Bank account')).toBeTruthy();
    expect(screen.queryByText('Personal details')).toBe(null);
  });
});
