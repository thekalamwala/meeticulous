import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailability, setAvailability } from '../../services/api';
import AvailabilityV2 from '../AvailabilityV2';

vi.mock('../../services/api', () => ({
  getAvailability: vi.fn(),
  setAvailability: vi.fn(() => Promise.resolve({ data: {} })),
  getGoogleAuthUrl: vi.fn(() => Promise.resolve({ data: { url: '#' } })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { plan: 'starter', username: 'riya', google_calendar_connected: false } }) }));

const ROW = {
  weekly_schedule: { monday: [{ start: '10:00', end: '18:00' }], tuesday: [{ start: '10:00', end: '18:00' }] },
  timezone: 'Asia/Kolkata', buffer_minutes: 15, blocked_dates: ['2099-12-25'],
  cap_per_day: null, cap_per_week: null, cap_per_guest: null,
};
const mount = () => render(<MemoryRouter><AvailabilityV2 /></MemoryRouter>);

describe('AvailabilityV2 (Kept Schedule)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows skeletons, not an empty week, until the data lands', () => {
    getAvailability.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.queryByText('Weekly hours')).toBeNull();
    expect(screen.queryByText(/can.t book you yet/)).toBeNull();
  });

  it('sums the week in the band and saves the same payload shape', async () => {
    getAvailability.mockResolvedValue({ data: ROW });
    mount();
    expect(await screen.findByText(/open 16 hours a week/)).toBeTruthy();
    expect(screen.getByText('Mon and Tue.')).toBeTruthy();
    expect(screen.getByText('A 15-minute break after every booking.')).toBeTruthy();
    expect(screen.getByText('Limits are a Pro feature.', { exact: false })).toBeTruthy();

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull(); // the bar appears only with changes
    fireEvent.click(screen.getByRole('switch', { name: 'Open Sunday' }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setAvailability).toHaveBeenCalledTimes(1));
    expect(setAvailability.mock.calls[0][0]).toEqual({
      weekly_schedule: { ...ROW.weekly_schedule, sunday: [{ start: '09:00', end: '17:00' }] },
      timezone: 'Asia/Kolkata', buffer_minutes: 15, blocked_dates: ['2099-12-25'],
      cap_per_day: null, cap_per_week: null, cap_per_guest: null,
    });
  });

  it('edits a day in its sheet and copies its hours to other days', async () => {
    getAvailability.mockResolvedValue({ data: ROW });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Monday hours' }));
    const sheet = await screen.findByRole('dialog', { name: 'Monday' });
    expect(sheet.querySelectorAll('select')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Wednesday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy to 1 day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText(/open 24 hours a week/)).toBeTruthy();
  });

  it('picks days off on the Kept calendar and toggles them back', async () => {
    getAvailability.mockResolvedValue({ data: ROW });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Add days off/ }));
    const cal = await screen.findByRole('group', { name: 'Pick days off' });
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const day = cal.querySelector('button[aria-pressed="false"]:not([disabled])');
    fireEvent.click(day);
    expect(day.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(day);
    expect(day.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens on the first-time band when there is no record yet', async () => {
    getAvailability.mockResolvedValue({ data: null });
    mount();
    expect(await screen.findByText(/can.t book you yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Mon–Fri, 9 to 5/ }));
    expect(await screen.findByText(/open 40 hours a week/)).toBeTruthy();
  });

  it('shows an error with retry instead of an editable empty week when loading fails', async () => {
    getAvailability.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: ROW });
    mount();
    expect(await screen.findByText("We couldn't load your schedule.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/open 16 hours a week/)).toBeTruthy();
  });
});
