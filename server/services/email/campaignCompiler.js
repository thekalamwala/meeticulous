/**
 * campaignCompiler.js — compile the admin composer's block model into email-safe
 * body HTML (table-based, inline CSS, 600px shell-friendly).
 *
 * The output is the CHROME-LESS body only — the same slot a template's
 * html_content fills. communicationEngine wraps it in the recipient shell
 * (header, footer, unsubscribe) at send time, so the unsubscribe token stays
 * per-recipient correct. Live preview wraps it with a dummy token.
 *
 * Block text is escaped (defence in depth — authored by admins, but never
 * trusted into raw HTML). {{tokens}} survive escaping and are resolved per
 * recipient by placeholderResolver later. Phase 1 has no raw-HTML block.
 *
 * Supported blocks: heading · text · image · button · divider · spacer · section
 *   · metric · callout · checklist · beforeAfter · caseCard · quote · editorial.
 */

'use strict';

// Design tokens mirror emailLayout.js so composed mail matches transactional mail.
const D = {
  dark:  '#202124',
  muted: '#5f6368',
  border:'#edf0f2',
  font:  "'Poppins','Plus Jakarta Sans',Arial,sans-serif",
};
const DEFAULT_BRAND = '#FE5100';

/** Escape text for HTML body/attribute insertion. Leaves {{tokens}} intact. */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ALIGN = (a) => (['left', 'center', 'right'].includes(a) ? a : 'left');

/** Preserve author line breaks inside a text block. */
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

function heading({ text = '', level = 2, align = 'left' }) {
  const size = level === 1 ? 28 : level === 3 ? 18 : 22;
  return `<tr><td style="padding:8px 0;text-align:${ALIGN(align)};font-family:${D.font};">
    <span style="font-size:${size}px;line-height:1.3;font-weight:700;color:${D.dark};">${nl2br(text)}</span>
  </td></tr>`;
}

function text({ text: t = '', align = 'left' }) {
  return `<tr><td style="padding:8px 0;text-align:${ALIGN(align)};font-size:15px;line-height:1.7;color:${D.muted};font-family:${D.font};">${nl2br(t)}</td></tr>`;
}

function image({ src = '', href = '', alt = '', width = 600 }) {
  if (!src) return '';
  const w = Math.max(40, Math.min(600, parseInt(width, 10) || 600));
  const img = `<img src="${esc(src)}" alt="${esc(alt)}" width="${w}" style="display:block;border:0;max-width:100%;width:${w}px;height:auto;margin:0 auto;">`;
  const inner = href ? `<a href="${esc(href)}" style="text-decoration:none;">${img}</a>` : img;
  return `<tr><td style="padding:10px 0;text-align:center;">${inner}</td></tr>`;
}

function button({ label = '', href = '', align = 'left', brand = DEFAULT_BRAND }) {
  if (!label || !href) return '';
  return `<tr><td style="padding:12px 0;text-align:${ALIGN(align)};">
    <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;">
      <tr><td style="border-radius:1px;background:${esc(brand)};">
        <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${D.font};">${esc(label)}</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function divider() {
  return `<tr><td style="padding:14px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${D.border};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
}

function spacer({ size = 16 }) {
  const h = Math.max(4, Math.min(80, parseInt(size, 10) || 16));
  return `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;
}

function section({ background = '', blocks = [], brand = DEFAULT_BRAND }) {
  const inner = renderRows(blocks, brand);
  const bg = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background) ? background : 'transparent';
  return `<tr><td style="padding:6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:1px;">
      <tr><td style="padding:${bg === 'transparent' ? '0' : '20px 24px'};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>
      </td></tr>
    </table>
  </td></tr>`;
}

// ── founder-voice blocks (ported from the Timewheel design catalog) ──────────

function metric({ value = '', label = '', background = D.dark }) {
  const bg = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background) ? background : D.dark;
  return `<tr><td style="padding:6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:1px;">
      <tr><td style="padding:24px;text-align:center;font-family:${D.font};">
        <span style="font-size:28px;font-weight:600;color:#ffffff;line-height:1.2;">${nl2br(value)}</span>
        ${label ? `<div style="font-size:13px;color:#b0b3b8;margin-top:4px;">${nl2br(label)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

function callout({ text: t = '', barColor = '', background = '', brand = DEFAULT_BRAND }) {
  const bar = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(barColor) ? barColor : brand;
  const bg = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background) ? background : 'transparent';
  const cellPad = bg === 'transparent' ? '2px 0 2px 14px' : '16px 16px 16px 14px';
  return `<tr><td style="padding:10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:1px;">
      <tr>
        <td width="6" style="background:${bar};font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:${cellPad};font-size:14px;line-height:1.7;color:${D.muted};font-family:${D.font};">${nl2br(t)}</td>
      </tr>
    </table>
  </td></tr>`;
}

function checklist({ items = [], columns = 1, brand = DEFAULT_BRAND }) {
  const list = (Array.isArray(items) ? items : []).filter((x) => String(x == null ? '' : x).trim());
  if (!list.length) return '';
  const cols = columns === 2 ? 2 : 1;
  const w = cols === 2 ? '50%' : '100%';
  const cell = (t) => `<td width="${w}" valign="top" style="padding:6px 0;font-size:14px;line-height:1.6;color:${D.muted};font-family:${D.font};"><span style="color:${brand};">&#10004;</span> ${esc(t)}</td>`;
  let rows = '';
  for (let i = 0; i < list.length; i += cols) {
    const a = cell(list[i]);
    const b = cols === 2 ? (list[i + 1] != null ? cell(list[i + 1]) : '<td width="50%"></td>') : '';
    rows += `<tr>${a}${b}</tr>`;
  }
  return `<tr><td style="padding:8px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function beforeAfter({ beforeTitle = 'Before', before = '', afterTitle = 'After', after = '' }) {
  const box = (title, body) => `<td width="50%" valign="top" style="padding:18px;font-size:14px;line-height:1.6;color:${D.muted};font-family:${D.font};border:1px solid ${D.border};">
    <strong style="color:${D.dark};display:block;margin-bottom:6px;">${esc(title)}</strong>${nl2br(body)}</td>`;
  return `<tr><td style="padding:10px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${box(beforeTitle, before)}${box(afterTitle, after)}</tr></table></td></tr>`;
}

function caseCard({ name = '', text: t = '' }) {
  return `<tr><td style="padding:10px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${D.border};border-radius:1px;">
      <tr><td style="padding:20px;font-family:${D.font};">
        ${name ? `<strong style="color:${D.dark};font-size:14px;">${esc(name)}</strong>` : ''}
        ${t ? `<div style="font-size:14px;line-height:1.7;color:${D.muted};margin-top:6px;">${nl2br(t)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

function quote({ text: t = '', author = '', align = 'center' }) {
  return `<tr><td style="padding:20px 0;text-align:${ALIGN(align)};font-family:${D.font};">
    <div style="font-size:18px;line-height:1.6;color:${D.dark};">${nl2br(t)}</div>
    ${author ? `<div style="font-size:13px;color:#80868b;margin-top:8px;">&mdash; ${esc(author)}</div>` : ''}
  </td></tr>`;
}

function editorial({ eyebrow = '', heading: h = '', body = '' }) {
  return `<tr><td style="padding:16px 0;font-family:${D.font};">
    ${eyebrow ? `<div style="font-size:12px;color:#80868b;letter-spacing:1px;text-transform:uppercase;">${esc(eyebrow)}</div>` : ''}
    ${h ? `<div style="font-size:22px;font-weight:700;color:${D.dark};margin:10px 0;line-height:1.3;">${nl2br(h)}</div>` : ''}
    ${body ? `<div style="font-size:14px;line-height:1.8;color:${D.muted};">${nl2br(body)}</div>` : ''}
  </td></tr>`;
}

const RENDERERS = { heading, text, image, button, divider, spacer, section,
  metric, callout, checklist, beforeAfter, caseCard, quote, editorial };

/** Render an array of blocks to `<tr>…` rows. Unknown block types are skipped. */
function renderRows(blocks, brand) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((b) => {
      const fn = b && RENDERERS[b.type];
      if (!fn) return '';
      return fn({ ...b, brand });
    })
    .join('\n');
}

/**
 * Compile a composer design → chrome-less body HTML.
 * @param {object} design  { blocks: [...], brandColor?: '#rrggbb' }
 * @returns {{ bodyHtml: string }}
 */
function compile(design = {}) {
  const brand = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(design.brandColor) ? design.brandColor : DEFAULT_BRAND;
  const rows = renderRows(design.blocks, brand);
  const bodyHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  return { bodyHtml };
}

module.exports = { compile };

// ── self-check ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const assert = require('assert');
  const { bodyHtml } = compile({
    brandColor: '#123456',
    blocks: [
      { type: 'heading', text: 'Hi {{first_name}}', level: 1 },
      { type: 'text', text: 'Line one\nLine two <script>' },
      { type: 'image', src: 'https://x/y.png', alt: 'a' },
      { type: 'button', label: 'Go', href: 'https://x' },
      { type: 'divider' },
      { type: 'spacer', size: 24 },
      { type: 'section', background: '#eef', blocks: [{ type: 'text', text: 'nested' }] },
      { type: 'metric', value: '3,200 hosts', label: 'now on Book A Sloth' },
      { type: 'callout', text: 'One insight <b>here</b>', background: '#fff4ed' },
      { type: 'checklist', items: ['One', 'Two', '', 'Three'], columns: 2 },
      { type: 'beforeAfter', before: 'chasing payments', after: 'auto-paid' },
      { type: 'caseCard', name: 'A host', text: 'doubled bookings' },
      { type: 'quote', text: 'You never chase payment.', author: 'Shubham' },
      { type: 'editorial', eyebrow: 'from shubham', heading: 'Why', body: 'a note' },
      { type: 'bogus', text: 'skip me' },
    ],
  });
  assert(bodyHtml.includes('{{first_name}}'), 'tokens survive escaping');
  assert(bodyHtml.includes('&lt;script&gt;'), 'author html is escaped');
  assert(bodyHtml.includes('Line one<br>Line two'), 'newlines → <br>');
  assert(bodyHtml.includes('#123456'), 'brand color applied to button');
  assert(bodyHtml.includes('nested'), 'section children render');
  assert(bodyHtml.includes('3,200 hosts'), 'metric renders');
  assert(bodyHtml.includes('&lt;b&gt;'), 'callout text escaped');
  assert(bodyHtml.includes('&#10004;'), 'checklist ticks render');
  assert((bodyHtml.match(/&#10004;/g) || []).length === 3, 'blank checklist items dropped');
  assert(bodyHtml.includes('chasing payments') && bodyHtml.includes('auto-paid'), 'beforeAfter renders both');
  assert(bodyHtml.includes('doubled bookings'), 'caseCard renders');
  assert(bodyHtml.includes('You never chase payment.'), 'quote renders');
  assert(bodyHtml.includes('&mdash; Shubham'), 'quote attribution');
  assert(bodyHtml.includes('#123456') && bodyHtml.includes('&#10004;'), 'brand threads into checklist tick');
  assert(!bogusRendered(bodyHtml), 'unknown block skipped');
  function bogusRendered(h) { return h.includes('skip me'); }
  console.log('campaignCompiler self-check OK');
}
