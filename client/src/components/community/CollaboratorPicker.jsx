import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { searchMentions } from '../../services/communityApi';

const MAX = 2;

// Search-select up to 2 community members to credit as collaborators. Controlled:
// `value` is the picked list [{id, name, avatar_url, username}], `onChange` gets the
// next list. `selfId` is excluded from results (you can't collaborate with yourself).
// Reuses the @mention member search — no new endpoint.
export default function CollaboratorPicker({ value = [], onChange, selfId = null }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const full = value.length >= MAX;

  useEffect(() => {
    let live = true;
    if (!q.trim() || full) { setResults([]); return undefined; }
    searchMentions(q)
      .then(({ members = [] } = {}) => {
        if (!live) return;
        const taken = new Set([selfId, ...value.map((v) => v.id)].filter(Boolean));
        setResults(members.filter((m) => !taken.has(m.id)));
      })
      .catch(() => { if (live) setResults([]); });
    return () => { live = false; };
  }, [q, full, value, selfId]);

  const add = (m) => {
    if (value.length >= MAX) return;
    // Keep the query so the list stays open for a 2nd pick; the added member drops
    // out of results on its own (excluded below).
    onChange([...value, { id: m.id, name: m.name, avatar_url: m.avatar_url || null, username: m.username || null }]);
  };
  const remove = (id) => onChange(value.filter((v) => v.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((c) => (
            <span key={c.id} className="mt-tag mt-tag--selected gap-1">
              {c.name}
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id)} className="inline-flex">
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {full ? (
        <span className="mt-hint">You can add up to 2 collaborators.</span>
      ) : (
        <>
          <div className="mt-input">
            <input type="search" aria-label="Search members" placeholder="Search for members"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {results.length > 0 && (
            <ul className="mt-menu" role="listbox" style={{ position: 'static' }}>
              {results.map((m) => (
                <li key={m.id}>
                  <button type="button" className="mt-menu__item w-full text-left" onClick={() => add(m)}>
                    {m.name}{m.username ? ` @${m.username}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
