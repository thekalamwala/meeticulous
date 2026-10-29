import { Link } from 'react-router-dom';

/**
 * Markdown.jsx — a deliberately tiny markdown renderer for the help-center
 * articles (docs/help/*.md). It covers ONLY the subset those files use:
 * headings (#, ##, ###), unordered/ordered lists, paragraphs, and inline
 * **bold**, `code`, and [links](href). Internal links (starting with "/")
 * render as react-router <Link>; external links open in a new tab.
 *
 * ponytail: no react-markdown/remark dependency — the input is a fixed set of
 * files we author, not arbitrary user markdown, so a focused parser is smaller
 * and has no CSP/bundle cost. If help content ever accepts untrusted markdown,
 * swap this for a hardened library.
 */

// Inline tokens, matched in priority order: [label](href) link · **bold** ·
// `code` · *italic* · a bare http(s) URL (autolinked). Bold is listed before
// italic so `**x**` never mis-parses as two italics. Only http(s) autolinks —
// never javascript:/data:, so a pasted URL can't smuggle a script.
const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*|(https?:\/\/[^\s<]+)/g;

// A bare URL often ends a sentence — don't swallow the trailing punctuation, and
// keep a closing paren only if the URL actually opened one.
function trimUrl(url) {
  let u = url;
  while (/[.,;:!?]$/.test(u)) u = u.slice(0, -1);
  if (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1);
  return u;
}

function extLink(key, href, label) {
  return <a key={key} href={href} target="_blank" rel="noreferrer" className="text-[#2E1065] hover:underline break-words">{label}</a>;
}

function renderInline(text, keyBase, externalLinks) {
  const nodes = [];
  let last = 0;
  let i = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1] !== undefined) {
      const label = m[1];
      const href = m[2];
      nodes.push(
        href.startsWith('/') && !href.startsWith('//') ? (
          <Link key={key} to={href} className="text-[#2E1065] hover:underline">{label}</Link>
        ) : externalLinks === 'strip' ? (
          <span key={key}>{label}</span>
        ) : extLink(key, href, label),
      );
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key} className="font-semibold text-gray-900">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] text-gray-800">{m[4]}</code>);
    } else if (m[5] !== undefined) {
      nodes.push(<em key={key} className="italic">{m[5]}</em>);
    } else if (m[6] !== undefined) {
      const url = trimUrl(m[6]);
      // Push back any punctuation we trimmed so it still renders as text.
      if (url.length < m[6].length) INLINE_RE.lastIndex -= (m[6].length - url.length);
      nodes.push(externalLinks === 'strip' ? <span key={key}>{url}</span> : extLink(key, url, url));
      last = INLINE_RE.lastIndex;
      continue;
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Group lines into blocks. Exported for the unit test.
export function parseBlocks(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null; // { type: 'ul' | 'ol', items: [] }
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      blocks.push({ type: 'h', level: h[1].length, text: h[2].trim() });
    } else if (ul) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(ul[1].trim());
    } else if (ol) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(ol[1].trim());
    } else if (line.trim() === '') {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return blocks;
}

const H_CLASS = {
  1: 'text-2xl sm:text-3xl font-bold text-gray-900 mt-0 mb-4',
  2: 'text-lg font-bold text-gray-900 mt-8 mb-2',
  3: 'text-base font-semibold text-gray-900 mt-6 mb-1.5',
};

export default function Markdown({ source, externalLinks = 'allow' }) {
  const blocks = parseBlocks(source);
  return (
    <div className="text-[15px] leading-relaxed text-gray-700">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const Tag = `h${Math.min(b.level, 3)}`;
          return <Tag key={i} className={H_CLASS[Math.min(b.level, 3)]}>{renderInline(b.text, `h${i}`, externalLinks)}</Tag>;
        }
        if (b.type === 'p') {
          return <p key={i} className="mb-4">{renderInline(b.text, `p${i}`, externalLinks)}</p>;
        }
        const items = b.items.map((it, j) => <li key={j} className="mb-1.5">{renderInline(it, `l${i}-${j}`, externalLinks)}</li>);
        return b.type === 'ol'
          ? <ol key={i} className="list-decimal pl-5 mb-4 space-y-0.5">{items}</ol>
          : <ul key={i} className="list-disc pl-5 mb-4 space-y-0.5">{items}</ul>;
      })}
    </div>
  );
}
