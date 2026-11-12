import { describe, it, expect } from 'vitest';
import { buildUpiUri } from '../utils/upi';

describe('buildUpiUri', () => {
  it('builds a full pay link with amount', () => {
    const uri = buildUpiUri({ pa: '8637758344@ybl', pn: 'Shubham', am: 200, tn: 'Community tip' });
    expect(uri).toContain('upi://pay?');
    expect(uri).toContain('pa=8637758344%40ybl');
    expect(uri).toContain('pn=Shubham');
    expect(uri).toContain('am=200.00');
    expect(uri).toContain('cu=INR');
    expect(uri).toContain('tn=Community%20tip');
  });

  it('omits the amount when it is missing, zero or not a number', () => {
    for (const am of [undefined, '', 0, -5, 'abc', NaN]) {
      expect(buildUpiUri({ pa: 'x@ybl', am })).not.toContain('am=');
    }
  });

  it('encodes spaces as %20, never +', () => {
    const uri = buildUpiUri({ pa: 'x@ybl', pn: 'A B', tn: 'c d' });
    expect(uri).not.toContain('+');
    expect(uri).toContain('pn=A%20B');
    expect(uri).toContain('tn=c%20d');
  });

  it('returns empty string when there is no payee VPA', () => {
    expect(buildUpiUri({ pa: '', am: 100 })).toBe('');
    expect(buildUpiUri({})).toBe('');
    expect(buildUpiUri()).toBe('');
  });
});
