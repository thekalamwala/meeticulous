import { useEffect, useState } from 'react';
import TipWidget from './TipWidget';

// Hand-built public profile for a community contributor (Tithi, founder, …).
// Presentational: all copy comes in via `data`. Loop & Slot tokens only.

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
  { key: 'links', label: 'Links' },
];

function Avatar({ avatar, name }) {
  if (avatar?.src) {
    return <img src={avatar.src} alt={name} className="h-24 w-24 rounded-full border-4 border-cream object-cover sm:h-28 sm:w-28" />;
  }
  return (
    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-maroon font-display text-4xl text-cream sm:h-28 sm:w-28">
      {avatar?.initial || name.charAt(0)}
    </span>
  );
}

function PostCard({ post }) {
  return (
    <article className="mt-slot gap-3 border-2 border-ink/10 bg-white p-5">
      {post.banner && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-blush px-4 py-2 text-sm text-maroon">
          <span>🎥 {post.banner}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-maroon">{post.category}</span>
        {post.time && <span className="text-xs text-ink/50">{post.time}</span>}
      </div>
      <h3 className="font-display text-lg text-ink">{post.title}</h3>
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
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-16">

        {/* LEFT: profile + tabs + feed */}
        <div className="min-w-0">
          <section className="rounded-3xl bg-blush p-7 sm:p-9">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Avatar avatar={data.avatar} name={data.name} />
              <div className="min-w-0">
                <h1 className="font-display text-3xl leading-tight text-maroon sm:text-4xl">{data.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {data.title && <span className="rounded-full bg-maroon px-3 py-1 text-sm font-medium text-cream">{data.title}</span>}
                  {data.handle && <span className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink">{data.handle}</span>}
                </div>
              </div>
            </div>

            {data.script && <p className="mt-6 font-serif text-2xl italic text-rose">{data.script}</p>}
            {data.bio && <p className="mt-4 max-w-xl text-base leading-relaxed text-ink/80">{data.bio}</p>}

            {data.stats?.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-8">
                {data.stats.map((s) => (
                  <div key={s.label}>
                    <dd className="font-display text-xl text-ink">{s.value}</dd>
                    <dt className="text-xs uppercase tracking-wide text-ink/50">{s.label}</dt>
                  </div>
                ))}
              </dl>
            )}

            {data.badges?.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {data.badges.map((b) => (
                  <li key={b.label} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink">
                    <span aria-hidden="true">{b.emoji}</span> {b.label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tabs */}
          <div role="tablist" aria-label="Profile sections" className="mt-8 flex gap-1 border-b-2 border-ink/10">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`-mb-0.5 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    on ? 'border-maroon text-maroon' : 'border-transparent text-ink/50 hover:text-ink'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="mt-6 flex flex-col gap-4">
            {tab === 'posts' && (
              (data.posts?.length
                ? data.posts.map((p, i) => <PostCard key={i} post={p} />)
                : <p className="text-sm text-ink/60">Nothing posted yet.</p>)
            )}
            {tab === 'about' && (
              <div className="mt-card gap-3">
                {(data.about || []).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink/80">{para}</p>
                ))}
              </div>
            )}
            {tab === 'links' && (
              <ul className="mt-card gap-2">
                {(data.links || []).map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-maroon underline">{l.label}</a>
                  </li>
                ))}
                {!data.links?.length && <li className="text-sm text-ink/60">No links yet.</li>}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: tip jar (stacks under on mobile) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TipWidget
            vpa={data.tip.vpa}
            payeeName={data.tip.payeeName}
            note={data.tip.note}
            heading={data.tip.heading}
          />
        </aside>

      </div>
    </main>
  );
}
