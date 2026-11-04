'use strict';
// Community text rules: pure validation for posts/threads/comments. No I/O.
// Blocks off-platform contact (phones/emails/chat links) so guests book through
// the host's Meeticulous page, not around it.

const { redactPii } = require('../botService'); // reuse the bot's India-aware PII patterns
const { isBlocked } = require('../../utils/adultContentFilter');

const LIMITS = { TITLE: 150, THREAD_BODY: 10000, POST_BODY: 1000, COMMENT: 2000 };

const BLOCKED_LINK_HOSTS = [
  'wa.me', 'api.whatsapp.com', 'chat.whatsapp.com', 't.me', 'telegram.me',
  'calendly.com', 'cal.com', 'topmate.io', 'bit.ly', 'tinyurl.com', 'linktr.ee',
];
const ALWAYS_ALLOWED_HOSTS = ['meeticulous.com'];

const MESSAGES = {
  TITLE_REQUIRED: 'Give your thread a title.',
  TITLE_TOO_LONG: `Titles can be at most ${LIMITS.TITLE} characters.`,
  BODY_REQUIRED: 'Write something first.',
  BODY_TOO_LONG: 'That is too long — please shorten it.',
  CONTACT_NOT_ALLOWED: "Phone numbers and emails aren't allowed — guests book through your page.",
  LINK_NOT_ALLOWED: 'Links unlock once your account is a week old and has a few posts.',
  BLOCKED_LINK: "That link isn't allowed here — share your Meeticulous page instead.",
  BLOCKED_TERM: "That content isn't allowed here.",
};
const fail = (code) => ({ ok: false, code, message: MESSAGES[code] });

// http(s):// URLs, or bare domains (wa.me/91..., www.x.com). The TLD must be letters
// so "5.30pm" and "Rs.1499" are not links. Emails are caught earlier as contact.
const URL_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;

// Bare domains only count with a common TLD, else "done.Thanks" / "Dr.Sharma" (missing
// space after a full stop) would read as links. Schemed and www. forms always count.
const BARE_TLDS = new Set(['com', 'in', 'io', 'me', 'co', 'org', 'net', 'app', 'ly', 'tv', 'xyz', 'ai', 'dev', 'info', 'biz', 'link', 'site', 'online', 'store', 'shop', 'page', 'to', 'gg', 'us', 'uk']);

function extractUrls(text) {
  return (String(text ?? '').match(URL_RE) || [])
    .map((u) => u.replace(/[.,;:!?)\]}'"]+$/, ''))
    .filter((u) => {
      if (/^(?:https?:\/\/|www\.)/i.test(u)) return true;
      const host = hostOf(u);
      return hostMatches(host, BLOCKED_LINK_HOSTS) || BARE_TLDS.has(host.split('.').pop());
    });
}

function hostOf(url) {
  return url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].replace(/:\d+$/, '').toLowerCase();
}
const hostMatches = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`));

function checkSafety(text, { linksAllowed = false } = {}) {
  const s = String(text ?? '');
  const hosts = extractUrls(s).map(hostOf);
  // Blocked hosts first: a wa.me link carries a phone number, but BLOCKED_LINK is the clearer reason.
  if (hosts.some((h) => hostMatches(h, BLOCKED_LINK_HOSTS))) return fail('BLOCKED_LINK');
  if (redactPii(s) !== s) return fail('CONTACT_NOT_ALLOWED');
  // isBlocked is slug-tuned; per-word keeps the substring tier from matching across word boundaries.
  if (s.split(/[^\p{L}\p{N}]+/u).some((w) => w && isBlocked(w))) return fail('BLOCKED_TERM');
  if (!linksAllowed && hosts.some((h) => !hostMatches(h, ALWAYS_ALLOWED_HOSTS))) return fail('LINK_NOT_ALLOWED');
  return null;
}

function validateDraft({ kind, title, body } = {}, { linksAllowed = false } = {}) {
  const b = String(body ?? '').trim();
  let t = null;
  if (kind === 'thread') {
    t = String(title ?? '').trim();
    if (!t) return fail('TITLE_REQUIRED');
    if (t.length > LIMITS.TITLE) return fail('TITLE_TOO_LONG');
  }
  if (!b) return fail('BODY_REQUIRED');
  if (b.length > (kind === 'thread' ? LIMITS.THREAD_BODY : LIMITS.POST_BODY)) return fail('BODY_TOO_LONG');
  const bad = checkSafety(t ? `${t}\n${b}` : b, { linksAllowed });
  if (bad) return { ok: false, ...bad };
  return { ok: true, title: t, body: b };
}

function validateComment(body, { linksAllowed = false } = {}) {
  const b = String(body ?? '').trim();
  if (!b) return fail('BODY_REQUIRED');
  if (b.length > LIMITS.COMMENT) return fail('BODY_TOO_LONG');
  const bad = checkSafety(b, { linksAllowed });
  if (bad) return { ok: false, ...bad };
  return { ok: true, body: b };
}

function makeSlug(source) {
  const words = String(source ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // fold accents to ASCII
    .toLowerCase().match(/[a-z0-9]+/g) || [];
  let base = '';
  for (const w of words.slice(0, 8)) {
    const next = base ? `${base}-${w}` : w;
    if (next.length > 60) break;
    base = next;
  }
  if (!base && words[0]) base = words[0].slice(0, 60); // single over-long word
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${base || 'post'}-${suffix}`;
}

// Usernames are [a-z0-9-] (slugNormalize maps _ . and spaces to -; guests are user-<digits>).
function extractMentions(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(/(?<![\w.@-])@([a-z0-9][a-z0-9-]*)(?![\w@-])/gi)) {
    const name = m[1].toLowerCase().replace(/-+$/, ''); // "@priya-," -> priya
    if (name.length >= 3 && name.length <= 30) out.add(name);
  }
  return [...out];
}

module.exports = { validateDraft, validateComment, checkSafety, makeSlug, extractMentions, extractUrls, BLOCKED_LINK_HOSTS, LIMITS };
