/**
 * Inaugurators.jsx — the permanent Wall. Route: /inaugurators (app chrome).
 *
 * Every opener who cut the ribbon, as a field of carved standing-stones (name
 * beneath each). Lives on the site forever. No numbers, no messages — just names
 * in stone. Search highlights your own.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Gift } from 'lucide-react';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import Stone from '../components/opening/Stone';
import { getWall, getOpeningStatus } from '../services/opening';

export default function Inaugurators() {
  const [stones, setStones] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(null);
  const [q, setQ] = useState('');
  const sentinel = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const { openers, next_cursor } = await getWall(cursor);
      setStones((prev) => [...prev, ...openers]);
      if (next_cursor == null) setDone(true); else setCursor(next_cursor);
    } catch { setDone(true); } finally { setLoading(false); }
  }, [cursor, loading, done]);

  useEffect(() => { loadMore(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { getOpeningStatus().then((s) => setCount(s.count)).catch(() => {}); }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const needle = q.trim().toLowerCase();
  const match = (s) => needle && s.name.toLowerCase().includes(needle);

  return (
    <main className="min-h-screen bg-sand">
      <Seo title="The Inaugurators — Meeticulous"
           description="The people who opened the doors. Every founder who cut the ribbon on launch day, in stone, forever."
           image={ogCard('inaugurators', 'png')} />

      <section className="mx-auto max-w-5xl px-4 py-14 text-center">
        <p className="inline-flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-[.14em] text-primary">
          <Gift size={15} /> The Inaugurators
        </p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-ink sm:text-5xl">The people who opened the doors</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          {count != null
            ? <>Every one of these <strong className="text-ink tabular-nums">{count.toLocaleString('en-IN')}</strong> names cut the ribbon on launch day. Set in stone. Forever.</>
            : 'Every name here cut the ribbon on launch day. Set in stone. Forever.'}
        </p>

        <div className="mx-auto mt-8 flex max-w-sm items-center gap-2.5 rounded-full border border-black/10 bg-white px-4 py-3 shadow-[0_4px_14px_rgba(16,24,40,.10)] focus-within:border-primary">
          <Search size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name…"
                 aria-label="Search inaugurators by name"
                 className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stones.map((s, i) => (
            <li key={i} className={`transition ${needle ? (match(s) ? 'scale-110' : 'opacity-25') : ''}`}>
              <Stone name={s.name} shade={s.shade} shape={s.shape} />
            </li>
          ))}
        </ul>

        <div ref={sentinel} className="h-10" />
        {loading && <p className="py-6 text-center text-sm text-muted">Laying stones…</p>}
        {done && stones.length === 0 && (
          <p className="py-16 text-center text-muted">
            No stones yet. The doors open soon — <Link to="/opening" className="font-semibold text-primary underline">be the first</Link>.
          </p>
        )}
        {done && stones.length > 0 && (
          <p className="py-8 text-center text-sm text-muted">That’s everyone. The wall is sealed.</p>
        )}
      </section>
    </main>
  );
}
