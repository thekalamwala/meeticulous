const { customerKey, displayFromKey } = require('../../utils/customerKey');

describe('customerKey', () => {
  test('formats a spaced +91 phone to p:<10digits>', () => {
    expect(customerKey({ phone: '+91 98765 43210' })).toBe('p:9876543210');
  });

  test('strips punctuation from phone', () => {
    expect(customerKey({ phone: '98765-43210' })).toBe('p:9876543210');
  });

  test('drops leading 0 trunk prefix, keeps last 10', () => {
    expect(customerKey({ phone: '098765 43210' })).toBe('p:9876543210');
  });

  test('falls back to lowercased trimmed email when phone missing', () => {
    expect(customerKey({ email: 'Jane@X.COM ' })).toBe('e:jane@x.com');
  });

  test('phone wins over email when both present', () => {
    expect(customerKey({ phone: '9876543210', email: 'jane@x.com' })).toBe('p:9876543210');
  });

  test('junk phone + no email -> null', () => {
    expect(customerKey({ phone: '123' })).toBeNull();
  });

  test('nothing usable -> null', () => {
    expect(customerKey({})).toBeNull();
    expect(customerKey({ email: 'not-an-email' })).toBeNull();
  });

  test('displayFromKey inverts a phone key', () => {
    expect(displayFromKey('p:9876543210')).toEqual({ type: 'phone', value: '9876543210' });
  });

  test('displayFromKey inverts an email key', () => {
    expect(displayFromKey('e:jane@x.com')).toEqual({ type: 'email', value: 'jane@x.com' });
  });
});
