/**
 * emailLayout.js — recipient-driven email shells.
 *
 * Three layouts, selected by the RECIPIENT audience (not the template row tag):
 *   • customer → wordmark + status pill header, text footer (reply line + legal);
 *                marketing mail adds the nav + unsubscribe row.
 *   • vendor   → same frame, footer without nav (hosts already know the brand).
 *   • cold     → NO header chrome, legal-floor footer only (sender + address +
 *                unsubscribe). Founder cold outreach: reads like a 1:1 note.
 *
 * renderLayout({ audience, ... }) dispatches:
 *   'vendor'                      → renderVendorLayout
 *   'cold'                        → renderColdLayout
 *   'customer' | 'all' | missing  → renderCustomerLayout (safe default; it is
 *                                   platform-branded and carries unsubscribe)
 *
 * Shared private helpers (card wrapper, CTA, header block, footer, escaping)
 * keep the two variants from drifting — they differ ONLY in the footer nav.
 * Frame (2026-11 redesign): 1.5px crimson card border, no top accent bar.
 *
 * Email-client notes:
 *   • Table-based layout for Outlook / Gmail / Apple Mail / dark-mode.
 *   • Chip tint is a precomputed SOLID hex (brand blended toward white), NOT
 *     8-digit alpha hex — Outlook desktop does not render alpha hex.
 *   • Fluid card, max width 600px; @media rules only widen padding/buttons on phones. Design tokens inlined (no CSS custom properties in email).
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
  brand:  '#960D32', // Crimson — links
  dark:   '#2B1218', // Ink — headlines, bold values
  body:   '#4A3A3E', // Body copy
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
// ADDRESS updated 2026-10-31 to the Eureka CoWorking office (owner request).
const COMPANY    = 'Rajmudra Media LLP';
const ADDRESS    = 'Eureka CoWorking, 2nd & 4th floor, 11, Friends Colony, Mate Square, Pratap Nagar Rd, Nagpur, Maharashtra 440022';
// Hosted on the site itself (client/public/images/email → served at
// meeticulous.com by Vercel), so emails no longer depend on an external CDN.
// Header = full wordmark (26px tall, left). The footer is text-only.
const HEADER_LOGO = 'https://meeticulous.com/images/email/meeticulous-wordmark-full-color.png';

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

// Categories that read as good news get a check mark in the header pill.
const POSITIVE = new Set(['Booking Confirmed', 'New Booking', 'Session Complete', 'Payment Receipt', 'Achievement Unlocked', 'Welcome']);

/**
 * Header: Meeticulous wordmark (left) + one crimson-tint status pill (right).
 * The pill is the email's single status label — bodies no longer repeat it.
 */
function headerBlock({ category, theme }) {
  const pill = category
    ? `<td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:12px;">
         <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${theme.tint};color:${theme.text};font-size:12px;font-weight:600;font-family:${D.font};">${POSITIVE.has(category) ? '&#10003; ' : ''}${esc(category)}</span>
       </td>`
    : '';
  return `<tr>
    <td class="px" style="padding:22px 32px;border-bottom:1px solid ${D.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="left" style="vertical-align:middle;">
            <img src="${esc(HEADER_LOGO)}" alt="Meeticulous" height="26" style="display:block;border:0;height:26px;width:auto;">
          </td>
          ${pill}
        </tr>
      </table>
    </td>
  </tr>`;
}

/** CTA button (6px radius). Rendered only when both label and url are present. */
function ctaButton(label, url, brand) {
  if (!label || !url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
    <tr><td style="border-radius:6px;background:${esc(brand)};">
      <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;font-family:${D.font};">${esc(label)}</a>
    </td></tr>
  </table>`;
}

/**
 * Text footer shared by both branded layouts: reply line + legal entity/address,
 * with the nav + unsubscribe row on marketing mail only.
 */
function footerBlock({ support, fromName, nav = '' }) {
  const year = new Date().getFullYear();
  return `<tr>
    <td class="px" style="padding:22px 32px 26px;border-top:1px solid ${D.border};background:${D.bg};text-align:center;font-size:12px;line-height:1.6;color:${D.muted};font-family:${D.font};">
      ${nav ? `<p style="margin:0 0 10px;font-size:12px;line-height:2;">${nav}</p>` : ''}
      Questions? Just reply &mdash; it reaches the ${esc(fromName)} team at <a href="mailto:${esc(support)}" style="color:${D.brand};text-decoration:none;">${esc(support)}</a><br>
      ${COMPANY} &middot; ${ADDRESS}<br>
      &copy; ${year} ${esc(fromName)}
    </td>
  </tr>`;
}

/** Document shell + card open (1.5px crimson card border, 10px radius). */
function shellOpen({ previewText, fromName, brand }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(fromName)}</title>
  <style>
    @media (max-width:620px){
      .outer{padding:16px 6px!important}
      .px{padding-left:20px!important;padding-right:20px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${D.bg};font-family:${D.font};">

  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;font-size:1px;">${esc(previewText)}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${D.bg};">
    <tr><td class="outer" align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${D.white};border:1.5px solid ${esc(brand)};border-radius:10px;overflow:hidden;">`;
}

/**
 * Body cell + card/document close, with the supplied footer row injected.
 * The CTA goes at the end of the body, or where the body puts a <!--cta--> marker
 * (e.g. above a sign-off).
 */
function shellClose({ bodyHtml, cta, footerRow }) {
  const body = bodyHtml.includes('<!--cta-->') ? bodyHtml.replace('<!--cta-->', cta) : bodyHtml + cta;
  return `
        <tr>
          <td class="px" style="padding:30px 32px 26px;font-size:15px;line-height:1.65;color:${D.body};font-family:${D.font};">
            ${body}
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

function renderCustomerLayout({ bodyHtml, previewText, ctaLabel, ctaUrl, emailCategory, settings, data, marketing = false }) {
  const brand    = settings.brand_color   || '#960D32';
  const website  = settings.website_url   || 'https://meeticulous.com';
  const support  = settings.support_email || 'team@meeticulous.com';
  const fromName = settings.from_name     || 'Meeticulous';
  const unsubToken = data.unsubscribe_token || '';

  const header = headerBlock({ category: emailCategory, theme: themeForCategory(emailCategory) });

  const lk = (href, label) =>
    `<a href="${esc(href)}" style="color:${D.muted};text-decoration:none;font-size:12px;font-family:${D.font};">${label}</a>`;
  const dot = `<span style="color:${D.note};margin:0 6px;">&middot;</span>`;
  // Only MARKETING mail carries the nav + unsubscribe link. On transactional mail
  // that link is the strongest "this is bulk" signal to Gmail (→ Updates/Promotions
  // tab), so a confirmation/receipt/welcome ships a clean footer and lands in Primary.
  const nav = marketing ? [
    lk(`${website}/user/my-bookings`, 'My Bookings'),
    lk(`${website}/help`,        'Help'),
    lk(`${website}/privacy`,     'Privacy'),
    lk(`${website}/unsubscribe?u=${esc(unsubToken)}`, 'Unsubscribe'),
  ].join(dot) : '';

  const footerRow = footerBlock({ support, fromName, nav });

  return shellOpen({ previewText, fromName, brand })
    + header
    + shellClose({ bodyHtml, cta: ctaButton(ctaLabel, ctaUrl, brand), footerRow });
}

// ── Vendor layout ────────────────────────────────────────────────────────────

function renderVendorLayout({ bodyHtml, previewText, ctaLabel, ctaUrl, emailCategory, settings, data }) {
  const brand     = settings.brand_color   || '#960D32';
  const fromName  = settings.from_name     || 'Meeticulous';
  const support   = settings.support_email || 'team@meeticulous.com';

  const header = headerBlock({ category: emailCategory, theme: themeForCategory(emailCategory) });

  const footerRow = footerBlock({ support, fromName });

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
  marketing     = false,
} = {}) {
  const args = {
    bodyHtml, previewText, ctaLabel, ctaUrl,
    emailCategory,
    settings, data: data || {}, marketing,
  };
  if (audience === 'vendor') return renderVendorLayout(args);
  if (audience === 'cold')   return renderColdLayout(args);
  return renderCustomerLayout(args);
}

module.exports = { renderLayout, tint };
