const C = require('../../services/email/emailComponents');
const { themeForCategory } = require('../../services/email/emailThemes');

const green = themeForCategory('Booking Confirmed');
const slate = themeForCategory('Security Check');

describe('emailComponents', () => {
  test('otpBox renders the code in the theme text color; empty when no code', () => {
    const html = C.otpBox(slate, '131289');
    expect(html).toContain('131289');
    expect(html).toContain(slate.text);
    expect(C.otpBox(slate, '')).toBe('');
  });

  test('heroDate shows day/title and the accent block', () => {
    const html = C.heroDate(green, { day: '16', mon: 'FEB', year: '2026', title: 'Consult', time: '10:15 AM' });
    expect(html).toContain('16');
    expect(html).toContain('Consult');
    expect(html).toContain(green.accent);
  });

  test('statusTags maps tones; empty array → empty string', () => {
    const html = C.statusTags([{ label: 'Paid', tone: 'paid' }, { label: 'Online', tone: 'online' }]);
    expect(html).toContain('Paid');
    expect(html).toContain('#fff4ed'); // paid tone bg
    expect(C.statusTags([])).toBe('');
  });

  test('amountRow / banner / countdown / celebration return strings with content', () => {
    expect(C.amountRow(green, 'Earnings', '₹2,000')).toContain('₹2,000');
    expect(C.banner(slate, { title: 'Cancelled' })).toContain('Cancelled');
    expect(C.countdown(green, { lead: 'in', big: '2 hours' })).toContain('2 hours');
    expect(C.celebration(green, { title: 'Nice!' })).toContain('Nice!');
  });

  test('helpers escape HTML in user-supplied values', () => {
    expect(C.banner(slate, { title: '<script>x</script>' })).not.toContain('<script>');
  });

  test('hero blocks use 1px radius only (no rounded inner blocks)', () => {
    const html = C.heroDate(green, { day: '1', mon: 'JAN', year: '2026', title: 'x', time: 'y' });
    expect(html).not.toMatch(/border-radius:\s*(?:[2-9]|1[0-9])px/);
  });
});
