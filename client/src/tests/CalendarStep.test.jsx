import { StrictMode } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { vi, test, expect, beforeEach, describe } from 'vitest';

vi.mock('../services/api', () => ({
  skipCalendar: vi.fn(() => Promise.resolve({ data: {} })),
  getMe: vi.fn(() => Promise.resolve({ data: { google_calendar_connected: true } })),
  getOnboardingStatus: vi.fn(() =>
    Promise.resolve({ data: { stepCompleted: 6, isComplete: false, slug: 'test' } })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../services/analytics', () => ({ analytics: { track: vi.fn() } }));

const auth = { user: {}, updateUser: vi.fn(), connectGoogleCalendar: vi.fn() };
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

import { skipCalendar, getMe } from '../services/api';
import { analytics } from '../services/analytics';
import CalendarStep from '../pages/onboarding/CalendarStep';
import { needsCalendar } from '../pages/onboarding/needsCalendar';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const renderAt = (search = '', strict = false) => {
  const tree = (
    <MemoryRouter initialEntries={[`/vendor-register/test/calendar${search}`]}>
      <Routes>
        <Route path="/vendor-register/:slug/calendar" element={<CalendarStep />} />
        <Route path="/vendor-register/:slug/live" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = {};
});

describe('needsCalendar', () => {
  test('connected -> false', () => expect(needsCalendar({ google_calendar_connected: true })).toBe(false));
  test('skipped -> false', () => expect(needsCalendar({ calendar_skipped: true })).toBe(false));
  test('neither -> true', () => expect(needsCalendar({})).toBe(true));
});

describe('CalendarStep', () => {
  test('already connected, no ?google -> goes to /live', async () => {
    auth.user = { google_calendar_connected: true };
    renderAt();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/vendor-register/test/live'));
  });

  test('Connect button starts consent returning to this screen', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /connect google calendar/i }));
    expect(auth.connectGoogleCalendar).toHaveBeenCalledWith('/vendor-register/test/calendar');
  });

  test('?google=connected -> refreshes user, tracks once and goes to /live (StrictMode)', async () => {
    renderAt('?google=connected', true);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/vendor-register/test/live'));
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('calendar_connected', { source: 'onboarding' });
  });

  test('?google=denied -> shows the not-granted message and both buttons', async () => {
    renderAt('?google=denied');
    expect(await screen.findByText(/Calendar access wasn.t granted — tick the calendar boxes on Google.s screen, or skip for now\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
  });

  test('Skip for now -> skipCalendar then /live', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /skip for now/i }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/vendor-register/test/live'));
    expect(skipCalendar).toHaveBeenCalledTimes(1);
  });
});
