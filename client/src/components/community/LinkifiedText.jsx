// User text -> React text nodes. URLs become external <a>; @mentions become internal
// <Link> to /<username>; "\n" becomes <br/>.
// Never dangerouslySetInnerHTML: markup in a post renders as literal text.
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// DUPLICATED from server/services/community/text.js (URL_RE + BARE_TLDS + trailing-punctuation
// strip in extractUrls). The client can't import server code; keep the two in sync.
const URL_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;
const BARE_TLDS = new Set(['com', 'in', 'io', 'me', 'co', 'org', 'net', 'app', 'ly', 'tv', 'xyz', 'ai', 'dev', 'info', 'biz', 'link', 'site', 'online', 'store', 'shop', 'page', 'to', 'gg', 'us', 'uk']);
const TRAILING = /[.,;:!?)\]}'"]+$/;

// Mentions. MIRRORS the capture in server/services/community/text.js extractMentions
// (@ + a-z0-9 start, then a-z0-9-). The server guards the left edge with a lookbehind
// `(?<![\w.@-])`; we avoid lookbehind here for older-browser support and check the
// preceding character by hand (same intent: never fire inside an email or a word).
// Links to /<username> — the public host page, same path as author.profile_url. Unknown
// or guest handles route to that page and 404 there, matching how social apps link @names.
// ponytail: naive link, no per-handle resolve. If 404s on mistyped/guest mentions bite,
// have the server attach a {username: profile_url|null} map to the body and link only hits.
const MENTION_RE = /@([a-z0-9][a-z0-9-]*)(?![\w@-])/gi;
const MENTION_LEFT_BAD = /[\w.@-]/; // char class the server's lookbehind forbids before '@'

const isLink = (u) => /^(?:https?:\/\/|www\.)/i.test(u)
  || BARE_TLDS.has(u.split(/[/?#]/)[0].replace(/:\d+$/, '').split('.').pop().toLowerCase());

// Split a plain string (already URL-free) into text + <Link> mention nodes.
function mentionize(text, keyBase) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index > 0 && MENTION_LEFT_BAD.test(text[m.index - 1])) continue; // inside an email/word
    const handle = m[1].replace(/-+$/, ''); // "@priya-," -> priya (server trims trailing '-')
    if (!handle) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <Link key={`${keyBase}-m${m.index}`} to={`/${handle.toLowerCase()}`} className="font-medium text-maroon no-underline hover:underline">
        {`@${handle}`}
      </Link>,
    );
    // Advance past the handle only — any trailing '-' the greedy class ate stays as text.
    last = m.index + 1 + handle.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function linkify(line, keyBase) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '');
    if (!url || !isLink(url)) continue;
    if (m.index > last) out.push(...mentionize(line.slice(last, m.index), `${keyBase}-${m.index}t`));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    out.push(<a key={`${keyBase}-${m.index}`} href={href} rel="ugc nofollow noopener" target="_blank">{url}</a>);
    last = m.index + url.length;
  }
  if (last < line.length) out.push(...mentionize(line.slice(last), `${keyBase}-end`));
  return out;
}

export default function LinkifiedText({ text }) {
  return String(text ?? '').split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {linkify(line, i)}
    </Fragment>
  ));
}
