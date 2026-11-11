import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, CircleAlert, CircleHelp, Headset, Image, ImagePlus, Megaphone, MessagesSquare, Type, X } from 'lucide-react';
import { createItem, getMe, getSpaces } from '../../services/communityApi';
import useKeyboardInset from './useKeyboardInset';
import { uploadImage } from '../../services/api';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import useTermsGate from './useTermsGate';
import { errCode, errorCopy, fmtCount } from './communityErrors';
import ItemCard, { SpaceIcon } from './ItemCard';

const LIMITS = { TITLE: 150, THREAD: 10000, POST: 1000 }; // mirrors server/services/community/text.js
const MAX_PHOTOS = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const FORMATS = {
  text: { label: 'Text', hint: 'A post with up to 4 photos', Icon: Type },
  question: { label: 'Question', hint: 'You can mark the best answer', Icon: CircleHelp },
  announcement: { label: 'Announcement', hint: 'Official accounts only', Icon: Megaphone },
};
// Spec §13: the Updates space and announcements are for official accounts only (not staff).
const isOfficial = (member) => member?.badge === 'official';
// Defamation nudge (spec 10.7): an @mention plus a complaint word. Advice only, never blocks.
// Mirrors the server mention parser (text.js) without lookbehind (older Safari can't parse it).
const MENTION = /(^|[^\w.@-])@[a-z0-9][a-z0-9-]*(?![\w@-])/i;
const COMPLAINT = /(scam|fraud|cheat|refund|worst|rude|no-show|didn['’]t show)/i;

const canPost = (space, user, member) => {
  if (space.post_policy === 'official') return isOfficial(member);
  if (space.post_policy === 'hosts') return !!user?.is_host;
  return true;
};

// Natural size of the picked file, so the feed can reserve space (empty if it can't be read).
const measure = (file) => new Promise((resolve) => {
  if (typeof URL.createObjectURL !== 'function') return resolve({});
  const src = URL.createObjectURL(file);
  const img = new window.Image();
  img.onload = () => { URL.revokeObjectURL(src); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
  img.onerror = () => { URL.revokeObjectURL(src); resolve({}); };
  img.src = src;
});

// The composer form + all its state. Rendered inside a Dialog (modal) by Composer.jsx,
// or full-width with a live preview by the /community/new page (NewPost.jsx).
// `variant`: 'modal' | 'page'. `dirtyRef` (modal): the wrapper reads it to confirm before closing.
export default function ComposerForm({ variant = 'modal', onClose, onCreated, defaultKind, defaultSpaceKey, dirtyRef }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guard, termsDialog] = useTermsGate();
  const [kind, setKind] = useState(defaultKind === 'thread' ? 'thread' : 'post');
  const [format, setFormat] = useState(defaultKind === 'question' ? 'question' : 'text');
  const [spaces, setSpaces] = useState([]);
  const [member, setMember] = useState(null);
  const [space, setSpace] = useState(defaultSpaceKey || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]); // {id, preview, url?, width?, height?, busy}
  const [menu, setMenu] = useState(false);
  const [err, setErr] = useState('');
  const [photoErr, setPhotoErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [banned, setBanned] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const fileRef = useRef(null);
  const kbInset = useKeyboardInset();

  useEffect(() => {
    let live = true;
    getSpaces().then((d) => live && setSpaces(d.spaces || [])).catch(() => {});
    getMe().then((d) => {
      if (!live) return;
      setMember(d.member);
      if (d.member?.banned_until && new Date(d.member.banned_until) > new Date()) setBanned(true);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const eligible = spaces.filter((s) => canPost(s, user, member));
  const effSpace = eligible.some((s) => s.key === space) ? space : (kind === 'thread' ? eligible[0]?.key || '' : '');
  const formats = Object.keys(FORMATS).filter((f) => f !== 'announcement' || isOfficial(member));
  const thread = kind === 'thread';
  const max = thread ? LIMITS.THREAD : LIMITS.POST;
  const uploading = photos.some((p) => p.busy);
  const over = body.length > max || title.length > LIMITS.TITLE;
  const ready = body.trim() && (!thread || (title.trim() && effSpace)) && !over && !uploading && !busy && !banned;
  const text = `${title} ${body}`;
  const nudge = MENTION.test(text) && COMPLAINT.test(text);
  // The modal wrapper reads this to ask before discarding a draft on Esc / backdrop / Close.
  if (dirtyRef) dirtyRef.current = !!(title.trim() || body.trim() || photos.length);

  const addFiles = async (list) => {
    setPhotoErr('');
    const room = MAX_PHOTOS - photos.length;
    const files = [...list].slice(0, room);
    if (list.length > room) setPhotoErr(`You can add up to ${MAX_PHOTOS} photos.`);
    for (const file of files) {
      if (!TYPES.includes(file.type)) { setPhotoErr('Photos must be JPG, PNG or WEBP.'); continue; }
      if (file.size > MAX_BYTES) { setPhotoErr('Photos can be at most 2 MB.'); continue; }
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      const preview = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
      setPhotos((p) => [...p, { id, preview, busy: true }]);
      try {
        const fd = new FormData();
        fd.append('image', file);
        const [{ data }, size] = await Promise.all([uploadImage(fd, 'community'), measure(file)]);
        setPhotos((p) => p.map((x) => (x.id === id ? { ...x, url: data.url, ...size, busy: false } : x)));
      } catch {
        setPhotos((p) => p.filter((x) => x.id !== id));
        setPhotoErr("Couldn't upload that photo. Please try again.");
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr('');
    const payload = {
      kind, format, body: body.trim(),
      ...(thread && { title: title.trim() }),
      ...(effSpace && { space_key: effSpace }),
      media: photos.map(({ url, width, height }) => ({ url, width, height })),
    };
    try {
      const { item } = await guard(() => createItem(payload));
      analytics.track(EVENTS.COMMUNITY_POST_CREATED, { kind, format, space: effSpace || null });
      onCreated?.(item);
      if (dirtyRef) dirtyRef.current = false; // created: don't prompt on the close that follows
      onClose?.();
      navigate(item.url);
    } catch (e2) {
      if (!e2?.cancelled) {
        if (errCode(e2) === 'COMMUNITY_BANNED') setBanned(true);
        setErr(errorCopy(e2, user));
      }
      setBusy(false);
    }
  };

  const F = FORMATS[format];

  // Live preview (page only): the real feed card built from the current draft.
  const previewItem = {
    id: 'preview', kind, format,
    title: thread ? title.trim() : '',
    body: body.trim() || 'Your post will appear here as you write.',
    status: 'visible', created_at: new Date().toISOString(),
    author: {
      display_name: user?.name || user?.first_name || 'You',
      avatar_url: user?.profile_image || null,
      role: user?.is_host ? 'host' : 'guest',
    },
    space: effSpace ? (eligible.find((s) => s.key === effSpace) || null) : null,
    media: photos.filter((p) => p.url).map((p) => ({ url: p.url, width: p.width, height: p.height })),
    like_count: 0, comment_count: 0, viewer: { liked: false }, url: '#',
  };

  const form = (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div role="tablist" aria-label="Type" className="mt-tabs self-start">
        {[['post', 'Post'], ['thread', 'Thread']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className="mt-tab">{label}</button>
        ))}
      </div>

      <div className="mt-field">
        <span className="mt-label" id="composer-space-label">Space{!thread && <> <span className="mt-hint">(optional for posts)</span></>}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="composer-space-label">
          {!thread && (
            <button type="button" onClick={() => setSpace('')} aria-pressed={!effSpace}
              className={`mt-tag ${!effSpace ? 'mt-tag--selected' : ''}`}>Feed only</button>
          )}
          {eligible.map((s) => (
            <button key={s.key} type="button" onClick={() => setSpace(s.key)} aria-pressed={effSpace === s.key}
              className={`mt-tag ${effSpace === s.key ? 'mt-tag--selected' : ''}`}>
              <SpaceIcon spaceKey={s.key} size={16} />{s.name}
            </button>
          ))}
        </div>
        {thread && <span className="mt-hint">Required for threads.</span>}
      </div>

      {thread && (
        <div className="mt-field">
          <label className="mt-label" htmlFor="composer-title">Title</label>
          <div className="mt-input"><input id="composer-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="mt-field-foot">
            <span className="mt-hint">Ask it like a question people can answer.</span>
            <span className={`mt-counter ${title.length > LIMITS.TITLE ? 'mt-counter--over' : ''}`}>{fmtCount(title.length)} / {fmtCount(LIMITS.TITLE)}</span>
          </div>
        </div>
      )}

      <div className={`mt-field ${err ? 'mt-field--error' : ''}`}>
        <label className="mt-label" htmlFor="composer-body">{thread ? 'Details' : "What's on your mind?"}</label>
        <div className="mt-input mt-input--textarea">
          <textarea id="composer-body" value={body} onChange={(e) => setBody(e.target.value)} aria-describedby={err ? 'composer-err' : undefined} aria-invalid={!!err || undefined} />
        </div>
        <div className="mt-field-foot">
          {err
            ? <span id="composer-err" role="alert" className="mt-hint mt-hint-row"><CircleAlert size={16} aria-hidden="true" />{err}</span>
            : <span className="mt-hint">{thread ? 'Plain text. Links are added automatically.' : 'Be kind. No phone numbers or emails.'}</span>}
          <span aria-live="polite" className={`mt-counter ${body.length > max ? 'mt-counter--over' : ''}`}>{fmtCount(body.length)} / {fmtCount(max)}</span>
        </div>
      </div>

      {nudge && (
        <div className="mt-nudge" role="status">
          <Headset size={20} aria-hidden="true" />
          <span className="flex-1">Problem with a booking? <Link to="/support">Support can help →</Link></span>
        </div>
      )}

      {(photos.length > 0 || photoErr) && (
        <div className="mt-field">
          <span className="mt-label">Photos <span className="mt-hint">{photos.length} of {MAX_PHOTOS} · JPG, PNG or WEBP, up to 2 MB</span></span>
          <div className="mt-photostrip">
            {photos.map((p, i) => (
              <div key={p.id} className={`mt-thumb ${p.busy ? 'mt-thumb--busy' : ''}`}>
                {p.preview ? <img src={p.preview} alt={`Photo ${i + 1}`} /> : <ImagePlus size={24} aria-hidden="true" />}
                {p.busy && <span className="sr-only" role="status">Uploading photo {i + 1}</span>}
                <button type="button" className="mt-btn mt-btn--secondary" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))}><X size={16} aria-hidden="true" /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" className="mt-thumb-add" onClick={() => fileRef.current?.click()}><ImagePlus size={20} aria-hidden="true" />Add photo</button>
            )}
          </div>
          {photoErr && <span role="alert" className="mt-hint mt-field--error">{photoErr}</span>}
        </div>
      )}

      <div className="mt-toolbar">
        <button type="button" className="mt-btn mt-btn--secondary mt-btn--s" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <F.Icon size={16} aria-hidden="true" />Format: {F.label}<ChevronDown size={16} aria-hidden="true" />
        </button>
        {menu && (
          <div className="mt-menu" role="menu" aria-label="Format">
            {formats.map((f) => {
              const { Icon, label, hint } = FORMATS[f];
              return (
                <button key={f} type="button" role="menuitemradio" aria-checked={format === f} className="mt-menu__item" onClick={() => { setFormat(f); setMenu(false); }}>
                  <Icon size={20} aria-hidden="true" /><span>{label}<small>{hint}</small></span>
                </button>
              );
            })}
          </div>
        )}
        {photos.length === 0 && (
          <button type="button" className="mt-btn mt-btn--ghost mt-iconbtn mt-btn--s" aria-label="Add photo" onClick={() => fileRef.current?.click()}><ImagePlus size={20} aria-hidden="true" /></button>
        )}
        <input ref={fileRef} type="file" accept={TYPES.join(',')} multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <span className="mt-toolbar__grow" />
        <button type="submit" className="mt-btn" disabled={!ready}>{thread ? 'Post thread' : 'Post'}</button>
      </div>
    </form>
  );

  // Full-screen mobile composer (v2): X / audience / Post header, autofocus body,
  // and a bottom toolbar kept above the keyboard via VisualViewport (kbInset).
  if (variant === 'fullscreen') {
    const audienceLabel = effSpace ? (eligible.find((s) => s.key === effSpace)?.name || 'Space') : 'Everyone';
    return (
      <>
        <div className="mt-composer-full" role="dialog" aria-modal="true" aria-label={thread ? 'New thread' : 'New post'}>
          <header className="mt-composer-full__head">
            <button type="button" onClick={onClose} aria-label="Close composer" className="mt-btn mt-btn--ghost mt-iconbtn mt-btn--s"><X size={20} aria-hidden="true" /></button>
            <button type="button" onClick={() => setAudienceOpen((o) => !o)} aria-haspopup="menu" aria-expanded={audienceOpen} className="mt-btn mt-btn--secondary mt-btn--s gap-1">
              {audienceLabel}<ChevronDown size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={submit} disabled={!ready} className="mt-btn mt-btn--s ml-auto">{thread ? 'Post thread' : 'Post'}</button>
          </header>

          {audienceOpen && (
            <div className="mt-composer-full__audience" role="menu" aria-label="Audience">
              {!thread && (
                <button type="button" role="menuitemradio" aria-checked={!effSpace} onClick={() => { setSpace(''); setAudienceOpen(false); }} className={`mt-tag ${!effSpace ? 'mt-tag--selected' : ''}`}>Everyone</button>
              )}
              {eligible.map((s) => (
                <button key={s.key} type="button" role="menuitemradio" aria-checked={effSpace === s.key} onClick={() => { setSpace(s.key); setAudienceOpen(false); }} className={`mt-tag ${effSpace === s.key ? 'mt-tag--selected' : ''}`}>
                  <SpaceIcon spaceKey={s.key} size={16} />{s.name}
                </button>
              ))}
            </div>
          )}

          {thread && (
            <input className="mt-composer-full__title" aria-label="Title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.TITLE} />
          )}

          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a composer the user tapped into to write */}
          <textarea autoFocus aria-label="Share something with the community" placeholder="Share something with the community…" value={body} onChange={(e) => setBody(e.target.value)} className="mt-composer-full__body" />

          {err && <p role="alert" className="mt-hint mt-field--error px-4 pb-2">{err}</p>}

          {photos.length > 0 && (
            <div className="mt-photostrip px-4 pb-2">
              {photos.map((p, i) => (
                <div key={p.id} className={`mt-thumb ${p.busy ? 'mt-thumb--busy' : ''}`}>
                  {p.preview ? <img src={p.preview} alt={`Photo ${i + 1}`} /> : <ImagePlus size={24} aria-hidden="true" />}
                  {p.busy && <span className="sr-only" role="status">Uploading photo {i + 1}</span>}
                  <button type="button" className="mt-btn mt-btn--secondary" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))}><X size={16} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-composer-full__toolbar" style={kbInset ? { transform: `translateY(-${kbInset}px)` } : undefined}>
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add photo" className="mt-btn mt-btn--ghost mt-btn--s gap-2"><Image size={20} aria-hidden="true" />Photo</button>
            <button type="button" aria-pressed={format === 'question'} onClick={() => setFormat((f) => (f === 'question' ? 'text' : 'question'))} className="mt-btn mt-btn--ghost mt-btn--s gap-2"><CircleHelp size={20} aria-hidden="true" />Ask</button>
            <button type="button" aria-pressed={thread} onClick={() => setKind((k) => (k === 'thread' ? 'post' : 'thread'))} className="mt-btn mt-btn--ghost mt-btn--s gap-2"><MessagesSquare size={20} aria-hidden="true" />Thread</button>
            <input ref={fileRef} type="file" accept={TYPES.join(',')} multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>
        {termsDialog}
      </>
    );
  }

  if (variant === 'page') {
    return (
      <>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="mt-card p-5 sm:p-6">{form}</div>
          <div className="lg:sticky lg:top-24">
            <span className="mt-card__kicker mb-2 block">Preview</span>
            <ItemCard item={previewItem} detail />
          </div>
        </div>
        {termsDialog}
      </>
    );
  }

  return <>{form}{termsDialog}</>;
}

export { LIMITS, canPost };
