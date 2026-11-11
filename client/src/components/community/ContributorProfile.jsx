import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MoreHorizontal, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import TipWidget from './TipWidget';
import Dialog from './Dialog';

// Public profile for a community contributor (Tithi, the founder, …). Presentational:
// all copy comes in via `data`. Loop & Slot tokens only. Layout follows a classic
// social header — full-width cover, avatar overlapping bottom-left with a ring,
// name + subtitle, icon actions, then an underline tab bar; content is a 65/35
// grid (feed left, the UPI tip jar right).

function Seal({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Verified" className="shrink-0">
      <path fill="#960D32" d="M21 12c0 1.27-.63 2.39-1.59 3.07a3.75 3.75 0 0 1-1.04 3.3 3.75 3.75 0 0 1-3.3 1.04A3.75 3.75 0 0 1 12 21c-1.27 0-2.39-.63-3.07-1.59a3.75 3.75 0 0 1-3.3-1.04 3.75 3.75 0 0 1-1.04-3.3A3.75 3.75 0 0 1 3 12c0-1.27.63-2.39 1.59-3.07a3.75 3.75 0 0 1 1.04-3.3 3.75 3.75 0 0 1 3.3-1.04A3.75 3.75 0 0 1 12 3c1.27 0 2.39.63 3.07 1.59a3.75 3.75 0 0 1 3.3 1.04 3.75 3.75 0 0 1 1.04 3.3A3.75 3.75 0 0 1 21 12z" />
      <path d="M8.5 12.5l2.25 2.25L15.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatar({ avatar, name }) {
  // Ringed, rounded-square avatar that overlaps the cover.
  return (
    <span className="block rounded-[30px] bg-gradient-to-br from-pink to-rose p-[4px] shadow-lg">
      {avatar?.src
        ? <img src={avatar.src} alt={name} className="h-24 w-24 rounded-[26px] border-[3px] border-white object-cover sm:h-28 sm:w-28" />
        : (
          <span className="grid h-24 w-24 place-items-center rounded-[26px] border-[3px] border-white bg-gradient-to-br from-pink via-pink to-rose font-display text-4xl font-extrabold text-[#5c0620] sm:h-28 sm:w-28">
            {avatar?.initial || name.charAt(0)}
          </span>
        )}
    </span>
  );
}

function IconBtn({ label, primary, onClick, href, children }) {
  const cls = `grid h-[38px] w-[38px] place-items-center rounded-2xl border transition-colors ${
    primary ? 'border-transparent bg-maroon text-cream hover:bg-maroon-dark'
            : 'border-ink/10 bg-white text-ink hover:bg-cream'}`;
  if (href) return <a href={href} aria-label={label} className={`${cls} no-underline`}>{children}</a>;
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{children}</button>;
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
  const { user } = useAuth();
  // Only an authorised viewer (admin) may redirect this session's tip recipient;
  // visitors never see the editor, so they can't divert contributions.
  const canEditRecipient = !!user?.is_admin;
  const [tab, setTab] = useState('posts');
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  useEffect(() => { if (data.pageTitle) document.title = data.pageTitle; }, [data.pageTitle]);

  const sendMessage = (e) => {
    e.preventDefault();
    window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setCompose(false);
  };
  const shareProfile = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); toast.success('Profile link copied'); }
    catch { toast('Copy this link: ' + url); }
  };

  const TABS = [
    { key: 'posts', label: 'Posts', count: data.posts?.length || 0 },
    { key: 'badges', label: 'Badges', count: data.badges?.length || 0 },
    { key: 'about', label: 'About' },
    { key: 'links', label: 'Links' },
  ];

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-6xl px-5 py-8 lg:py-10">
       <div className="grid gap-6 lg:grid-cols-[55fr_45fr] lg:items-start">
        {/* LEFT — the whole profile card */}
        <div className="min-w-0">

        {/* ---- Cover banner ---- */}
        <div className="relative h-44 overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-br from-blush via-cream to-[#FFF3E3] sm:h-56">
          {data.cover && <img src={data.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {!data.cover && (
            <svg viewBox="0 0 1120 224" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full opacity-50">
              <path d="M-20 160 C 200 70, 340 70, 540 140 S 920 210, 1140 100" fill="none" stroke="#E0506F" strokeWidth="2.5" opacity=".5" />
              <path d="M-20 128 C 240 200, 440 180, 660 120 S 1000 48, 1140 150" fill="none" stroke="#FF9FB0" strokeWidth="2" opacity=".4" />
            </svg>
          )}
          {data.houseLabel && (
            <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-marigold" aria-hidden="true" />{data.houseLabel}
            </span>
          )}
        </div>

        {/* ---- Header: centered on mobile, left-aligned row on desktop ---- */}
        <div className="flex flex-col items-center gap-3 px-1 text-center sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 sm:px-3 sm:text-left">
          <div className="flex flex-col items-center gap-2 sm:min-w-0 sm:flex-row sm:items-end sm:gap-4">
            <div className="relative z-10 -mt-14 shrink-0 sm:ml-2 sm:-mt-20"><Avatar avatar={data.avatar} name={data.name} /></div>
            <div className="min-w-0 translate-y-1">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="translate-y-[3px] font-display text-2xl font-extrabold leading-none tracking-tight text-maroon sm:truncate sm:text-3xl">{data.name}</h1>
                {data.verified && <span className="-translate-y-[2px]"><Seal size={22} /></span>}
              </div>
              <p className="mt-0.5 -translate-y-[10px] text-xs text-ink/70 sm:truncate">
                {data.title && <strong className="font-semibold text-ink">{data.title}</strong>}{data.title && data.org ? ' · ' : ''}{data.org}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 sm:pb-1">
            {data.email && (
              <IconBtn label={`Message ${data.name}`} primary onClick={() => setCompose(true)}>
                <Mail size={18} aria-hidden="true" />
              </IconBtn>
            )}
            <IconBtn label="Share profile" onClick={shareProfile}><Share2 size={18} aria-hidden="true" /></IconBtn>
            <IconBtn label="More"><MoreHorizontal size={18} aria-hidden="true" /></IconBtn>
          </div>
        </div>

        {/* ---- Tab bar (full width, underline + counts) ---- */}
        <div role="tablist" aria-label="Profile sections" className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-1 border-b border-ink/10 px-1 sm:justify-start sm:px-3">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`relative -mb-px py-3 text-sm font-semibold transition-colors ${
                  on ? 'text-maroon' : 'text-ink/50 hover:text-ink'}`}
              >
                {t.label}
                {t.count != null && <span className="ml-1.5 text-xs font-bold text-ink/40">{t.count}</span>}
                {on && <span className="absolute inset-x-0 bottom-0 h-[1.5px] bg-maroon" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

          {/* feed */}
          <div className="mt-6 flex flex-col gap-4">
            {/* intro: the one serif line + bio, always above the tab content */}
            {(data.script || data.bio) && (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 bg-white p-5">
                {data.script && <p className="font-serif text-2xl italic leading-tight text-rose">{data.script}</p>}
                {data.bio && <p className="text-sm leading-relaxed text-ink/80">{data.bio}</p>}
              </div>
            )}

            {tab === 'posts' && (
              data.posts?.length
                ? data.posts.map((p, i) => <PostCard key={i} post={p} />)
                : <p className="text-sm text-ink/60">Nothing posted yet.</p>
            )}

            {tab === 'badges' && (
              <div className="flex flex-wrap gap-2.5 rounded-2xl border-2 border-ink/10 bg-white p-5">
                {(data.badges || []).map((b) => (
                  <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-2 text-sm font-semibold text-ink">
                    <span aria-hidden="true">{b.emoji}</span>{b.label}
                  </span>
                ))}
                {!data.badges?.length && <p className="text-sm text-ink/60">No badges yet.</p>}
              </div>
            )}

            {tab === 'about' && (
              <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink/10 bg-white p-5">
                {(data.about || []).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink/80">{para}</p>
                ))}
                {data.stats?.length > 0 && (
                  <dl className="mt-2 grid grid-cols-3 gap-2.5">
                    {data.stats.map((s) => (
                      <div key={s.label} className="rounded-[20px] border border-ink/10 bg-cream px-4 py-3">
                        <dd className="font-display text-xl font-extrabold leading-none text-ink">{s.value}</dd>
                        <dt className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}
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
        </div>{/* end left profile card */}

        {/* RIGHT — the support option, beside the card */}
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <TipWidget vpa={data.tip.vpa} payeeName={data.tip.payeeName} note={data.tip.note} heading={data.tip.heading} editableRecipient={canEditRecipient} contactEmail={data.email} displayName={data.name} />
          </div>
        </aside>
       </div>{/* end grid */}
      </div>

      {compose && (
        <Dialog title={`Message ${data.name}`} onClose={() => setCompose(false)}>
          <form onSubmit={sendMessage} className="flex flex-col gap-4">
            <div className="mt-field">
              <label className="mt-label" htmlFor="msg-subject">Subject</label>
              <div className="mt-input"><input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" className="focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" /></div>
            </div>
            <div className="mt-field">
              <label className="mt-label" htmlFor="msg-body">Message</label>
              <div className="mt-input mt-input--textarea"><textarea id="msg-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Write to ${data.name}…`} className="resize-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" /></div>
            </div>
            <div className="mt-dialog__actions">
              <button type="button" onClick={() => setCompose(false)} className="mt-btn mt-btn--ghost">Cancel</button>
              <button type="submit" disabled={!body.trim()} className="mt-btn">Send</button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
