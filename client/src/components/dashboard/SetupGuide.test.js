import { describe, it, expect } from 'vitest';
import { buildSetupSteps } from './SetupGuide';

// Every step must come from real state, and KYC in review counts as done
// (nagging a host who already submitted is noise; payouts still wait on approval).
describe('buildSetupSteps', () => {
  const base = { hasService: false, availabilitySet: false, user: {}, kyc: null, linkShared: false };

  it('starts with nothing done, in go-live order', () => {
    const steps = buildSetupSteps(base);
    expect(steps.map((s) => s.key)).toEqual(['service', 'availability', 'page', 'payouts', 'share']);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it('marks each step from its own signal', () => {
    const steps = buildSetupSteps({
      hasService: true, availabilitySet: true, linkShared: true,
      user: { profile_image: 'x.jpg', bio: 'Coach' }, kyc: { status: 'submitted' },
    });
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it('names held money on the payouts step', () => {
    const pay = buildSetupSteps({ ...base, kyc: { status: 'not_started', pending_earnings: 1424.05 } }).find((s) => s.key === 'payouts');
    expect(pay.done).toBe(false);
    expect(pay.body).toMatch(/₹1,424 is waiting/);
  });

  it('needs both a photo and a bio for the page step', () => {
    const page = buildSetupSteps({ ...base, user: { profile_image: 'x.jpg' } }).find((s) => s.key === 'page');
    expect(page.done).toBe(false);
  });
});
