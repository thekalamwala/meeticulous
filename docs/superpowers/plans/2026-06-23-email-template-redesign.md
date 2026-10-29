# Email Template Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every transactional email its own identity (accent + glyph + hero block) on a shared "Bold Blocks" skeleton — header + body only, footer untouched.

**Architecture:** One registry (`emailThemes.js`) maps each `email_category` to a color family + glyph. A helper library (`emailComponents.js`) renders accent-aware, Outlook-safe hero blocks. `emailLayout.js` header is rewritten (logo left / accent pill right); footer/shell/CTA stay byte-identical. The 31 template bodies in `emailTemplates.js` are rewritten to call the hero helpers. Re-seed pushes body changes to the DB.

**Tech Stack:** Node.js, plain CommonJS string-builders, Jest (`server/tests/unit`). No new deps.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `server/services/email/emailThemes.js` | category → `{family, accent, tint, text, glyph, glyphUrl}` registry + `themeForCategory()` | **create** |
| `server/services/email/emailComponents.js` | hero-block string helpers (otpBox, heroDate, statusTags, …) | **create** |
| `server/services/email/emailLayout.js` | header rewrite + theme resolution; footer/shell/CTA unchanged | **modify** |
| `server/config/emailTemplates.js` | rewrite 31 `html_content` bodies via helpers | **modify** |
| `server/tests/unit/emailThemes.test.js` | registry tests | **create** |
| `server/tests/unit/emailComponents.test.js` | helper tests | **create** |
| `server/tests/unit/emailLayout.test.js` | header tests + footer-unchanged regression guard | **modify** |

**Not in this plan (deploy step):** re-seed both DBs via `node scripts/seedEmailTemplates.js` (templates are LIVE — staged rollout). Icon PNGs are a founder asset dependency; code ships with a text-only pill fallback.

**Commands:** `cd server && npx jest tests/unit/<file>` (single), `cd server && npm test` (suite).

---

## Task 1: Theme registry (`emailThemes.js`)

**Files:**
- Create: `server/services/email/emailThemes.js`
- Test: `server/tests/unit/emailThemes.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/emailThemes.test.js
const { themeForCategory, CATEGORY_MAP, FAMILIES } = require('../../services/email/emailThemes');

describe('emailThemes', () => {
  test('every mapped category resolves to a 6-hex-color theme', () => {
    for (const cat of Object.keys(CATEGORY_MAP)) {
      const t = themeForCategory(cat);
      expect(t.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.tint).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.glyphUrl).toContain('/images/email/icons/');
    }
  });
  test('Security Check → slate shield-lock', () => {
    const t = themeForCategory('Security Check');
    expect(t.family).toBe('slate');
    expect(t.accent).toBe('#41506a');
    expect(t.glyphUrl).toBe('https://company-assets.meeticulous.in/images/email/icons/shield-lock.png');
  });
  test('unknown category → brand default, empty glyph (no broken image)', () => {
    const t = themeForCategory('Totally Unknown');
    expect(t.family).toBe('brand');
    expect(t.accent).toBe('#FE5100');
    expect(t.glyphUrl).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/emailThemes.test.js`
Expected: FAIL — `Cannot find module '../../services/email/emailThemes'`.

- [ ] **Step 3: Write the implementation**

```js
// server/services/email/emailThemes.js
'use strict';

// Semantic families — precomputed SOLID hex (no 8-digit alpha; Outlook-safe).
const FAMILIES = {
  slate:  { accent: '#41506a', tint: '#eef1f5', text: '#41506a' },
  green:  { accent: '#1aa463', tint: '#e8fff1', text: '#056800' },
  brand:  { accent: '#FE5100', tint: '#fff1ea', text: '#b8410f' },
  violet: { accent: '#6b4bb3', tint: '#f1ecfb', text: '#534ab7' },
  red:    { accent: '#d8453f', tint: '#fdeceb', text: '#a32d2d' },
  teal:   { accent: '#0f8a74', tint: '#e2f5f1', text: '#0f6e56' },
  blue:   { accent: '#2f7bd6', tint: '#e9f1fb', text: '#185fa5' },
  amber:  { accent: '#e89b1f', tint: '#fdf2dd', text: '#854f0b' },
  pink:   { accent: '#d4537e', tint: '#fbeaf0', text: '#993556' },
};

const ICON_BASE = 'https://company-assets.meeticulous.in/images/email/icons';

// email_category → family + glyph (see spec registry table).
const CATEGORY_MAP = {
  'Security Check':       { family: 'slate',  glyph: 'shield-lock' },
  'Security Alert':       { family: 'slate',  glyph: 'shield-alert' },
  'Booking Confirmed':    { family: 'green',  glyph: 'calendar-check' },
  'New Booking':          { family: 'brand',  glyph: 'calendar-plus' },
  'Reminder':             { family: 'violet', glyph: 'bell' },
  'Booking Cancelled':    { family: 'red',    glyph: 'circle-x' },
  'Session Complete':     { family: 'teal',   glyph: 'circle-check' },
  'Rescheduled':          { family: 'blue',   glyph: 'calendar-clock' },
  'Account Update':       { family: 'blue',   glyph: 'user-cog' },
  'Achievement Unlocked': { family: 'amber',  glyph: 'trophy' },
  'Payment Receipt':      { family: 'green',  glyph: 'credit-card' },
  'Community Update':     { family: 'pink',   glyph: 'gift' },
  'Welcome':              { family: 'brand',  glyph: 'sparkles' },
  'Product Feedback':     { family: 'blue',   glyph: 'message-dots' },
  'Newsletter':           { family: 'brand',  glyph: 'mail' },
};

const DEFAULT = { family: 'brand', glyph: '' };

/** Resolve a theme for an email_category. Never throws; unknown → brand, no glyph. */
function themeForCategory(category) {
  const m = CATEGORY_MAP[category] || DEFAULT;
  const fam = FAMILIES[m.family] || FAMILIES.brand;
  return {
    family: m.family,
    accent: fam.accent,
    tint: fam.tint,
    text: fam.text,
    glyph: m.glyph,
    glyphUrl: m.glyph ? `${ICON_BASE}/${m.glyph}.png` : '',
  };
}

module.exports = { themeForCategory, FAMILIES, CATEGORY_MAP, ICON_BASE };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/emailThemes.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/email/emailThemes.js server/tests/unit/emailThemes.test.js
git commit -m "feat(email): add category→theme registry (emailThemes)"
```

---

## Task 2: Hero-block helpers (`emailComponents.js`)

**Files:**
- Create: `server/services/email/emailComponents.js`
- Test: `server/tests/unit/emailComponents.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/emailComponents.test.js
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
  test('heroDate shows day/month and accent block', () => {
    const html = C.heroDate(green, { day: '16', mon: 'FEB', year: '2026', title: 'Consult', time: '10:15 AM' });
    expect(html).toContain('16');
    expect(html).toContain('Consult');
    expect(html).toContain(green.accent);
  });
  test('statusTags maps tones; empty array → empty string', () => {
    const html = C.statusTags([{ label: 'Paid', tone: 'paid' }, { label: 'Online', tone: 'online' }]);
    expect(html).toContain('Paid');
    expect(html).toContain('#fff4ed');   // paid tone bg
    expect(C.statusTags([])).toBe('');
  });
  test('amountRow / receipt / banner / countdown / celebration return strings with accent', () => {
    expect(C.amountRow(green, 'Earnings', '₹2,000')).toContain('₹2,000');
    expect(C.receipt(green, { amount: '₹2,360', rows: [['GST', '₹360']] })).toContain('₹2,360');
    expect(C.banner(slate, { title: 'Cancelled' })).toContain('Cancelled');
    expect(C.countdown(green, { lead: 'in', big: '2 hours' })).toContain('2 hours');
    expect(C.celebration(green, { title: 'Nice!' })).toContain('Nice!');
  });
  test('all helpers escape HTML in user values', () => {
    expect(C.banner(slate, { title: '<script>' })).not.toContain('<script>');
  });
  test('hero blocks use 1px radius only (no rounded inner blocks)', () => {
    const html = C.heroDate(green, { day: '1', mon: 'JAN', year: '2026', title: 'x', time: 'y' });
    expect(html).not.toMatch(/border-radius:\s*(?:[2-9]|1[0-9])px/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/emailComponents.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// server/services/email/emailComponents.js
'use strict';

const FONT = "'Poppins','Plus Jakarta Sans',Arial,sans-serif";

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Semantic status-tag tones — fixed, independent of email accent.
const TONES = {
  paid:      { bg: '#fff4ed', fg: '#b8410f' },
  online:    { bg: '#f1f3f4', fg: '#5f6368' },
  offline:   { bg: '#f1f3f4', fg: '#5f6368' },
  confirmed: { bg: '#e8fff1', fg: '#056800' },
  completed: { bg: '#e8fff1', fg: '#056800' },
  cancelled: { bg: '#fdeceb', fg: '#a32d2d' },
  pending:   { bg: '#fdf2dd', fg: '#854f0b' },
};

function statusTags(tags = []) {
  const cells = (tags || []).filter(Boolean).map((t) => {
    const tone = TONES[String(t.tone || '').toLowerCase()] || TONES.online;
    return `<td style="padding-right:6px;"><span style="display:inline-block;border-radius:1px;padding:5px 10px;font-size:12px;font-weight:600;background:${tone.bg};color:${tone.fg};font-family:${FONT};">${esc(t.label)}</span></td>`;
  }).join('');
  return cells ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr>${cells}</tr></table>` : '';
}

function otpBox(theme, code) {
  if (!code) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td align="center" style="background:${theme.tint};border-radius:1px;padding:20px;">
    <span style="font-size:34px;font-weight:700;letter-spacing:8px;color:${theme.text};font-family:${FONT};">${esc(code)}</span>
  </td></tr></table>`;
}

function heroDate(theme, { day, mon, year, title, time, sub } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border:1px solid #edf0f2;border-radius:1px;"><tr>
    <td width="84" valign="middle" style="background:${theme.accent};color:#ffffff;text-align:center;padding:16px 6px;">
      <div style="font-size:30px;font-weight:700;line-height:1;font-family:${FONT};">${esc(day)}</div>
      <div style="font-size:12px;letter-spacing:1px;font-family:${FONT};">${esc(mon)} ${esc(year)}</div>
    </td>
    <td valign="middle" style="padding:14px 16px;">
      <div style="font-size:16px;font-weight:600;color:#202124;font-family:${FONT};">${esc(title)}</div>
      <div style="font-size:13px;color:#5f6368;padding-top:3px;font-family:${FONT};">${esc(time)}${sub ? ' · ' + esc(sub) : ''}</div>
    </td>
  </tr></table>`;
}

function amountRow(theme, label, value) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;background:${theme.tint};border-radius:1px;"><tr>
    <td style="padding:12px 14px;font-size:13px;color:${theme.text};font-family:${FONT};">${esc(label)}</td>
    <td align="right" style="padding:12px 14px;font-size:18px;font-weight:700;color:${theme.accent};font-family:${FONT};">${esc(value)}</td>
  </tr></table>`;
}

function infoCard(theme, rows = []) {
  const body = (rows || []).filter(Boolean).map(([k, v]) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;font-family:${FONT};">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;font-family:${FONT};">${esc(v)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-left:3px solid ${theme.accent};background:#f9fafb;"><tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr></table>`;
}

function countdown(theme, { lead, big } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:1px;"><tr><td align="center" style="padding:18px;">
    <div style="font-size:13px;color:${theme.text};font-family:${FONT};">${esc(lead)}</div>
    <div style="font-size:22px;font-weight:700;color:${theme.accent};padding-top:3px;font-family:${FONT};">${esc(big)}</div>
  </td></tr></table>`;
}

function banner(theme, { title, sub } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:1px;"><tr><td style="padding:14px 16px;">
    <div style="font-size:15px;font-weight:600;color:${theme.text};font-family:${FONT};">${esc(title)}</div>
    ${sub ? `<div style="font-size:13px;color:${theme.text};padding-top:3px;font-family:${FONT};">${esc(sub)}</div>` : ''}
  </td></tr></table>`;
}

function receipt(theme, { amount, rows = [] } = {}) {
  const lines = (rows || []).filter(Boolean).map(([k, v]) =>
    `<tr><td style="padding:3px 0;font-size:13px;color:#5f6368;font-family:${FONT};">${esc(k)}</td><td align="right" style="padding:3px 0;font-size:13px;color:#202124;font-family:${FONT};">${esc(v)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td align="center" style="background:${theme.tint};border-radius:1px;padding:14px;">
    <div style="font-size:13px;color:${theme.text};font-family:${FONT};">Amount paid</div>
    <div style="font-size:22px;font-weight:700;color:${theme.text};font-family:${FONT};">${esc(amount)}</div>
  </td></tr>${lines ? `<tr><td style="padding:10px 2px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table></td></tr>` : ''}</table>`;
}

function celebration(theme, { iconUrl, title } = {}) {
  const medal = iconUrl ? `<img src="${esc(iconUrl)}" width="40" height="40" alt="" style="display:block;margin:0 auto 8px;border:0;">` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:1px;"><tr><td align="center" style="padding:20px;">
    ${medal}<div style="font-size:17px;font-weight:600;color:${theme.text};font-family:${FONT};">${esc(title)}</div>
  </td></tr></table>`;
}

function reviewStars(theme, n = 5, quote = '') {
  const k = Math.max(0, Math.min(5, Number(n) || 0));
  const stars = '★★★★★'.slice(0, k) + '☆☆☆☆☆'.slice(0, 5 - k);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:1px;"><tr><td align="center" style="padding:16px;">
    <div style="font-size:22px;letter-spacing:3px;color:${theme.accent};">${stars}</div>
    ${quote ? `<div style="font-size:13px;font-style:italic;color:${theme.text};padding-top:6px;font-family:${FONT};">&ldquo;${esc(quote)}&rdquo;</div>` : ''}
  </td></tr></table>`;
}

module.exports = { statusTags, otpBox, heroDate, amountRow, infoCard, countdown, banner, receipt, celebration, reviewStars, TONES, FONT };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/emailComponents.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/email/emailComponents.js server/tests/unit/emailComponents.test.js
git commit -m "feat(email): add accent-aware hero-block helpers (emailComponents)"
```

---

## Task 3: Header rewrite (`emailLayout.js`)

Logo LEFT (constant `FOOTER_LOGO`) + accent pill RIGHT (glyph + category). Footer/shell/CTA/`tint()` unchanged. The pill is the one true capsule (`border-radius:999px`).

**Files:**
- Modify: `server/services/email/emailLayout.js`
- Modify: `server/tests/unit/emailLayout.test.js`

- [ ] **Step 1: Read the current header + footer to preserve footer output exactly**

Run: read `server/services/email/emailLayout.js` (functions `headerBlock`, `renderCustomerLayout`, `renderVendorLayout`). Capture the current customer footer HTML substring for the regression guard.

- [ ] **Step 2: Write the failing/updated test**

```js
// add to server/tests/unit/emailLayout.test.js
const { renderLayout } = require('../../services/email/emailLayout');

const baseSettings = { brand_color: '#FE5100', from_name: 'Meeticulous', logo_url: 'x', website_url: 'https://meeticulous.in', support_email: 's@x.com' };

test('header: footer-logo on the left, accent pill with category on the right', () => {
  const html = renderLayout({ audience: 'customer', bodyHtml: '<p>hi</p>', emailCategory: 'Booking Confirmed', settings: baseSettings, data: {} });
  expect(html).toContain('images/email/footer-logo.png');        // left logo (constant)
  expect(html).toContain('Booking Confirmed');                   // pill label
  expect(html).toContain('#e8fff1');                             // green tint (pill bg)
  expect(html).toContain('images/email/icons/calendar-check.png'); // glyph
  expect(html).toContain('border-radius:999px');                 // true pill
});

test('header pill degrades to text-only when category has no glyph', () => {
  const html = renderLayout({ audience: 'customer', bodyHtml: '<p>hi</p>', emailCategory: 'Nope', settings: baseSettings, data: {} });
  expect(html).toContain('Nope');
  expect(html).not.toContain('/icons/.png');
});

test('FOOTER REGRESSION: customer footer block is unchanged', () => {
  const html = renderLayout({ audience: 'customer', bodyHtml: '<p>hi</p>', emailCategory: 'Booking Confirmed', settings: baseSettings, data: { unsubscribe_token: 'T' } });
  expect(html).toContain('My Bookings');
  expect(html).toContain('Timewheel Internet (P) Ltd');
  expect(html).toContain('unsubscribe?u=T');
});
```

- [ ] **Step 3: Run test to verify the header tests fail**

Run: `cd server && npx jest tests/unit/emailLayout.test.js`
Expected: FAIL on header assertions (old header has no footer-logo/pill); footer regression test PASSES already.

- [ ] **Step 4: Rewrite `headerBlock` and wire the theme**

At the top of `emailLayout.js` add: `const { themeForCategory } = require('./emailThemes');`

Replace the `headerBlock(...)` function with:

```js
/** Header: constant Meeticulous logo (left) + accent category pill (right). */
function headerBlock({ category, theme }) {
  const glyph = theme.glyphUrl
    ? `<img src="${esc(theme.glyphUrl)}" width="14" height="14" alt="" style="vertical-align:-2px;margin-right:5px;border:0;display:inline-block;">`
    : '';
  const pill = category
    ? `<td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:12px;">
         <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${theme.tint};color:${theme.text};font-size:12px;font-weight:600;font-family:${D.font};">${glyph}${esc(category)}</span>
       </td>`
    : '';
  return `<tr>
    <td style="padding:18px 28px;border-bottom:1px solid ${D.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="left" style="vertical-align:middle;">
          <img src="${esc(FOOTER_LOGO)}" alt="Meeticulous" height="26" style="display:block;border:0;height:26px;">
        </td>
        ${pill}
      </tr></table>
    </td>
  </tr>`;
}
```

In `renderCustomerLayout` and `renderVendorLayout`, replace the existing `headerBlock({...})` call with:

```js
const theme = themeForCategory(emailCategory);
const header = headerBlock({ category: emailCategory, theme });
```

Ensure `emailCategory` is destructured into both layout functions (add it to their params alongside `bodyHtml`). `renderLayout` already passes `emailCategory` via `subLabel`; pass `emailCategory` explicitly in the `args` object instead and read it in both layouts. Remove the now-unused `subLabel`/`chip` plumbing from the header only (leave footer code untouched).

- [ ] **Step 5: Run test to verify pass**

Run: `cd server && npx jest tests/unit/emailLayout.test.js`
Expected: PASS (header + footer-regression).

- [ ] **Step 6: Commit**

```bash
git add server/services/email/emailLayout.js server/tests/unit/emailLayout.test.js
git commit -m "feat(email): rewrite header (logo left, accent pill right); footer unchanged"
```

---

## Task 4: Rewrite the 31 template bodies (`emailTemplates.js`)

Each body builds its hero block from its category theme. Prose helpers stay but `eyebrow` takes the theme text color (not `{{brand_color}}`, which is reserved for the CTA).

**Files:**
- Modify: `server/config/emailTemplates.js`
- Test: `server/tests/unit/emailComponents.test.js` (add a render-integration block) — or a new `server/tests/unit/emailBodies.test.js`.

- [ ] **Step 1: Add imports + update prose helpers at the top of `emailTemplates.js`**

```js
const { themeForCategory } = require('../services/email/emailThemes');
const C = require('../services/email/emailComponents');

// eyebrow now takes an explicit accent color (per-category), not {{brand_color}}.
const eyebrow = (color, t) => `<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${color};font-family:'Poppins','Plus Jakarta Sans',Arial,sans-serif;">${t}</p>`;
```

Keep `lead`, `h`, `note` as-is. Remove the old `card`/`detail` only after every template that used them is migrated (Step 3); until then leave them so the file stays runnable.

- [ ] **Step 2: Write the render-integration test (failing)**

```js
// server/tests/unit/emailBodies.test.js
const TEMPLATES = require('../../config/emailTemplates');
const { renderEmail } = require('../../services/email/communicationEngine');

const settings = { brand_color: '#FE5100', from_name: 'Meeticulous', logo_url: 'x', website_url: 'https://meeticulous.in', support_email: 's@x.com' };

test('every template renders with no leftover {{tokens}} and an orange CTA when it has one', () => {
  for (const t of TEMPLATES) {
    const data = { otp: '123456', booking_date: '16 Feb 2026', booking_time: '10:15 AM', service_name: 'Consult', vendor_name: 'Shubham', user_name: 'Naman', amount: '₹2,360', plan_name: 'Pro', expiry_date: '1 Mar', badge_name: 'Star', badge_description: 'x', milestone_value: '10', completion_percentage: '80', verification_status: 'approved', feedback_subject: 'x', status_label: 'Reviewing', admin_response: 'ok', login_time: 'now', ip_address: '1.1.1.1', device_name: 'Chrome', location: '' };
    const { html } = renderEmail(t, { data, user: { name: 'Naman Acharya', email: 'n@x.com' }, settings, audience: t.audience });
    expect(html).not.toMatch(/\{\{[a-z_]+\}\}/i);
    if (t.cta_label) expect(html).toContain('#FE5100'); // CTA brand orange
  }
});

test('OTP email contains the otpBox in slate', () => {
  const otp = TEMPLATES.find((x) => x.event_key === 'BOOKING_OTP');
  const { html } = renderEmail(otp, { data: { otp: '131289' }, user: {}, settings, audience: 'all' });
  expect(html).toContain('131289');
  expect(html).toContain('#eef1f5'); // slate tint
});
```

- [ ] **Step 3: Convert each body using this recipe + the conversion table**

Recipe per template: compute `const t = themeForCategory('<email_category>')`, then build `html_content` as `eyebrow(t.text, '<label>') + h('<heading>') + lead('<intro>') + <HERO> + note('<footnote>')`. Use `{{placeholders}}` exactly as before inside helper string args.

**Worked example — OTP (`BOOKING_OTP`):**
```js
(() => { const t = themeForCategory('Security Check'); return {
  event_key: 'BOOKING_OTP', audience: 'all', category: 'Authentication',
  name: 'OTP Verification', subject: 'Your verification code is {{otp}}',
  preview_text: 'Use {{otp}} to verify — expires in 10 minutes.',
  email_category: 'Security Check',
  email_reason: 'You are receiving this email because a sign-in verification was requested for your account.',
  html_content:
    eyebrow(t.text, 'Verification') + h('Your verification code') +
    lead('Enter this code to verify your identity. It expires in <strong>10 minutes</strong>.') +
    C.otpBox(t, '{{otp}}') +
    note("If you didn't request this, you can safely ignore this email."),
  cta_label: '', cta_url: '',
}; })(),
```

**Worked example — Booking Confirmed (`BOOKING_CONFIRMED_CUSTOMER`):**
```js
(() => { const t = themeForCategory('Booking Confirmed'); return {
  event_key: 'BOOKING_CONFIRMED_CUSTOMER', audience: 'all', category: 'Booking',
  name: 'Booking Confirmed — Customer', subject: 'Your booking with {{vendor_name}} is confirmed',
  preview_text: 'Your appointment with {{vendor_name}} is confirmed.',
  email_category: 'Booking Confirmed',
  email_reason: 'You are receiving this email because you made a booking on Meeticulous.',
  html_content:
    eyebrow(t.text, 'Booking confirmed') + h("You're all set, {{first_name}}") +
    lead('Your appointment is confirmed:') +
    C.heroDate(t, { day: '{{booking_day}}', mon: '{{booking_month}}', year: '{{booking_year}}', title: '{{service_name}}', time: '{{booking_time}}', sub: 'with {{vendor_name}}' }) +
    C.statusTags([{ label: 'Confirmed', tone: 'confirmed' }, { label: '{{booking_mode}}', tone: 'online' }]),
  cta_label: 'View booking', cta_url: '{{dashboard_url}}',
}; })(),
```

> **Placeholder note:** `heroDate` needs `{{booking_day}}/{{booking_month}}/{{booking_year}}`. If callers only send `{{booking_date}}`, EITHER (a) keep `heroDate` but pass `day:'{{booking_date}}'` into a single-cell variant, OR (b) add a tiny date-split in the notify layer. Simplest for now: pass `title:'{{service_name}}'`, `time:'{{booking_date}} at {{booking_time}}'`, and set `day/mon` from a new optional `{{booking_day}}`/`{{booking_month}}` that fall back to empty (the block still renders). Confirm available booking placeholders in `server/utils/notify.js` before finalizing; do not invent tokens callers don't send.

**Worked example — Payment Receipt (`SUBSCRIPTION_PURCHASED`):**
```js
(() => { const t = themeForCategory('Payment Receipt'); return {
  event_key: 'SUBSCRIPTION_PURCHASED', audience: 'all', category: 'Subscription',
  name: 'Premium Activated', subject: 'Your {{plan_name}} plan is active',
  preview_text: 'Welcome to {{plan_name}} — your upgrades are live.',
  email_category: 'Payment Receipt',
  email_reason: 'You are receiving this email because you made a purchase on Meeticulous.',
  html_content:
    eyebrow(t.text, 'Subscription') + h('Welcome to {{plan_name}}!') +
    lead('Your {{plan_name}} plan is now active. All features are unlocked on your dashboard.') +
    C.receipt(t, { amount: '{{amount}}', rows: [['Plan', '{{plan_name}}'], ['Renews', '{{expiry_date}}']] }),
  cta_label: 'Explore features', cta_url: '{{dashboard_url}}',
}; })(),
```

**Conversion table (all 31) — hero helper per template:**

| event_key | email_category | Hero helper call |
|---|---|---|
| BOOKING_OTP | Security Check | `otpBox(t,'{{otp}}')` |
| AUTH_EMAIL_VERIFICATION | Security Check | none (CTA only) |
| PASSWORD_RESET | Security Check | `otpBox(t,'{{otp}}')` |
| SECURITY_PASSWORD_CHANGED | Security Alert | `banner(t,{title:'Password changed',sub:'for {{email}}'})` |
| SECURITY_LOGIN_ALERT | Security Alert | `infoCard(t,[['Time','{{login_time}}'],['IP address','{{ip_address}}'],['Device','{{device_name}}']])` |
| BOOKING_CONFIRMED_CUSTOMER | Booking Confirmed | `heroDate(...)` + `statusTags([Confirmed,mode])` |
| BOOKING_CONFIRMED_VENDOR | New Booking | `infoCard(t,[['Service'..],['Client'..],['When'..]])` + `statusTags([Paid?,mode])` |
| BOOKING_REMINDER_CUSTOMER | Reminder | `countdown(t,{lead:'Your session starts',big:'soon'})` + `infoCard(...)` |
| BOOKING_REMINDER_VENDOR | Reminder | `countdown(...)` + `infoCard(...)` |
| BOOKING_CANCELLED_CUSTOMER | Booking Cancelled | `banner(t,{title:'Booking cancelled',sub:'{{service_name}}'})` + `infoCard(...)` |
| BOOKING_CANCELLED_VENDOR | Booking Cancelled | `banner(...)` + `infoCard(...)` |
| BOOKING_COMPLETED_CUSTOMER | Session Complete | `infoCard(...)` + review prompt (`lead`) |
| BOOKING_COMPLETED_VENDOR | Session Complete | `infoCard(...)` |
| BOOKING_RESCHEDULED_CUSTOMER | Rescheduled | `heroDate(...)` (new time) |
| BOOKING_RESCHEDULED_VENDOR | Rescheduled | `infoCard(...)` (new time) |
| PROFILE_COMPLETION_REMINDER | Account Update | none (CTA only) |
| PROFILE_VERIFIED | Account Update | `banner(t,{title:'Verified',sub:'{{verification_status}}'})` |
| PROFILE_REJECTED | Account Update | `banner(t,{title:'Needs attention',sub:'{{verification_status}}'})` |
| BADGE_UNLOCKED | Achievement Unlocked | `celebration(t,{title:'{{badge_name}}'})` |
| MILESTONE_FIRST_BOOKING | Achievement Unlocked | `celebration(t,{title:'First booking!'})` |
| MILESTONE_10_BOOKINGS | Achievement Unlocked | `celebration(t,{title:'{{milestone_value}} bookings'})` |
| MILESTONE_50_BOOKINGS | Achievement Unlocked | `celebration(t,{title:'{{milestone_value}} bookings'})` |
| MILESTONE_100_BOOKINGS | Achievement Unlocked | `celebration(t,{title:'{{milestone_value}} bookings'})` |
| SUBSCRIPTION_PURCHASED | Payment Receipt | `receipt(t,{amount:'{{amount}}',rows:[['Plan'..],['Renews'..]]})` |
| SUBSCRIPTION_EXPIRING | Account Update | `banner(t,{title:'Expires {{expiry_date}}'})` |
| SUBSCRIPTION_RENEWED | Payment Receipt | `receipt(t,{amount:'{{amount}}',rows:[['Plan'..],['Renews'..]]})` |
| BIRTHDAY | Community Update | `celebration(t,{title:'Happy birthday, {{first_name}}!'})` |
| ACCOUNT_ANNIVERSARY | Community Update | `celebration(t,{title:'Happy anniversary!'})` |
| VENDOR_WELCOME | Welcome | `celebration(t,{title:'Welcome aboard!'})` |
| FEEDBACK_STATUS_CHANGED | Product Feedback | `banner(t,{title:'{{status_label}}'})` + `infoCard(...)` |
| NEWSLETTER_WELCOME | Newsletter | none (editorial `lead` only) |

> For helpers needing `{{amount}}`, confirm the placeholder is sent by the caller; if not, use the existing token (e.g. `{{plan_name}}` price) or omit the amount line. Do not invent tokens.

- [ ] **Step 4: Remove the dead `card`/`detail` helpers if no longer referenced**

After converting, grep `server/config/emailTemplates.js` for `card(` / `detail(`. If zero hits, delete those two helper definitions. If any remain, keep them.

- [ ] **Step 5: Run the body tests + full email suite**

Run: `cd server && npx jest tests/unit/emailBodies.test.js tests/unit/emailLayout.test.js tests/unit/emailComponents.test.js tests/unit/emailThemes.test.js`
Expected: PASS, no leftover `{{tokens}}`.

- [ ] **Step 6: Commit (in groups of ~6 templates for reviewable diffs)**

```bash
git add server/config/emailTemplates.js server/tests/unit/emailBodies.test.js
git commit -m "feat(email): rewrite template bodies with per-category hero blocks"
```

---

## Task 5: Full suite + deploy notes

- [ ] **Step 1: Run the whole server suite**

Run: `cd server && npm test`
Expected: all green (email + everything else). Investigate any regression before proceeding.

- [ ] **Step 2: Lint / sanity**

Run: `cd server && node -e "require('./config/emailTemplates'); require('./services/email/emailLayout'); require('./services/email/emailComponents'); require('./services/email/emailThemes'); console.log('modules load OK')"`
Expected: `modules load OK`.

- [ ] **Step 3: Commit any test fixups**

```bash
git commit -am "test(email): suite green after redesign"
```

- [ ] **Step 4: Deploy notes (DO NOT auto-run against live DBs)**

Re-seed pushes the new bodies to the `email_templates` table. Run **after merge**, per environment:
```bash
# staging (Tokyo STAGING_PROJECT_REF) first → smoke test → prod (Mumbai PROD_PROJECT_REF)
cd server && node scripts/seedEmailTemplates.js
```
Then send one test email per family from the admin panel and verify in Gmail + Outlook (pill, glyph PNG once uploaded, hero block, 2px CTA, dark mode). Icons: upload the 15 PNGs from the spec appendix to `company-assets.meeticulous.in/images/email/icons/` — until then pills render text-only (expected).

---

## Self-Review

- **Spec coverage:** registry (T1), hero helpers (T2), header logo-left/pill-right + footer guard (T3), 31 bodies + CTA-orange + no-token (T4), suite + re-seed notes (T5). All spec sections covered.
- **Placeholder scan:** worked code for T1–T3; T4 uses recipe + 3 full examples + explicit per-template table (mechanical repetition intentionally tabulated, not hand-copied 31×). Flagged the real risk (date-split / `{{amount}}` tokens) with a "verify in notify.js, don't invent tokens" instruction rather than a silent assumption.
- **Type consistency:** helper signatures in T2 match calls in T3/T4 (`themeForCategory`, `otpBox(theme,code)`, `heroDate(theme,{...})`, `statusTags([{label,tone}])`, `infoCard(theme,[[k,v]])`, `receipt(theme,{amount,rows})`). `theme` object shape (`accent/tint/text/glyphUrl`) consistent throughout.
- **Open verification (carried into execution):** confirm booking date/amount placeholders actually sent by `server/utils/notify.js` before finalizing `heroDate`/`receipt` args.
