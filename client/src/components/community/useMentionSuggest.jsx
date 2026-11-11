import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { searchMentions } from '../../services/communityApi';
import { Avatar } from './AuthorChip';
import '../../styles/community-v2.css';

// @mention typeahead for a controlled <textarea>. The suggestion list is the
// ONLY insert path and it queries taggable community members only, so a
// non-member can't be tagged. Selecting inserts "@username " (the server's
// existing mention parser resolves @username → community_mentions).
//
// Usage:
//   const m = useMentionSuggest({ value, setValue, inputRef });
//   <div className="relative">
//     <textarea ref={inputRef} value={value} onChange={m.onChange}
//               onKeyDown={m.onKeyDown} {...m.aria} />
//     {m.list}
//   </div>
const TOKEN_RE = /(?:^|\s)@([a-zA-Z0-9_-]{0,30})$/;

export default function useMentionSuggest({ value, setValue, inputRef }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState(null); // null = closed; '' = just "@"
  const startRef = useRef(null);  // index of the "@" being edited
  const caretRef = useRef(null);  // caret to restore after an insert

  // Detect an @token immediately before the caret and open/close accordingly.
  const scan = useCallback((text, caret) => {
    const before = text.slice(0, caret);
    const m = before.match(TOKEN_RE);
    if (!m) { setOpen(false); setQuery(null); startRef.current = null; return; }
    startRef.current = caret - m[1].length - 1;
    setQuery(m[1].toLowerCase());
    setActive(0);
    setOpen(true);
  }, []);

  const onChange = (e) => {
    setValue(e.target.value);
    scan(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  // Debounced member lookup (~200ms) while open.
  useEffect(() => {
    if (query === null) return undefined;
    const t = setTimeout(() => {
      searchMentions(query).then((d) => setItems(d.members || [])).catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const insert = (member) => {
    const start = startRef.current;
    if (start == null) return;
    const caret = inputRef.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, start)}@${member.username} ${value.slice(caret)}`;
    caretRef.current = start + member.username.length + 2;
    setValue(next);
    setOpen(false);
    setQuery(null);
    startRef.current = null;
  };

  // Restore the caret after an insert re-renders the textarea.
  useLayoutEffect(() => {
    if (caretRef.current == null || !inputRef.current) return;
    const pos = caretRef.current;
    caretRef.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(pos, pos);
  }, [value, inputRef]);

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); setQuery(null); }
  };

  const aria = {
    role: 'combobox',
    'aria-expanded': open,
    'aria-autocomplete': 'list',
    'aria-controls': listId,
    'aria-activedescendant': open && items[active] ? `${listId}-opt-${active}` : undefined,
  };

  const list = open && items.length ? (
    <ul id={listId} role="listbox" aria-label="Members" className="mt-mention-list">
      {items.map((it, i) => (
        <li
          key={it.id}
          id={`${listId}-opt-${i}`}
          role="option"
          aria-selected={i === active}
          className={`mt-mention-opt ${i === active ? 'is-active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); insert(it); }}
          onMouseEnter={() => setActive(i)}
        >
          <Avatar author={{ display_name: it.name, avatar_url: it.avatar_url, role: it.role }} size="s" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{it.name}</span>
            <span className="block truncate text-xs text-muted">@{it.username}</span>
          </span>
        </li>
      ))}
    </ul>
  ) : null;

  return { onChange, onKeyDown, aria, list };
}
