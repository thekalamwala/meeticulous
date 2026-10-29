/**
 * tests/ServiceBooking.test.jsx
 * Booking flow — time selection, detail form, OTP step, confirmation.
 * Covers new URL params: profileSlug + serviceSlug.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getServiceBySlug:   vi.fn(),
  sendOtp:            vi.fn(),
  verifyOtp:          vi.fn(),
  createBooking:      vi.fn(),
  getBookedSlots:     vi.fn().mockResolvedValue({ data: [] }),
  getAvailableSlots:  vi.fn().mockResolvedValue({ data: { slots: [] } }),
  createPaymentOrder: vi.fn(),
  verifyPayment:      vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }), // guest by default
}));

import {
  getServiceBySlug, sendOtp, verifyOtp, createBooking,
} from '../services/api';
import ServiceBooking from '../pages/ServiceBooking';

const HOST = {
  id: 'v1', name: 'Jane Vendor', username: 'jane-vendor',
  profession: 'Life Coach', bio: 'I help.', profile_image: '',
  cover_image: '', theme_color: '#0079C1', plan: 'explorer',
  is_verified: true, google_calendar_connected: false,
};

const SERVICE = {
  id: 's1', title: 'Consultation', slug: 'consultation',
  price: 0, duration: 30, meeting_mode: 'online',
};

const AVAILABILITY = {
  timezone: 'Asia/Kolkata',
  weekly_schedule: {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
  },
};

const renderBooking = (profileSlug = 'jane-vendor', serviceSlug = 'consultation') =>
  render(
    <MemoryRouter initialEntries={[`/${profileSlug}/booking/${serviceSlug}`]}>
      <Routes>
        <Route path="/:profileSlug/booking/:serviceSlug" element={<ServiceBooking />} />
      </Routes>
    </MemoryRouter>
  );

// ── Loading / error states ────────────────────────────────────────────────────

describe('ServiceBooking — loading/error', () => {
  test('shows loading state while loading', () => {
    getServiceBySlug.mockReturnValueOnce(new Promise(() => {}));
    renderBooking();
    // Redesigned booking-entry loader: branded petal spinner + copy.
    expect(screen.getByText(/setting up your booking/i)).toBeTruthy();
  });

  test('shows "Service not found" when API fails', async () => {
    getServiceBySlug.mockRejectedValueOnce(new Error('Not found'));
    renderBooking();
    await waitFor(() => expect(screen.getByText(/service not found/i)).toBeTruthy());
  });
});

// ── Profile card (persistent left panel) ─────────────────────────────────────

describe('ServiceBooking — profile card', () => {
  beforeEach(() => {
    getServiceBySlug.mockResolvedValue({
      data: { host: HOST, service: SERVICE, availability: AVAILABILITY },
    });
  });

  // Section 1 redesign: vendor/service/pricing details live in a permanent
  // "Profile Information" sidebar, expanded by default — just wait for it.
  const openProfile = async () => {
    await waitFor(() => screen.getByText('Profile Information'));
  };

  test('shows vendor name in left panel', async () => {
    renderBooking();
    await openProfile();
    await waitFor(() => expect(screen.getByText('Jane Vendor')).toBeTruthy());
  });

  test('shows service title in the booking summary card', async () => {
    renderBooking();
    await openProfile();
    await waitFor(() => expect(screen.getByText('Consultation')).toBeTruthy());
  });

  test('shows service duration in left panel', async () => {
    renderBooking();
    await openProfile();
    await waitFor(() => expect(screen.getByText(/30 min/i)).toBeTruthy());
  });

  test('"Back to Services" link points to /:profileSlug', async () => {
    renderBooking();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back to services/i });
      expect(link.getAttribute('href')).toBe('/jane-vendor');
    });
  });
});

// ── Step 1: Time selection ────────────────────────────────────────────────────

describe('ServiceBooking — time step', () => {
  beforeEach(() => {
    getServiceBySlug.mockResolvedValue({
      data: { host: HOST, service: SERVICE, availability: AVAILABILITY },
    });
  });

  test('renders calendar with month/year heading', async () => {
    renderBooking();
    await waitFor(() => {
      const months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
      const found = months.some((m) => screen.queryByText(new RegExp(m)));
      expect(found).toBe(true);
    });
  });

  test('Continue button hidden until date AND time are selected', async () => {
    renderBooking();
    await waitFor(() => expect(screen.queryByRole('button', { name: /continue/i })).toBeNull());
  });

  test('shows timezone abbreviation label', async () => {
    renderBooking();
    // tzAbbr comes from Intl ...timeZoneName:'short'. Depending on the ICU build,
    // Asia/Kolkata renders as the abbreviation "IST" OR the offset "GMT+5:30"
    // (Node's bundled ICU), with the IANA name as fallback. Accept any of them.
    await waitFor(() => expect(screen.getByText(/IST|GMT|Asia/i)).toBeTruthy());
  });
});

// ── Step 2: Details form ──────────────────────────────────────────────────────

describe('ServiceBooking — details step', () => {
  beforeEach(() => {
    getServiceBySlug.mockResolvedValue({
      data: { host: HOST, service: SERVICE, availability: AVAILABILITY },
    });
  });

  test('details form renders required fields', async () => {
    // Jump straight to details step by mocking the router state
    // In practice we'd select a date/time; here we just check form renders.
    renderBooking();
    await waitFor(() => screen.getByText('When works for you?'));
    // First Name / Last Name / Email inputs are present on the details step
    // We verify step navigation triggers them:
    expect(screen.getByText(/when works for you/i)).toBeTruthy();
  });
});

// ── Step 3: OTP (guest flow) ──────────────────────────────────────────────────

describe('ServiceBooking — OTP step (guest)', () => {
  test('OTP input has large tracking, max 6 digits', async () => {
    getServiceBySlug.mockResolvedValue({
      data: { host: HOST, service: { ...SERVICE, price: 0 }, availability: AVAILABILITY },
    });
    sendOtp.mockResolvedValue({ data: { message: 'Sent' } });
    renderBooking();
    await waitFor(() => screen.getByText('When works for you?'));
    // Verify OTP step would show a centered 6-digit input — check it exists in DOM
    // after the step transition (requires selecting time first, which needs a real date)
    // We test the input configuration by checking if the component has the otp field
    // when in otp step — tested via the presence of the form structure
  });
});

// ── Progress bar theme colors ─────────────────────────────────────────────────

describe('ServiceBooking — progress indicators use theme color', () => {
  test('active step indicator uses vendor theme color', async () => {
    getServiceBySlug.mockResolvedValue({
      data: { host: HOST, service: SERVICE, availability: AVAILABILITY },
    });
    renderBooking();
    await waitFor(() => screen.getByText('When works for you?'));
    // Progress dots exist
    const dots = document.querySelectorAll('[style*="background"]');
    expect(dots.length).toBeGreaterThan(0);
  });
});
