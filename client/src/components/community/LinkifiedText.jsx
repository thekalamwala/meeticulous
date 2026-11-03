// User text -> React text nodes. Only URLs become <a>; "\n" becomes <br/>.
// Never dangerouslySetInnerHTML: markup in a post renders as literal text.
import { Fragment } from 'react';

// DUPLICATED from server/services/community/text.js (URL_RE + BARE_TLDS + trailing-punctuation
// strip in extractUrls). The client can't import server code; keep the two in sync.
const URL_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;
const BARE_TLDS = new Set(['com', 'in', 'io', 'me', 'co', 'org', 'net', 'app', 'ly', 'tv', 'xyz', 'ai', 'dev', 'info', 'biz', 'link', 'site', 'online', 'store', 'shop', 'page', 'to', 'gg', 'us', 'uk']);
const TRAILING = /[.,;:!?)\]}'"]+$/;

const isLink = (u) => /^(?:https?:\/\/|www\.)/i.test(u)
  || BARE_TLDS.has(u.split(/[/?#]/)[0].replace(/:\d+$/, '').split('.').pop().toLowerCase());

function linkify(line, keyBase) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '');
    if (!url || !isLink(url)) continue;
    if (m.index > last) out.push(line.slice(last, m.index));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    out.push(<a key={`${keyBase}-${m.index}`} href={href} rel="ugc nofollow noopener" target="_blank">{url}</a>);
    last = m.index + url.length;
  }
  if (last < line.length) out.push(line.slice(last));
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
