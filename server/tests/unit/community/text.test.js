// botService pulls in the supabase client at load; stub it so the real redactPii is used without env.
jest.mock('../../../config/supabase', () => ({ supabaseAdmin: {} }));
const t = require('../../../services/community/text');

const draft = (o) => t.validateDraft({ kind: 'thread', format: 'text', title: 'T', body: 'b', ...o });

describe('validateDraft', () => {
  test('thread title required / too long', () => {
    expect(draft({ title: '' }).code).toBe('TITLE_REQUIRED');
    expect(draft({ title: 'x'.repeat(151) }).code).toBe('TITLE_TOO_LONG');
  });
  test('body limits', () => {
    expect(draft({ kind: 'post', title: null, body: 'x'.repeat(1001) }).code).toBe('BODY_TOO_LONG');
    expect(draft({ body: 'word '.repeat(2000).trim() }).ok).toBe(true);
    expect(draft({ body: '  ' }).code).toBe('BODY_REQUIRED');
  });
  test('post ignores title, trims', () => {
    expect(draft({ kind: 'post', title: 'ignored', body: ' hi ' })).toEqual({ ok: true, title: null, body: 'hi' });
  });
  test('runs safety on title+body', () => {
    expect(draft({ body: 'call 9876543210' }).code).toBe('CONTACT_NOT_ALLOWED');
    expect(draft({ title: 'see example.com' }).code).toBe('LINK_NOT_ALLOWED');
    expect(t.validateDraft({ kind: 'post', body: 'see example.com' }, { linksAllowed: true }).ok).toBe(true);
  });
});

describe('validateComment', () => {
  test('limits', () => {
    expect(t.validateComment('').code).toBe('BODY_REQUIRED');
    expect(t.validateComment('ab '.repeat(700)).code).toBe('BODY_TOO_LONG');
    expect(t.validateComment(' ok ')).toEqual({ ok: true, body: 'ok' });
    expect(t.validateComment('a@b.co').code).toBe('CONTACT_NOT_ALLOWED');
  });
});

describe('checkSafety', () => {
  test.each(['call +91 98765 43210', '098765-43210', '9876543210', 'mail me a@b.co'])('contact: %s', (s) => {
    expect(t.checkSafety(s).code).toBe('CONTACT_NOT_ALLOWED');
  });
  test('plain numbers/times pass', () => {
    expect(t.checkSafety('session at 5pm for ₹1499 in 2026')).toBeNull();
    expect(t.checkSafety('at 5.30pm, Rs.1499 only')).toBeNull();
  });
  test('blocked hosts always blocked', () => {
    expect(t.checkSafety('book https://wa.me/919876543210', { linksAllowed: true }).code).toBe('BLOCKED_LINK');
    expect(t.checkSafety('wa.me/123', { linksAllowed: true }).code).toBe('BLOCKED_LINK');
    expect(t.checkSafety('visit HTTPS://Sub.Calendly.com/x.', { linksAllowed: true }).code).toBe('BLOCKED_LINK');
  });
  test('link gating', () => {
    expect(t.checkSafety('see https://example.com', { linksAllowed: false }).code).toBe('LINK_NOT_ALLOWED');
    expect(t.checkSafety('see https://example.com', { linksAllowed: true })).toBeNull();
    expect(t.checkSafety('see www.example.com')).not.toBeNull();
  });
  test('missing space after a full stop is not a link', () => {
    for (const s of ['done.Thanks', 'Hi.How are you', 'Dr.Sharma said hi', 'Mumbai.Thanks', 'e.g.this', 'Ph.D.holder']) {
      expect(t.checkSafety(s, { linksAllowed: false })).toBeNull();
    }
    expect(t.checkSafety('visit example.com', { linksAllowed: false }).code).toBe('LINK_NOT_ALLOWED');
    expect(t.checkSafety('WA.ME/919876543210', { linksAllowed: true }).code).toBe('BLOCKED_LINK');
  });
  test('12-digit run is treated as contact (Aadhaar pattern, intentional)', () => {
    expect(t.checkSafety('booking id 123456789012').code).toBe('CONTACT_NOT_ALLOWED');
  });
  test('meeticulous.com always allowed', () => {
    expect(t.checkSafety('https://meeticulous.com/priya.', { linksAllowed: false })).toBeNull();
    expect(t.checkSafety('priya.meeticulous.com/x')).toBeNull();
    expect(t.checkSafety('notmeeticulous.com')).not.toBeNull();
  });
  test('adult terms', () => {
    expect(t.checkSafety('free porn here').code).toBe('BLOCKED_TERM');
    expect(t.checkSafety('Sussex analysis session')).toBeNull();
  });
});

describe('makeSlug / mentions / urls', () => {
  test('slug', () => {
    expect(t.makeSlug('How do I price my FIRST session?!')).toMatch(/^how-do-i-price-my-first-session-[a-z0-9]{6}$/);
    expect(t.makeSlug('')).toMatch(/^post-[a-z0-9]{6}$/);
    expect(t.makeSlug('🔥🔥')).toMatch(/^post-[a-z0-9]{6}$/);
    expect(t.makeSlug('one two three four five six seven eight nine ten')).toMatch(/^one-two-three-four-five-six-seven-eight-[a-z0-9]{6}$/);
    expect(t.makeSlug('a'.repeat(100)).length).toBeLessThanOrEqual(60 + 7);
  });
  test('mentions', () => {
    expect(t.extractMentions('hi @Priya-K and @priya-k')).toEqual(['priya-k']);
    expect(t.extractMentions('@priya-sharma and @user-98765')).toEqual(['priya-sharma', 'user-98765']);
    expect(t.extractMentions('hi @Priya-K.')).toEqual(['priya-k']);
    expect(t.extractMentions('thanks @priya-, see you')).toEqual(['priya']);
    expect(t.extractMentions('@priya_k is not a username')).toEqual([]);
    expect(t.extractMentions('mail a@b.co @ab')).toEqual([]);
  });
  test('urls', () => {
    expect(t.extractUrls('go https://a.com/x, and wa.me/1.')).toEqual(['https://a.com/x', 'wa.me/1']);
  });
  test('BLOCKED_LINK_HOSTS', () => expect(t.BLOCKED_LINK_HOSTS).toContain('wa.me'));
});

describe('toPlainText (community renders raw text)', () => {
  test('strips the inline marks the bot emits (the live Aastha-reply failure)', () => {
    const out = t.toPlainText('**Meeticulous** is a `booking` platform.\n\n- One link\n- Pay in one step');
    expect(out).not.toMatch(/\*|`/);                 // no bold/code markers survive
    expect(out).toContain('Meeticulous is a booking platform.');
    expect(out).toContain('• One link');
    expect(out).toContain('• Pay in one step');
  });
  test('internal link -> tappable bare URL; external kept; anchor -> label', () => {
    expect(t.toPlainText('[See plans](/pricing)')).toBe('See plans: meeticulous.com/pricing');
    expect(t.toPlainText('[Voyage](https://x.com/a)')).toBe('Voyage: https://x.com/a');
    expect(t.toPlainText('[top](#top)')).toBe('top');
  });
  test('headings, rules and fences gone; content + order preserved', () => {
    const out = t.toPlainText('## Title\n\n***\n\n```\ncode\n```\n\n> quote');
    expect(out).not.toMatch(/[#>`]|\*{2}|-{3}/);     // no heading/quote/fence/rule/bold syntax
    expect(out.replace(/\n+/g, ' ')).toBe('Title code quote');
  });
  test('plain text passes through unchanged', () => {
    expect(t.toPlainText('Not yet — single bookings only for now.')).toBe('Not yet — single bookings only for now.');
  });
});
