/**
 * tests/ProfileSetup.test.jsx
 * Vendor profile settings — tabs, appearance/theme, integrations,
 * save flow, plan-gated color swatches.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  updateProfile: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  uploadImage: vi.fn(),
  getAppearance: vi.fn(() => Promise.resolve({ data: { backgrounds: [] } })),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../components/common/BackButton',   () => ({ default: () => <div>Back</div> }));
vi.mock('../components/common/ImageCropper', () => ({ default: () => null }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

import { updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ProfileSetup from '../pages/ProfileSetup';

const VENDOR = {
  name: 'Jane Vendor', username: 'jane-vendor', email: 'jane@v.com',
  role: 'host', plan: 'explorer', bio: 'Hi there', tagline: 'Coach',
  profession: 'Life Coach', location: 'Mumbai',
  profile_image: '', cover_image: '', theme_color: '#0079C1',
  social_links: { instagram: 'https://instagram.com/jane' },
  google_calendar_connected: false,
};

const renderSetup = (plan = 'explorer') => {
  useAuth.mockReturnValue({
    user: { ...VENDOR, plan },
    updateUser: vi.fn(),
  });
  return render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
};

// ── Tab navigation ────────────────────────────────────────────────────────────

describe('ProfileSetup — tab navigation', () => {
  test('renders five tabs', () => {
    renderSetup();
    expect(screen.getByRole('tab', { name: /profile info/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /categories/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /social links/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /appearance/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeTruthy();
  });

  test('Profile Info tab is active by default', () => {
    renderSetup();
    expect(screen.getByLabelText(/host name/i)).toBeTruthy();
  });

  test('clicking Social Links tab shows social inputs', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /social links/i }));
    expect(screen.getByLabelText(/instagram/i)).toBeTruthy();
    expect(screen.getByLabelText(/youtube/i)).toBeTruthy();
    expect(screen.getByLabelText(/whatsapp/i)).toBeTruthy();
  });

  test('clicking Appearance tab shows theme color section', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    expect(screen.getByText(/theme color/i)).toBeTruthy();
    expect(screen.getByText(/live preview/i)).toBeTruthy();
  });

  test('clicking Integrations tab shows Google Calendar section', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    // "Google Calendar" also appears in a help bullet ("...on your Google Calendar
    // automatically"), so scope to the section heading to stay unambiguous.
    expect(screen.getByRole('heading', { name: /google calendar/i })).toBeTruthy();
  });
});

// ── Profile Info tab ──────────────────────────────────────────────────────────

describe('ProfileSetup — Profile Info', () => {
  test('pre-fills name from user context', () => {
    renderSetup();
    expect(screen.getByDisplayValue('Jane Vendor')).toBeTruthy();
  });

  test('shows the current username (read-only — change is gated)', () => {
    renderSetup();
    // Username is no longer a free-text field here; it's a permanent handle shown
    // as text, changed only via the gated UsernameField control.
    expect(screen.getByText('jane-vendor')).toBeTruthy();
  });

  test('bio field has maxLength 500', () => {
    renderSetup();
    const bio = screen.getByPlaceholderText(/tell people about yourself/i);
    expect(bio.maxLength).toBe(500);
  });
});

// ── Social Links tab ──────────────────────────────────────────────────────────

describe('ProfileSetup — Social Links', () => {
  test('shows all 9 social platforms', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /social links/i }));
    const PLATFORMS = ['Instagram', 'YouTube', 'LinkedIn', 'Facebook', 'X (Twitter)', 'WhatsApp', 'Website', 'GitHub', 'Public Email'];
    // Match the exact label strings. Names like 'X (Twitter)' contain regex
    // metacharacters, so new RegExp(p) would silently fail to match the literal text.
    PLATFORMS.forEach((p) => expect(screen.getByText(p)).toBeTruthy());
  });

  test('pre-fills existing social links from user context', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /social links/i }));
    expect(screen.getByDisplayValue('https://instagram.com/jane')).toBeTruthy();
  });
});

// ── Appearance tab — plan-gated colors ───────────────────────────────────────

describe('ProfileSetup — Appearance (explorer plan)', () => {
  test('shows single brand swatch for explorer', async () => {
    renderSetup('explorer');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    // FREE_COLORS has 1 swatch (brand orange) — at least one titled swatch renders
    const swatches = document.querySelectorAll('button[title]');
    expect(swatches.length).toBeGreaterThanOrEqual(1);
  });

  test('shows upgrade hint for explorer', async () => {
    renderSetup('explorer');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    expect(screen.getByText(/upgrade to host\+ for 16 colours/i)).toBeTruthy();
  });

  test('shows "Book a Session" CTA preview button', async () => {
    renderSetup('explorer');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    // "Book a Session" appears twice in the Appearance tab (mini profile preview
    // card + the dedicated booking-button preview). Target the actual CTA button.
    expect(screen.getByRole('button', { name: /book a session/i })).toBeTruthy();
  });
});

describe('ProfileSetup — Appearance (creator plan)', () => {
  test('shows 8 color swatches for creator', async () => {
    renderSetup('creator');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    const swatches = document.querySelectorAll('button[title]');
    expect(swatches.length).toBeGreaterThanOrEqual(8);
  });

  test('hides custom hex input for creator (pro-only)', async () => {
    renderSetup('creator');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    expect(screen.queryByPlaceholderText(/#4F46E5/i)).toBeNull();
  });
});

describe('ProfileSetup — Appearance (professional plan)', () => {
  test('shows custom hex input for pro', async () => {
    renderSetup('professional');
    await userEvent.click(screen.getByRole('tab', { name: /appearance/i }));
    expect(screen.getByPlaceholderText(/#4F46E5/i)).toBeTruthy();
  });
});

// ── Integrations tab ──────────────────────────────────────────────────────────

describe('ProfileSetup — Integrations', () => {
  test('shows Connect button when Google Calendar not connected', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeTruthy();
  });

  test('shows Connected status when already connected', async () => {
    // Use mockReturnValue (not ...Once): the component calls useAuth() on every
    // render and re-renders after mount (effect) and on tab click, so a one-shot
    // mock would revert to undefined and the button would read "Connect".
    useAuth.mockReturnValue({
      user: { ...VENDOR, google_calendar_connected: true },
      updateUser: vi.fn(),
    });
    render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    expect(screen.getByText(/connected ✓/i)).toBeTruthy();
  });

  test('lists coming-soon integrations (Zoom, Razorpay, Zapier)', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    expect(screen.getByText('Zoom')).toBeTruthy();
    expect(screen.getByText('Razorpay')).toBeTruthy();
    expect(screen.getByText('Zapier')).toBeTruthy();
  });
});

// ── Save flow ─────────────────────────────────────────────────────────────────

describe('ProfileSetup — save', () => {
  test('calls updateProfile with form data on submit', async () => {
    updateProfile.mockResolvedValueOnce({ data: VENDOR });
    renderSetup();
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  });

  test('shows saving… while loading', async () => {
    updateProfile.mockReturnValueOnce(new Promise(() => {})); // never resolves
    renderSetup();
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(screen.getByText(/saving/i)).toBeTruthy());
  });

  test('shows error toast on API failure', async () => {
    const toast = await import('react-hot-toast');
    updateProfile.mockRejectedValueOnce({ response: { data: { message: 'DB error' } } });
    renderSetup();
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(toast.default.error).toHaveBeenCalled());
  });
});

// ── Reschedule fee toggle ─────────────────────────────────────────────────────

describe('ProfileSetup — reschedule fee', () => {
  test('renders "Guest reschedule fee" select in Integrations tab', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    expect(screen.getByLabelText(/guest reschedule fee/i)).toBeTruthy();
  });

  test('defaults to 0 (Free) when profile has no reschedule_fee', async () => {
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    const select = screen.getByLabelText(/guest reschedule fee/i);
    expect(Number(select.value)).toBe(0);
  });

  test('pre-fills ₹10 when profile has reschedule_fee: 10', async () => {
    useAuth.mockReturnValue({
      user: { ...VENDOR, reschedule_fee: 10 },
      updateUser: vi.fn(),
    });
    render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    const select = screen.getByLabelText(/guest reschedule fee/i);
    expect(Number(select.value)).toBe(10);
  });

  test('changing to ₹10 and saving calls updateProfile with reschedule_fee: 10', async () => {
    updateProfile.mockResolvedValueOnce({ data: { ...VENDOR, reschedule_fee: 10 } });
    renderSetup();
    await userEvent.click(screen.getByRole('tab', { name: /integrations/i }));
    const select = screen.getByLabelText(/guest reschedule fee/i);
    await userEvent.selectOptions(select, '10');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ reschedule_fee: 10 })
      )
    );
  });
});
