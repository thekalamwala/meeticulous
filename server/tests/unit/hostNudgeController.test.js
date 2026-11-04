'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({}));
jest.mock('../../services/proTaste', () => ({}));

const { DISMISSIBLE } = require('../../controllers/hostNudgeController');

describe('host nudge dismissal', () => {
  it('allows the calendar nudge to be dismissed', () => {
    expect(DISMISSIBLE.has('calendar')).toBe(true);
  });
  it('never allows kyc', () => {
    expect(DISMISSIBLE.has('kyc')).toBe(false);
  });
});
