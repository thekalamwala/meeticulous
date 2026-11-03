'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() }, signInWithPassword: jest.fn() }));
jest.mock('../../utils/notify', () => ({ sendWhatsAppOtp: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/usernameService', () => ({
  usernameExists: jest.fn(), usernameOwner: jest.fn(), setOnboardingUsername: jest.fn(),
}));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { trackServer } = require('../../utils/trackServer');
const { getOnboardingStatus, skipCalendar } = require('../../controllers/vendorOnboardingController');

beforeEach(() => jest.clearAllMocks());

describe('getOnboardingStatus calendar state', () => {
  const wireRead = (row) => supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
  }));

  it('returns both booleans from the row', async () => {
    wireRead({ onboarding_step_completed: 2, google_calendar_connected: true, calendar_skipped: true });
    const s = await getOnboardingStatus('v1');
    expect(s.calendarConnected).toBe(true);
    expect(s.calendarSkipped).toBe(true);
  });

  it('coerces null columns to false', async () => {
    wireRead({ onboarding_step_completed: 2, google_calendar_connected: null, calendar_skipped: null });
    const s = await getOnboardingStatus('v1');
    expect(s.calendarConnected).toBe(false);
    expect(s.calendarSkipped).toBe(false);
  });
});

describe('skipCalendar', () => {
  it('writes only calendar_skipped for the given vendor and tracks it', async () => {
    const updates = []; const ids = [];
    supabaseAdmin.from.mockImplementation(() => ({
      update: (p) => { updates.push(p); return { eq: (c, id) => { ids.push([c, id]); return Promise.resolve({ error: null }); } }; },
    }));
    await skipCalendar('v1');
    expect(Object.keys(updates[0]).sort()).toEqual(['calendar_skipped', 'updated_at']);
    expect(updates[0].calendar_skipped).toBe(true);
    expect(ids).toEqual([['id', 'v1']]);
    expect(trackServer).toHaveBeenCalledWith('v1', 'calendar_step_skipped', {});
  });

  it('throws on a DB error and does not track', async () => {
    supabaseAdmin.from.mockImplementation(() => ({
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'boom' } }) }),
    }));
    await expect(skipCalendar('v1')).rejects.toMatchObject({ message: 'boom' });
    expect(trackServer).not.toHaveBeenCalled();
  });
});
