import { test, expect } from 'vitest';
import { parseCsv } from '../../../utils/parseCsv';
import { guessFields, mapRows, callbackPresets, countdown, formatPhone, fmtTimer, isTypingTarget, OUTCOMES, sendResultMessage, preferTracked, pendingPlan as plan2, addChip, categoryPitch, ago } from '../sales/coldCallUtils';

const CSV = 'Day,Priority,Business,Category,Locality,Phone,WhatsApp,Email,Fit,Website,Talking Point\n'
  + '"Day 1","1","Test Clinic","Dental clinic","Area","08888700000","https://wa.me/918888700000","a@b.co","99","https://x.in","Pitch, with comma"\n'
  + '"Day 1","2","No Phone","Spa","Area","","","","90","",""\n';

test('maps the calling-list headers and drops rows without a phone', () => {
  const grid = parseCsv(CSV);
  const fields = guessFields(grid[0]);
  expect(fields).toEqual(['day', 'priority', 'business', 'category', 'locality', 'phone', 'whatsapp', 'email', 'fit', 'website', 'pitch']);
  const rows = mapRows(grid, fields);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ day: 'Day 1', business: 'Test Clinic', phone: '08888700000', pitch: 'Pitch, with comma' });
});

test('unknown headers map to null and can be overridden', () => {
  const grid = [['Shop', 'Mobile No'], ['A', '9999900000']];
  expect(guessFields(grid[0])).toEqual([null, 'phone']);
  expect(mapRows(grid, ['business', 'phone'])[0]).toEqual({ business: 'A', phone: '9999900000' });
});

test('callback presets skip times already past', () => {
  const now = new Date(2026, 9, 6, 18, 0); // Tue 18:00 local
  const labels = callbackPresets(now).map((p) => p.label);
  expect(labels).toEqual(['In 1 hr', 'Tomorrow 11am', 'Mon 11am']);
  const morning = callbackPresets(new Date(2026, 9, 6, 9, 0)).map((p) => p.label);
  expect(morning).toContain('Today 5pm');
});

test('formatting helpers', () => {
  const now = new Date('2026-10-06T06:00:00Z');
  expect(countdown('2026-10-06T06:12:00Z', now)).toBe('due in 12 min');
  expect(countdown('2026-10-06T05:55:00Z', now)).toBe('overdue 5 min');
  expect(countdown('2026-10-06T08:30:00Z', now)).toBe('due in 2h 30m');
  expect(formatPhone('918888705552')).toBe('+91 88887 05552');
  expect(fmtTimer(95)).toBe('1:35');
  expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
  expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  expect(OUTCOMES.map((o) => o.hotkey)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
});

test('send results: queued-with-error is a retry, not a success; already_sent is info', () => {
  expect(sendResultMessage('email', { status: 'sent' })).toEqual({ kind: 'success', text: 'Email sent' });
  expect(sendResultMessage('whatsapp', { status: 'queued', reason: null })).toEqual({ kind: 'success', text: 'WhatsApp queued' });
  expect(sendResultMessage('email', { status: 'queued', reason: 'timeout' })).toEqual({ kind: 'error', text: 'Email not sent yet (retrying): timeout' });
  expect(sendResultMessage('email', { status: 'already_sent' })).toEqual({ kind: 'info', text: 'Email already sent earlier today' });
  expect(sendResultMessage('whatsapp', { status: 'skipped', reason: 'pending_aisensy' }).text).toBe('WhatsApp not sent: WhatsApp template not approved in AiSensy yet');
});

import { messageFor, previewText, safeUrl, pendingPlan, nextLeadId, fitReasons } from '../sales/coldCallUtils';

test('messageFor: outcome → follow-up set; missed-call message only on the first miss', () => {
  expect(messageFor('interested')).toBe('cold_call_interested');
  expect(messageFor('callback')).toBe('cold_call_callback');
  expect(messageFor('not_interested')).toBeNull();
  expect(messageFor('wrong_number')).toBeNull();
  expect(messageFor('no_answer', { no_answers: 1 })).toBe('cold_call_missed');
  expect(messageFor('no_answer', { no_answers: 2 })).toBeNull();
});

test('previewText fills tokens and flattens HTML (links shown as label + url)', () => {
  expect(previewText('Hi {{1}} team, call on {{2}}', { business: 'Bloom', callbackTime: 'Tue 5 pm' })).toBe('Hi Bloom team, call on Tue 5 pm');
  expect(previewText('<p>Hi {{business_name}},</p><p><a href="https://x.in">Go</a></p><ul><li>One</li></ul>', { business: 'Bloom' }))
    .toBe('Hi Bloom,\nGo (https://x.in)\n• One');
});

test('safeUrl only allows http(s)', () => {
  expect(safeUrl('javascript:alert(1)')).toBeNull();
  expect(safeUrl('bloom.in')).toBe('https://bloom.in/');
  expect(safeUrl('https://maps.google.com/?cid=1')).toBe('https://maps.google.com/?cid=1');
  expect(safeUrl('')).toBeNull();
});

test('pendingPlan orders callbacks → retries → new → later, de-duplicated; nextLeadId walks it', () => {
  const L = (id) => ({ lead: { id } });
  const plan = pendingPlan({ callbacksDue: [{ ...L('c'), dueAt: 'x' }], retries: [L('r'), L('c')], fresh: [L('n1'), L('n2')], upcoming: [L('u')] });
  expect(plan.map((p) => `${p.kind}:${p.lead.id}`)).toEqual(['callback:c', 'retry:r', 'new:n1', 'new:n2', 'later:u']);
  expect(nextLeadId(plan, 'r')).toBe('n1');
  expect(nextLeadId(plan, 'u')).toBe('c');
  expect(nextLeadId(plan, 'search-only')).toBe('c');
});

test('fitReasons only states facts we hold', () => {
  const r = fitReasons({ profession: 'Dental clinic', website: '', attributes: { cold_call: { rating: '4.5', reviews: '98', priority: 'P1' } } });
  expect(r).toEqual(['4.5★ with 98 Google reviews', 'Appointment-based business', 'No website: the booking page can be their web page', 'Top priority (P1)']);
  expect(fitReasons({ profession: 'Pet store', website: 'x.in', attributes: { cold_call: { rating: '3.9', reviews: '5' } } })).toEqual(['Has a website: add a "Book now" link to it']);
});

test('setup calls go right after due callbacks; only due ones', () => {
  const L = (id) => ({ lead: { id } });
  const p = plan2({ callbacksDue: [L('c')], setup: [{ ...L('s1'), due: true }, { ...L('s2'), due: false }], retries: [L('r')], fresh: [L('n')] });
  expect(p.map((x) => `${x.kind}:${x.lead.id}`)).toEqual(['callback:c', 'setup:s1', 'retry:r', 'new:n']);
});

test('note chips append; pitch by category; ago', () => {
  expect(addChip('', 'Asked price')).toBe('Asked price');
  expect(addChip('owner busy.', 'Call after 5')).toBe('owner busy; Call after 5');
  expect(categoryPitch('Dental clinic').title).toBe('Dental');
  expect(categoryPitch('Unisex Salon').title).toBe('Salon & beauty');
  expect(categoryPitch('Box cricket turf').title).toBe('Turf & sports');
  expect(categoryPitch('Hardware shop')).toBeNull();
  const now = new Date('2026-10-06T12:00:00Z');
  expect(ago('2026-10-06T11:50:00Z', now)).toBe('10 min ago');
  expect(ago('2026-10-06T09:00:00Z', now)).toBe('3 h ago');
});

test('interested uses the tracked-link set only once its WhatsApp is approved', () => {
  const wa = (is_active) => [{ channel: 'whatsapp', category: 'cold_call_link', is_active }];
  expect(preferTracked('cold_call_interested', wa(false))).toBe('cold_call_interested');
  expect(preferTracked('cold_call_interested', wa(true))).toBe('cold_call_link');
  expect(preferTracked('cold_call_details', wa(true))).toBe('cold_call_details');
  expect(preferTracked(null, wa(true))).toBeNull();
});
