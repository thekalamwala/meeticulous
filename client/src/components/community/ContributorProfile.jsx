import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle } from 'lucide-react';
import TipWidget from './TipWidget';

// Public profile for a community contributor (Tithi, the founder, …). Presentational:
// all copy comes in via `data`. Loop & Slot tokens only. Layout: a 65/35 hero —
// profile panel left, the UPI tip jar right — then tabs + feed below.

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
  { key: 'links', label: 'Links' },
];

// Scalloped verified seal (same mark as the community IdentityBadge).
function Seal({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Verified" className="shrink-0">
      <path fill="#960D32" d="M21 12c0 1.27-.63 2.39-1.59 3.07a3.75 3.75 0 0 1-1.04 3.3 3.75 3.75 0 0 1-3.3 1.04A3.75 3.75 0 0 1 12 21c-1.27 0-2.39-.63-3.07-1.59a3.75 3.75 0 0 1-3.3-1.04 3.75 3.75 0 0 1-1.04-3.3A3.75 3.75 0 0 1 3 12c0-1.27.63-2.39 1.59-3.07a3.75 3.75 0 0 1 1.04-3.3 3.75 3.75 0 0 1 3.3-1.04A3.75 3.75 0 0 1 12 3c1.27 0 2.39.63 3.07 1.59a3.75 3.75 0 0 1 3.3 1.04 3.75 3.75 0 0 1 1.04 3.3A3.75 3.75 0 0 1 21 12z" />
      <path d="M8.5 12.5l2.25 2.25L15.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatar({ avatar, name }) {
  if (avatar?.src) {
    return <img src={avatar.src} alt={name} className="h-24 w-24 rounded-[26px] border-[5px] border-white object-cover shadow-sm" />;
  }
  return (
    <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[26px] border-[5px] border-white bg-gradient-to-br from-pink via-pink to-rose font-display text-4xl font-extrabold text-[#5c0620] shadow-sm">
      {avatar?.initial || name.charAt(0)}
    </span>
  );
}

function PostCard({ post }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-ink/10 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-maroon">{post.category}</span>
        {post.time && <span className="text-xs text-ink/50">{post.time}</span>}
      </div>
      <h3 className="font-display text-lg font-extrabold leading-tight text-ink">{post.title}</h3>
      {post.excerpt && <p className="text-sm leading-relaxed text-ink/70">{post.excerpt}</p>}
      {(post.replies != null || post.likes != null) && (
        <div className="flex gap-4 text-sm text-ink/60">
          {post.replies != null && <span>💬 {post.replies} replies</span>}
          {post.likes != null && <span>❤️ {post.likes} likes</span>}
        </div>
      )}
    </article>
  );
}

export default function ContributorProfile({ data }) {
  const [tab, setTab] = useState('posts');
  useEffect(() => { if (data.pageTitle) document.title = data.pageTitle; }, [data.pageTitle]);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-6xl px-5 py-10 lg:py-14">

        {/* ---- Hero: 65 / 35 ---- */}
        <div className="grid gap-6 lg:grid-cols-[65fr_35fr] lg:items-stretch lg:min-h-[78vh]">

          {/* LEFT — profile */}
          <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
            <div className="relative h-32 bg-gradient-to-br from-blush via-cream to-[#FFF3E3]">
              <svg viewBox="0 0 600 128" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full opacity-50">
                <path d="M-10 92 C 120 36, 220 36, 340 84 S 520 120, 610 56" fill="none" stroke="#E0506F" strokeWidth="2.5" opacity=".55" />
                <path d="M-10 72 C 150 120, 300 104, 440 64 S 560 28, 610 86" fill="none" stroke="#FF9FB0" strokeWidth="2" opacity=".45" />
              </svg>
              {data.script && (
                <p className="absolute left-6 top-1/2 -translate-y-1/2 font-serif text-3xl italic leading-none text-maroon sm:text-4xl">
                  {data.script}
                </p>
              )}
              {data.houseLabel && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
                  <span className="h-2 w-2 rounded-full bg-marigold" aria-hidden="true" />{data.houseLabel}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 px-6 pb-6">
              <div className="-mt-12"><Avatar avatar={data.avatar} name={data.name} /></div>

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-maroon">{data.name}</h1>
                  {data.verified && <Seal />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {data.title && <span className="font-medium text-ink"><strong className="font-semibold">{data.title}</strong>{data.org ? ` · ${data.org}` : ''}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {data.handle && <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink">{data.handle}</span>}
                  {data.location && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-medium text-ink">
                      <MapPin size={13} className="text-ink/50" aria-hidden="true" />{data.location}
                    </span>
                  )}
                </div>
              </div>

              {data.bio && <p className="max-w-prose text-sm leading-relaxed text-ink/80">{data.bio}</p>}

              <div className="flex flex-wrap gap-2.5">
                {data.email && (
                  <a href={`mailto:${data.email}`} className="mt-btn gap-2 no-underline">
                    <Mail size={16} aria-hidden="true" />Message
                  </a>
                )}
                <a href="/community" className="mt-btn mt-btn--secondary gap-2 no-underline">
                  <MessageCircle size={16} aria-hidden="true" />Say hi in the Circle
                </a>
              </div>

              {data.badges?.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {data.badges.map((b) => (
                    <li key={b.label} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-ink">
                      <span aria-hidden="true">{b.emoji}</span>{b.label}
                    </li>
                  ))}
                </ul>
              )}

              {data.stats?.length > 0 && (
                <dl className="mt-auto grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-3">
                  {data.stats.map((s) => (
                    <div key={s.label} className="rounded-[20px] border border-ink/10 bg-cream px-4 py-3">
                      <dd className="font-display text-xl font-extrabold leading-none text-ink">{s.value}</dd>
                      <dt className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">{s.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>

          {/* RIGHT — UPI tip jar (existing QR system) */}
          <aside className="min-w-0">
            <div className="lg:sticky lg:top-24">
              <TipWidget vpa={data.tip.vpa} payeeName={data.tip.payeeName} note={data.tip.note} heading={data.tip.heading} />
            </div>
          </aside>
        </div>

        {/* ---- Tabs + feed ---- */}
        <div className="mt-10 max-w-2xl">
          <div role="tablist" aria-label="Profile sections" className="flex gap-6 border-b-2 border-ink/10">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`-mb-0.5 border-b-[3px] px-1 py-3 text-sm font-semibold transition-colors ${
                    on ? 'border-maroon text-maroon' : 'border-transparent text-ink/50 hover:text-ink'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="mt-5 flex flex-col gap-4">
            {tab === 'posts' && (
              data.posts?.length
                ? data.posts.map((p, i) => <PostCard key={i} post={p} />)
                : <p className="text-sm text-ink/60">Nothing posted yet.</p>
            )}
            {tab === 'about' && (
              <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink/10 bg-white p-5">
                {(data.about || []).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink/80">{para}</p>
                ))}
              </div>
            )}
            {tab === 'links' && (
              <ul className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 bg-white p-5">
                {(data.links || []).map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith('/')
                      ? <Link to={l.href} className="font-medium text-maroon">{l.label}</Link>
                      : <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-medium text-maroon underline">{l.label}</a>}
                  </li>
                ))}
                {!data.links?.length && <li className="text-sm text-ink/60">No links yet.</li>}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
