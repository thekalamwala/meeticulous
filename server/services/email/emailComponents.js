/**
 * emailComponents.js — accent-aware hero-block helpers for email bodies.
 *
 * Each helper returns an Outlook-safe HTML string (nested tables, solid hex,
 * 1px radius, PNG-only imagery). Helpers that take a `theme` read accent/tint/text
 * from emailThemes so a template body never hardcodes a color. User-supplied
 * values are HTML-escaped here; {{placeholders}} pass through untouched and are
 * resolved later by placeholderResolver.
 */

'use strict';

const FONT = "'Poppins','Plus Jakarta Sans',Arial,sans-serif";

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Semantic status-tag tones — fixed, independent of the email accent.
const TONES = {
  paid:      { bg: '#fff4ed', fg: '#b8410f' },
  online:    { bg: '#f1f3f4', fg: '#5f6368' },
  offline:   { bg: '#f1f3f4', fg: '#5f6368' },
  confirmed: { bg: '#e8fff1', fg: '#056800' },
  completed: { bg: '#e8fff1', fg: '#056800' },
  cancelled: { bg: '#fdeceb', fg: '#a32d2d' },
  pending:   { bg: '#fdf2dd', fg: '#854f0b' },
};

/** Row of semantic status tags. tags: [{label, tone}]. Empty input → ''. */
function statusTags(tags = []) {
  const cells = (tags || []).filter((t) => t && t.label).map((t) => {
    const tone = TONES[String(t.tone || '').toLowerCase()] || TONES.online;
    return `<td style="padding-right:6px;"><span style="display:inline-block;border-radius:12px;padding:5px 10px;font-size:12px;font-weight:600;background:${tone.bg};color:${tone.fg};font-family:${FONT};">${esc(t.label)}</span></td>`;
  }).join('');
  return cells ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr>${cells}</tr></table>` : '';
}

/** Big letter-spaced code on a tinted block. Empty when no code. */
function otpBox(theme, code) {
  if (!code) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td align="center" style="background:${theme.tint};border-radius:12px;padding:20px;">
    <span style="font-size:34px;font-weight:700;letter-spacing:8px;color:${theme.text};font-family:${FONT};">${esc(code)}</span>
  </td></tr></table>`;
}

/** Solid accent date square + service/time. */
function heroDate(theme, { day, mon, year, title, time, sub } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border:1px solid #edf0f2;border-radius:12px;"><tr>
    <td width="84" valign="middle" style="background:${theme.accent};color:#ffffff;text-align:center;padding:16px 6px;">
      <div style="font-size:30px;font-weight:700;line-height:1;font-family:${FONT};">${esc(day)}</div>
      <div style="font-size:12px;letter-spacing:1px;font-family:${FONT};">${esc(mon)} ${esc(year)}</div>
    </td>
    <td valign="middle" style="padding:14px 16px;">
      <div style="font-size:16px;font-weight:600;color:#202124;font-family:${FONT};">${esc(title)}</div>
      <div style="font-size:13px;color:#5f6368;padding-top:3px;font-family:${FONT};">${esc(time)}${sub ? ' &middot; ' + esc(sub) : ''}</div>
    </td>
  </tr></table>`;
}

/** Highlighted money strip (e.g. host earnings). */
function amountRow(theme, label, value) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;background:${theme.tint};border-radius:12px;"><tr>
    <td style="padding:12px 14px;font-size:13px;color:${theme.text};font-family:${FONT};">${esc(label)}</td>
    <td align="right" style="padding:12px 14px;font-size:18px;font-weight:700;color:${theme.accent};font-family:${FONT};">${esc(value)}</td>
  </tr></table>`;
}

/**
 * Accent key/value detail card. rows: [[label, value], ...].
 * Clean card (white, hairline border + left accent, rounded); label left, value
 * right-aligned; hairline divider between rows, none after the last.
 */
function infoCard(theme, rows = []) {
  const list = (rows || []).filter(Boolean);
  const body = list.map(([k, v], i) => {
    const bb = i === list.length - 1 ? '' : 'border-bottom:1px solid #eef1f5;';
    return `<tr>` +
      `<td style="padding:11px 0;${bb}font-size:13px;color:#6b7280;font-family:${FONT};vertical-align:top;">${esc(k)}</td>` +
      `<td align="right" style="padding:11px 0;${bb}font-size:14px;color:#111827;font-weight:600;font-family:${FONT};vertical-align:top;">${esc(v)}</td>` +
      `</tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;border:1px solid #edf0f2;border-left:3px solid ${theme.accent};border-radius:12px;background:#ffffff;"><tr><td style="padding:4px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr></table>`;
}

/** "Your session starts / soon" tinted strip. */
function countdown(theme, { lead, big } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:12px;"><tr><td align="center" style="padding:18px;">
    <div style="font-size:13px;color:${theme.text};font-family:${FONT};">${esc(lead)}</div>
    <div style="font-size:22px;font-weight:700;color:${theme.accent};padding-top:3px;font-family:${FONT};">${esc(big)}</div>
  </td></tr></table>`;
}

/** Full-width accent-tint banner with optional sub-line. */
function banner(theme, { title, sub } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:12px;"><tr><td style="padding:14px 16px;">
    <div style="font-size:15px;font-weight:600;color:${theme.text};font-family:${FONT};">${esc(title)}</div>
    ${sub ? `<div style="font-size:13px;color:${theme.text};padding-top:3px;font-family:${FONT};">${esc(sub)}</div>` : ''}
  </td></tr></table>`;
}

/** Celebratory medallion hero (achievement, milestone, birthday, welcome). */
function celebration(theme, { iconUrl, title } = {}) {
  const medal = iconUrl ? `<img src="${esc(iconUrl)}" width="40" height="40" alt="" style="display:block;margin:0 auto 8px;border:0;">` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:${theme.tint};border-radius:12px;"><tr><td align="center" style="padding:20px;">
    ${medal}<div style="font-size:17px;font-weight:600;color:${theme.text};font-family:${FONT};">${esc(title)}</div>
  </td></tr></table>`;
}

// ── Marketing blocks (conversion-centered design; CDN icons, no emoji/SVG) ──
// Icons live on the CDN, called by filename. Upload to /images/email/marketing/icons/.
const MKT_ICONS = 'https://meeticulous.com/images/email/marketing/icons';

/** Full-width gradient hero band (the "encapsulation" + big-number pattern).
 *  Pass `big` for a giant stat, or `h2` for a headline. Solid bgcolor fallback
 *  behind the gradient for Outlook. */
function heroBand(theme, { kick, big, sub, h2 } = {}) {
  const accent = theme.accent;
  const inner = big
    ? `<div style="font-family:${FONT};font-size:46px;line-height:1;font-weight:800;letter-spacing:-.02em;">${esc(big)}</div>`
    : (h2 ? `<div style="font-family:${FONT};font-size:28px;line-height:1.12;font-weight:800;">${esc(h2)}</div>` : '');
  // Solid accent band (no gradient — the style guide forbids gradients). White
  // text reads on every category accent + the brand maroon.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${accent}" style="margin:8px 0 16px;background:${accent};border-radius:12px;"><tr><td align="center" style="padding:30px 24px;">
    ${kick ? `<div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffffff;font-family:${FONT};margin-bottom:10px;">${esc(kick)}</div>` : ''}
    ${inner}
    ${sub ? `<div style="font-size:15px;color:#ffffff;font-family:${FONT};margin-top:12px;">${esc(sub)}</div>` : ''}
  </td></tr></table>`;
}

/** Two-column comparison (e.g. 5% vs 0%). Right column is the "win" (accent). */
function compareRow(theme, { leftLabel, leftPct, leftCap, rightLabel, rightPct, rightCap } = {}) {
  const cell = (label, pct, cap, win) => `<td width="50%" valign="top" style="padding:0 5px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${win ? theme.accent : '#edeaf5'};background:${win ? theme.tint : '#ffffff'};border-radius:12px;"><tr><td align="center" style="padding:15px 10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${win ? theme.text : '#9aa0a6'};font-family:${FONT};">${esc(label)}</div>
      <div style="font-family:${FONT};font-size:32px;font-weight:800;line-height:1;margin:7px 0 3px;color:${win ? theme.accent : '#9aa0a6'};">${esc(pct)}</div>
      <div style="font-size:11px;color:${win ? theme.text : '#9aa0a6'};font-family:${FONT};">${esc(cap)}</div>
    </td></tr></table>
  </td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr>${cell(leftLabel, leftPct, leftCap, false)}${cell(rightLabel, rightPct, rightCap, true)}</tr></table>`;
}

/** 3-up benefit grid. items: [{ icon:'link.png', label:'Your link' }]. */
function benefitGrid(items = []) {
  const cells = (items || []).slice(0, 3).map((it) => `<td width="33%" valign="top" align="center" style="padding:0 5px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #edeaf5;border-radius:12px;"><tr><td align="center" style="padding:14px 10px;">
      <img src="${MKT_ICONS}/${esc(it.icon)}" width="30" height="30" alt="" style="display:block;margin:0 auto;border:0;">
      <div style="font-size:12.5px;font-weight:600;color:#202124;font-family:${FONT};margin-top:9px;line-height:1.35;">${esc(it.label)}</div>
    </td></tr></table>
  </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 18px;"><tr>${cells}</tr></table>`;
}

/** Star-rating social-proof row. */
function stars({ rating = 5, text } = {}) {
  const one = `<img src="${MKT_ICONS}/star.png" width="16" height="16" alt="" style="display:inline-block;margin:0 1px;vertical-align:middle;border:0;">`;
  const row = one.repeat(Math.max(0, Math.min(5, Math.round(rating))));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td align="center">
    ${row}${text ? `<div style="font-size:12.5px;color:#5f6368;font-family:${FONT};margin-top:7px;">${esc(text)}</div>` : ''}
  </td></tr></table>`;
}

module.exports = { statusTags, otpBox, heroDate, amountRow, infoCard, countdown, banner, celebration, heroBand, compareRow, benefitGrid, stars, TONES, FONT, MKT_ICONS };
