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
    expect(html).toContain('#FBE3E8'); // paid tone bg (crimson tint)
    expect(C.statusTags([])).toBe('');
  });

  test('amountRow / banner / countdown / celebration return strings with content', () => {
    expect(C.amountRow(green, 'Earnings', '₹2,000')).toContain('₹2,000');
    expect(C.banner(slate, { title: 'Cancelled' })).toContain('Cancelled');
    expect(C.countdown(green, { lead: 'in', big: '2 hours' })).toContain('2 hours');
    expect(C.celebration(green, { title: 'Nice!' })).toContain('Nice!');
  });

  test('bookingCard shows mark, title, sub and rows', () => {
    const html = C.bookingCard({ title: 'Consult', sub: 'with Asha', rows: [['Date', 'Mon'], ['Time', '10 AM']] });
    expect(html).toContain('meeticulous-icon-color-512.png');
    expect(html).toContain('Consult');
    expect(html).toContain('with Asha');
    expect(html).toContain('10 AM');
  });

  test('signOff renders the initial avatar + name/role, escaped', () => {
    const html = C.signOff('Tithi', 'Meeticulous team');
    expect(html).toContain('>T<');
    expect(html).toContain('Meeticulous team');
    expect(C.signOff('<b>', 'x')).not.toContain('<b><');
  });

  test('helpers escape HTML in user-supplied values', () => {
    expect(C.banner(slate, { title: '<script>x</script>' })).not.toContain('<script>');
  });

  test('inner blocks use the 10px box radius (2026-11 redesign)', () => {
    const html = C.heroDate(green, { day: '1', mon: 'JAN', year: '2026', title: 'x', time: 'y' });
    expect(html).toMatch(/border-radius:10px/);
    expect(html).not.toMatch(/border-radius:1px/);
  });
});
