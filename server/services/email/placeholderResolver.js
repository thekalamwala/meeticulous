/**
 * placeholderResolver.js — resolve {{snake_case}} placeholders in templates.
 *
 * Pure and dependency-free so it is trivially testable. Global placeholders
 * (current_year, support_email, website, etc.) are merged from settings and
 * always available; per-send data overrides them. Unknown placeholders resolve
 * to '' so raw {{tokens}} never leak into a delivered email.
 */

'use strict';

const PLACEHOLDER_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Escape a string for safe insertion into HTML.
 * Applied to every substituted VALUE in html_content and cta_url,
 * but NOT to subjects (which are plain-text mail headers).
 */
const htmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Build the global placeholder context from email settings + a user object. */
function buildGlobals(settings = {}, user = {}) {
  const websiteUrl = settings.website_url || 'https://meeticulous.com';
  const name = user.name || user.user_name || '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    current_year: String(new Date().getFullYear()),
    support_email: settings.support_email || 'team@meeticulous.com',
    website_url: websiteUrl,
    brand_color: settings.brand_color || '#960D32',
    dashboard_url: `${websiteUrl}/dashboard`,
    profile_url: user.username ? `${websiteUrl}/${user.username}` : websiteUrl,
    user_name: name,
    first_name: parts[0] || 'there',
    last_name: parts.slice(1).join(' ') || '',
    email: user.email || '',
  };
}

/**
 * Replace placeholders in a string using a context object.
 * @param {string|null} input   Template string containing {{tokens}}.
 * @param {object}      context Key→value map of substitutions.
 * @param {Function|null} escapeFn  Optional fn applied to each substituted value
 *   (e.g. htmlEscape for HTML bodies). Pass null/undefined for plain-text fields
 *   such as email subjects where literal characters must not be entity-encoded.
 * @returns {{ text, missing }} text with substitutions; missing = unresolved keys
 */
function resolveString(input, context = {}, escapeFn = null) {
  const missing = [];
  if (input == null) return { text: '', missing };
  const text = String(input).replace(PLACEHOLDER_RE, (_m, key) => {
    const k = key.toLowerCase();
    let val;
    if (context[k] != null && context[k] !== '') val = String(context[k]);
    else if (k in context) val = String(context[k] ?? '');
    else { missing.push(k); val = ''; }
    return escapeFn ? escapeFn(val) : val;
  });
  return { text, missing };
}

/**
 * Resolve subject, body and CTA url for a template against a merged context.
 * @param {object} template  { subject, html_content, cta_url, cta_label }
 * @param {object} data      per-send placeholder values
 * @param {object} globals   global placeholders (from buildGlobals)
 * @returns {{ subject, html, ctaUrl, ctaLabel, missing }}
 */
function resolveTemplate(template, data = {}, globals = {}) {
  const context = { ...globals, ...data };
  // Subject is a plain-text mail header — do NOT html-escape (would show &amp; literally).
  const subject = resolveString(template.subject, context);
  // html_content, cta_url and cta_label are injected into HTML — escape substituted values.
  const html = resolveString(template.html_content, context, htmlEscape);
  const ctaUrl = resolveString(template.cta_url, context, htmlEscape);
  const ctaLabel = resolveString(template.cta_label, context, htmlEscape);
  const missing = [...new Set([...subject.missing, ...html.missing, ...ctaUrl.missing, ...ctaLabel.missing])];
  return {
    subject: subject.text,
    html: html.text,
    ctaUrl: ctaUrl.text,
    ctaLabel: ctaLabel.text,
    missing,
  };
}

module.exports = { buildGlobals, resolveString, resolveTemplate, htmlEscape, PLACEHOLDER_RE };
