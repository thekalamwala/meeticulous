/**
 * emailLayout.js — recipient-driven email shells.
 *
 * Three layouts, selected by the RECIPIENT audience (not the template row tag):
 *   • customer → Meeticulous-branded header, nav + legal footer (new users:
 *                build platform trust, give navigation + legal unsubscribe).
 *   • vendor   → host-branded header (host's own logo/name), minimal
 *                "Powered by Meeticulous" footer (they already know the brand).
 *   • cold     → NO header chrome, legal-floor footer only (sender + address +
 *                unsubscribe). Founder cold outreach: reads like a 1:1 note.
 *
 * renderLayout({ audience, ... }) dispatches:
 *   'vendor'                      → renderVendorLayout
 *   'cold'                        → renderColdLayout
 *   'customer' | 'all' | missing  → renderCustomerLayout (safe default; it is
 *                                   platform-branded and carries unsubscribe)
 *
 * Shared private helpers (accent bar, card wrapper, CTA, header block, escaping)
 * keep the two variants from drifting — they differ ONLY in header logo source
 * and footer content.
 *
 * Email-client notes:
 *   • Table-based layout for Outlook / Gmail / Apple Mail / dark-mode.
 *   • Chip tint is a precomputed SOLID hex (brand blended toward white), NOT
 *     8-digit alpha hex — Outlook desktop does not render alpha hex.
 *   • Max width 600px. Design tokens inlined (no CSS custom properties in email).
 *
 * Placeholders are resolved BEFORE the layout runs (resolver only touches the
 * template body/subject/cta). So values the layout needs — host logo/name,
 * unsubscribe token — are read from `data`, NOT from {{tokens}}.
 */

'use strict';

const { themeForCategory } = require('./emailThemes');

const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

// Brand design tokens — Meeticulous email style guide (light).
// Ink/Body/Muted/Line are the guide's text + divider tokens; bg is the guide's
// blush Page color behind the card. Keep Poppins as the body face (brand decision
// to override the guide's Helvetica).
const D = {
  dark:   '#2B1218', // Ink — headlines, bold values
  muted:  '#7D6B70', // Muted — footer, labels, helper text
  sub:    '#7D6B70',
  border: '#F1DCE1', // Line — dividers
  bg:     '#FBF4F5', // Page — outer background behind the card
  cardBg: '#ffffff',
  white:  '#ffffff',
  note:   '#7D6B70',
  font:   "'Poppins','Plus Jakarta Sans',Arial,sans-serif",
};

// Fixed brand constants (legal entity, address, platform footer mark).
// NOTE: ADDRESS unchanged per founder instruction (postal address stays).
const COMPANY    = 'Rajmudra Media LLP';
const ADDRESS    = '2nd Floor, Eureka Coworking, Mate Square, Nagpur 440030';
const TAGLINE    = 'Booking Made Easy';
// TODO(pre-deploy): swap to the hosted Meeticulous logo URLs once the wordmark +
// icon are uploaded to a public CDN. Header = icon (~26px), footer = full wordmark
// (~160px). See docs/current-work.md "Email rebrand — pre-deploy blockers".
const HEADER_LOGO = 'https://company-assets.bookasloth.in/images/email/meeticulous-icon-color-512.png';
const FOOTER_LOGO = 'https://company-assets.bookasloth.in/images/email/meeticulous-wordmark-full-color.png';

/** Blend a #rrggbb color toward white. ratio 0 = original, 1 = white. */
function tint(hex, ratio) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#FFF4EE';
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ── Shared pieces ──────────────────────────────────────────────────────────

/** 4px brand accent bar at the top of the card. */
function accentBar(brand) {
  return `<tr><td style="height:4px;line-height:4px;font-size:0;background:${esc(brand)};">&nbsp;</td></tr>`;
}

/**
 * Header: constant Meeticulous logo (left) + accent category pill (right).
 * Header uses HEADER_LOGO; the footer uses FOOTER_LOGO (two distinct CDN assets).
 * The pill is the one true capsule (999px) — its
 * accent/tint/text + glyph come from the category theme.
 */
function headerBlock({ category, theme }) {
  const glyph = theme.glyphUrl
    ? `<img src="${esc(theme.glyphUrl)}" width="14" height="14" alt="" style="vertical-align:-2px;margin-right:5px;border:0;display:inline-block;">`
    : '';
  const pill = category
    ? `<td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:12px;">
         <span style="display:inline-block;padding:6px 12px;border-radius:1px;background:${theme.tint};color:${theme.text};font-size:12px;font-weight:600;font-family:${D.font};">${glyph}${esc(category)}</span>
       </td>`
    : '';
  return `<tr>
    <td style="padding:18px 28px;border-bottom:1px solid ${D.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="left" style="vertical-align:middle;">
            <img src="${esc(HEADER_LOGO)}" alt="Meeticulous" height="26" style="display:block;border:0;height:26px;">
          </td>
          ${pill}
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Full-width block CTA. Rendered only when both label and url are present. */
function ctaButton(label, url, brand) {
  if (!label || !url) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">
    <tr><td style="border-radius:10px;background:${esc(brand)};">
      <a href="${esc(url)}" style="display:block;text-align:center;padding:15px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;font-family:${D.font};">${esc(label)}</a>
    </td></tr>
  </table>`;
}

/** Document shell + card open. Returns the HTML up to (and including) the accent bar (omitted when accent=false). */
function shellOpen({ previewText, fromName, brand, accent = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${esc(fromName)}</title>
</head>
<body style="margin:0;padding:0;background:${D.bg};font-family:${D.font};">

  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;font-size:1px;">${esc(previewText)}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${D.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${D.white};border:1px solid ${D.border};border-radius:16px;overflow:hidden;">
        ${accent ? accentBar(brand) : ''}`;
}

/** Body cell + card/document close, with the supplied footer row injected. */
function shellClose({ bodyHtml, cta, footerRow }) {
  return `
        <tr>
          <td style="padding:34px 28px 18px;">
            ${bodyHtml}
            ${cta}
          </td>
        </tr>
        ${footerRow}
      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Customer layout ──────────────────────────────────────────────────────────

function renderCustomerLayout({ bodyHtml, previewText, ctaLabel, ctaUrl, emailCategory, settings, data }) {
  const brand    = settings.brand_color   || '#960D32';
  const website  = settings.website_url   || 'https://meeticulous.com';
  const support  = settings.support_email || 'hello@meeticulous.com';
  const fromName = settings.from_name     || 'Meeticulous';
  const year     = new Date().getFullYear();
  const unsubToken = data.unsubscribe_token || '';

  const header = headerBlock({ category: emailCategory, theme: themeForCategory(emailCategory) });

  const lk = (href, label) =>
    `<a href="${esc(href)}" style="color:${D.muted};text-decoration:none;font-size:12px;font-family:${D.font};">${label}</a>`;
  const dot = `<span style="color:${D.note};margin:0 6px;">&middot;</span>`;
  const nav = [
    lk(`${website}/user/my-bookings`, 'My Bookings'),
    lk(`${website}/help`,        'Help'),
    lk(`${website}/privacy`,     'Privacy'),
    lk(`${website}/unsubscribe?u=${esc(unsubToken)}`, 'Unsubscribe'),
  ].join(dot);

  const footerRow = `<tr>
    <td style="padding:24px 28px 28px;border-top:1px solid ${D.border};background:${D.bg};text-align:center;">
      <img src="${esc(FOOTER_LOGO)}" alt="${esc(fromName)}" width="60" style="margin:0 auto 14px;display:block;border:0;">
      <p style="margin:0 0 16px;font-size:12px;line-height:2;font-family:${D.font};">${nav}</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:${D.dark};font-family:${D.font};">${COMPANY}</p>
      <p style="margin:0 0 2px;font-size:12px;line-height:1.6;color:${D.muted};font-family:${D.font};">${ADDRESS}</p>
      <p style="margin:0;font-size:12px;color:${D.muted};font-family:${D.font};"><a href="mailto:${esc(support)}" style="color:${D.muted};text-decoration:none;">${esc(support)}</a></p>
      <p style="margin:14px 0 0;font-size:11px;color:${D.note};font-family:${D.font};">© ${year} ${esc(fromName)}. All rights reserved.</p>
    </td>
  </tr>`;

  return shellOpen({ previewText, fromName, brand })
    + header
    + shellClose({ bodyHtml, cta: ctaButton(ctaLabel, ctaUrl, brand), footerRow });
}

// ── Vendor layout ────────────────────────────────────────────────────────────

function renderVendorLayout({ bodyHtml, previewText, ctaLabel, ctaUrl, emailCategory, settings, data }) {
  const brand     = settings.brand_color   || '#960D32';
  const fromName  = settings.from_name     || 'Meeticulous';
  const year      = new Date().getFullYear();

  const header = headerBlock({ category: emailCategory, theme: themeForCategory(emailCategory) });

  const footerRow = `<tr>
    <td style="padding:22px 20px;border-top:1px solid ${D.border};text-align:center;font-size:11px;line-height:1.7;color:${D.note};font-family:${D.font};">
      Powered by<br>
      <img src="${esc(FOOTER_LOGO)}" alt="Meeticulous" width="60" style="margin:8px auto;display:block;border:0;">
      ${esc(COMPANY)} &middot; ${esc(TAGLINE)}<br>
      ${esc(ADDRESS)}<br>
      <span style="color:${D.note};">© ${year} Meeticulous</span>
    </td>
  </tr>`;

  return shellOpen({ previewText, fromName, brand })
    + header
    + shellClose({ bodyHtml, cta: ctaButton(ctaLabel, ctaUrl, brand), footerRow });
}

// ── Cold layout ──────────────────────────────────────────────────────────────
// For founder cold outreach: NO header chrome (no logo/pill — reads like a 1:1
// note, not a bulk blast, which lands better than a branded template). Footer is
// the legal floor only: sender identity + postal address + unsubscribe (DPDP /
// CAN-SPAM require all three on commercial cold mail). No nav, no "My Bookings",
// no rights-reserved. ponytail: reuses the shared shell, just drops the header row.
// Founder cold outreach — a hand-typed 1:1 note. NO card, NO grey page background,
// NO centered brand shell, NO orange buttons: white ground, left-aligned text, plain
// links, and a faint legal-floor footer (sender + address + unsubscribe). The point
// is it must NOT read as a marketing blast — plainer lands better in a cold inbox and
// protects sender reputation. `bodyHtml` is pre-styled plain by emailService (links
// stay inline, not promoted to buttons), so no ctaButton here.
function renderColdLayout({ bodyHtml, previewText, settings, data }) {
  const website  = settings.website_url || 'https://meeticulous.com';
  const fromName = settings.from_name   || 'Meeticulous';
  const unsubToken = data.unsubscribe_token || '';
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(fromName)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${font};">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;font-size:1px;">${esc(previewText)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="left" style="padding:22px 20px;">
      <div style="max-width:560px;text-align:left;">
        ${bodyHtml}
        <div style="margin-top:22px;font-size:12px;line-height:1.6;color:${D.note};font-family:${font};">
          ${esc(fromName)} · ${esc(COMPANY)}, ${esc(ADDRESS)}<br>
          <a href="${esc(website)}/unsubscribe?u=${esc(unsubToken)}" style="color:${D.note};text-decoration:underline;">Unsubscribe</a>
        </div>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Render a complete email HTML document, choosing the shell by recipient audience.
 *
 * @param {object}  opts
 * @param {string}  [opts.audience]      'vendor' → vendor shell; else customer shell
 * @param {string}  opts.bodyHtml        resolved template body (no layout chrome)
 * @param {string}  [opts.previewText]   inbox preheader
 * @param {string}  [opts.ctaLabel]      block button text (omitted if blank)
 * @param {string}  [opts.ctaUrl]        block button URL
 * @param {string}  [opts.emailCategory] header sub-label (e.g. "Booking Notification")
 * @param {string}  [opts.headerChip]    header pill chip (e.g. "#1234"); from data.header_chip
 * @param {object}  opts.settings        email_settings row
 * @param {object}  [opts.data]          per-send data (company_logo, company_name, unsubscribe_token, header_chip)
 * @returns {string} full HTML document
 */
function renderLayout({
  audience      = 'all',
  bodyHtml      = '',
  previewText   = '',
  ctaLabel      = '',
  ctaUrl        = '',
  emailCategory = '',
  headerChip    = '',
  settings      = {},
  data          = {},
} = {}) {
  const args = {
    bodyHtml, previewText, ctaLabel, ctaUrl,
    emailCategory,
    settings, data: data || {},
  };
  if (audience === 'vendor') return renderVendorLayout(args);
  if (audience === 'cold')   return renderColdLayout(args);
  return renderCustomerLayout(args);
}

module.exports = { renderLayout, tint };
