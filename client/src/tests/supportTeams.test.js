import { describe, it, expect } from 'vitest';
import { teamForText, TEAM_LABEL } from '../utils/supportTeams';

describe('teamForText', () => {
  it('routes money + bugs/technical to CXO', () => {
    expect(teamForText('my payout is late')).toBe('cxo');
    expect(teamForText('where is my refund')).toBe('cxo');
    expect(teamForText('the page throws a 500 error')).toBe('cxo');
    expect(teamForText('subscription renewal charged twice')).toBe('cxo');
    expect(teamForText('invoice missing')).toBe('cxo');
  });
  it('routes everything else to Support', () => {
    expect(teamForText('how do I reschedule my booking')).toBe('support');
    expect(teamForText('cannot log in with OTP')).toBe('support');
    expect(teamForText('how do I change my photo')).toBe('support');
    expect(teamForText('')).toBe('support');
  });
  it('has a label for both teams', () => {
    expect(TEAM_LABEL.cxo).toBe('CXO');
    expect(TEAM_LABEL.support).toBe('Support');
  });
});
