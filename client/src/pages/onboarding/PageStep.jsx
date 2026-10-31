import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Loader2, Pencil, Plus, Search } from 'lucide-react';
import {
  checkOnboardingSlug,
  claimOnboardingSlug,
  getCategories,
  getOnboardingStatus,
  saveOnboardingPersona,
  suggestCategory,
} from '../../services/api';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import LivePreviewCard from './LivePreviewCard';
import { PERSONAS } from './personas';
import PetalSpinner from '../../components/common/PetalSpinner';

// Persona chip dot — one hue per persona. Static class strings so Tailwind's
// JIT keeps them; do NOT build these class names dynamically.
const DOT = {
  amber: 'bg-amber-500', blue: 'bg-blue-600', rose: 'bg-rose-600', cyan: 'bg-cyan-600',
  red: 'bg-red-600', emerald: 'bg-emerald-600', violet: 'bg-violet-600', teal: 'bg-teal-ink', // `teal` is a flat brand colour in tailwind.config (no -600)
  fuchsia: 'bg-fuchsia-600', indigo: 'bg-indigo-600', sky: 'bg-sky-600', lime: 'bg-lime-600',
};

// Fallback if the categories API is unreachable — keeps the search usable offline.
const FALLBACK = [
  { slug: 'life-coach',        label: 'Life Coach' },
  { slug: 'career-coach',      label: 'Career Coach' },
  { slug: 'software-engineer', label: 'Software Engineer' },
  { slug: 'psychologist',      label: 'Psychologist' },
  { slug: 'language-tutor',    label: 'Language Tutor' },
  { slug: 'financial-advisor', label: 'Financial Advisor' },
];

const SLUG_MSG = {
  short:    { tone: 'text-warning-fg', text: 'Minimum 3 characters.' },
  invalid:  { tone: 'text-error-fg',   text: 'Only lowercase letters, numbers, and hyphens are allowed.' },
  reserved: { tone: 'text-error-fg',   text: 'This URL is reserved and cannot be used.' },
  blocked:  { tone: 'text-error-fg',   text: 'This URL isn’t available. Try another.' },
  error:    { tone: 'text-warning-fg', text: 'Couldn’t check that URL right now. Check your connection and try again.' },
  taken:    { tone: 'text-error-fg',   text: 'This URL is taken. Try another.' },
};

const chipCls = (on) =>
  `inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition hover:shadow-[0_6px_20px_-12px_rgba(150,13,50,0.6)] active:scale-95 ${
    on ? 'onb-pop border-primary bg-primary-light font-semibold text-primary' : 'border-black/10 bg-white text-ink hover:border-primary/40'
  }`;

/**
 * PageStep — screen 1 of the host onboarding ("Your page").
 *
 * Merges the old SlugClaim + PersonaStep + CategoryStep screens. The host lands
 * on a page that already exists (Google name/photo + the auto link reserved at
 * signup); confirming the link is one glance and picking what they do is one tap.
 *
 * Routes: /vendor-register/:slug/claim, /category and /category/all all render
 * this screen, so old resume links (emails, ProtectedRoute RESUME map) keep working.
 * Server order is unchanged: claim-slug (→ step 2) then save-persona (→ step 3).
 */
const PageStep = () => {
  const { slug: urlSlug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();

  const [snap, setSnap] = useState(null);
  const [slug, setSlug] = useState(urlSlug || '');
  const [pulse, setPulse] = useState(0);
  const bump = () => setPulse((n) => n + 1);

  // Selected category: { slug, label, tag? }
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);

  // Hydrate name/photo + resume any category already saved.
  useEffect(() => {
    let alive = true;
    getOnboardingStatus()
      .then(({ data }) => {
        if (!alive || !data) return;
        setSnap(data);
        if (data.primaryCategory) {
          const p = PERSONAS.find((x) => x.slug === data.primaryCategory);
          setPicked((cur) => cur || { slug: data.primaryCategory, label: p?.label || data.primaryCategory, tag: p?.tag });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const firstName = (snap?.name || '').trim().split(/\s+/)[0];

  // ── Link editor (availability logic carried over from SlugClaim) ──────────
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [reason, setReason] = useState(null); // 'short'|'invalid'|'taken'|'reserved'|'blocked'|'error'|null
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);

  const checkSlug = useCallback(async (value) => {
    if (value.length < 3) { setChecking(false); setAvailable(false); setReason('short'); return; }
    if (!/^[a-z0-9-]+$/.test(value)) { setChecking(false); setAvailable(false); setReason('invalid'); return; }
    const seq = ++requestSeq.current;
    setChecking(true);
    try {
      const { data } = await checkOnboardingSlug(value);
      if (seq === requestSeq.current) {
        setAvailable(data.available);
        setReason(data.available ? null : (data.reason || 'taken'));
      }
    } catch {
      // A network/500 blip is NOT "taken" — don't block with a wrong reason.
      if (seq === requestSeq.current) { setAvailable(false); setReason('error'); }
    } finally {
      if (seq === requestSeq.current) setChecking(false);
    }
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const onDraft = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    setDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) { setChecking(false); setAvailable(null); setReason(null); return; }
    setChecking(true);
    setAvailable(null);
    debounceRef.current = setTimeout(() => checkSlug(value), 350);
  };

  const startEdit = () => { setDraft(slug); setAvailable(true); setReason(null); setEditing(true); };
  const saveEdit = () => {
    if (!available || checking) return;
    setSlug(draft);
    setEditing(false);
    bump();
  };

  // ── "Something else" — long-tail category search (was CategoryStep) ──────
  const [otherOpen, setOtherOpen] = useState(false);
  const [categories, setCategories] = useState(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const openOther = () => {
    setOtherOpen((o) => !o);
    if (categories) return;
    getCategories()
      .then(({ data }) => setCategories(data?.length ? data : FALLBACK))
      .catch(() => setCategories(FALLBACK));
  };

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = categories || [];
    return (q ? list.filter((c) => c.label.toLowerCase().includes(q)) : list).slice(0, 12);
  }, [categories, q]);
  const showAdd = q.length >= 2 && !(categories || []).some((c) => c.label.toLowerCase() === q);

  const pick = (cat) => { setPicked(cat); bump(); };

  const addCustom = async () => {
    const label = query.trim();
    if (label.length < 2 || adding) return;
    setAdding(true);
    try {
      const { data } = await suggestCategory(label);
      setCategories((prev) => (prev || []).some((c) => c.slug === data.slug) ? prev : [...(prev || []), data]);
      pick({ slug: data.slug, label: data.label, pending: data.status === 'pending' });
      setQuery('');
      toast.success(data.status === 'pending' ? 'Added — we’ll review it.' : 'Category added.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not add category');
    } finally {
      setAdding(false);
    }
  };

  // ── Continue: claim link (idempotent for own slug) → save category ───────
  const handleContinue = async () => {
    if (!picked || editing || saving) return;
    setSaving(true);
    try {
      await claimOnboardingSlug(slug);
      await saveOnboardingPersona(picked.slug);
      navigate(`/vendor-register/${slug}/preview`);
    } catch (err) {
      // Server sends { message }, not { error } — read message first (audit P2-10).
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Could not save — try again.');
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas">
        <OnboardingStepper current={1} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center"><PetalSpinner size={48} /></div>
      </div>
    );
  }

  const preview = {
    displayName: snap?.name || '',
    photoUrl: snap?.profileImage || null,
    slug,
    personaLabel: picked?.label,
    personaTag: picked?.tag,
    pulseKey: pulse,
  };
  const msg = editing && draft && !checking && available === false ? SLUG_MSG[reason || 'taken'] : null;

  return (
    <div className="min-h-screen bg-canvas pb-28 font-sans text-ink">
      <OnboardingStepper current={1} />

      <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        {/* Phones: compact preview pinned under the stepper so every tap visibly lands. */}
        <div className="sticky top-[64px] z-20 mb-5 lg:hidden"><LivePreviewCard {...preview} compact /></div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="onb-rise">
            <h1 className="font-heading text-[clamp(28px,4.5vw,42px)] font-extrabold leading-[1.1] tracking-tight">
              {firstName ? `Hi ${firstName}, your` : 'Your'} page is <span className="text-primary-cta">ready.</span>
            </h1>
            <p className="mt-2.5 text-[15px] text-muted">
              We used your Google name and photo. Two quick taps to make it yours.
            </p>

            {/* Link */}
            <section className="mt-7 rounded-[10px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your link</p>
              {!editing ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <p className="min-w-0 flex-1 truncate font-mono text-[15px]">
                    <span className="text-muted">{window.location.host}/</span>
                    <span className="font-semibold text-primary">{slug}</span>
                  </p>
                  <span className="onb-pop inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success-fg">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Reserved for you
                  </span>
                  <button type="button" onClick={startEdit} className="inline-flex min-h-[40px] items-center gap-1 px-1 text-sm font-semibold text-primary-cta hover:opacity-80">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              ) : (
                <div className="mt-2.5">
                  <div className="flex items-stretch overflow-hidden rounded-[6px] border border-black/10 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="select-none whitespace-nowrap bg-sand px-3 py-2.5 text-sm text-muted" aria-hidden="true">
                      {window.location.host}/
                    </span>
                    <input
                      id="slug-input"
                      aria-label="Your link"
                      aria-describedby="slug-hint"
                      className="w-full px-3 py-2.5 text-sm font-medium outline-none"
                      placeholder="yourname"
                      value={draft}
                      onChange={onDraft}
                      maxLength={30}
                      autoFocus
                    />
                    <span className="flex items-center pr-3">
                      {checking && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                      {!checking && available === true && <Check className="h-4 w-4 text-success-fg" strokeWidth={3} aria-label="Available" />}
                    </span>
                  </div>
                  <p id="slug-hint" aria-live="polite" className={`mt-2 min-h-[1.25rem] text-sm ${msg ? msg.tone : 'text-success-fg'}`}>
                    {msg ? msg.text : !checking && available ? 'This URL is available.' : ''}
                  </p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={!available || checking}
                      className="rounded-[6px] bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save link
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-sm font-medium text-muted hover:text-ink">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* What do you do */}
            <section className="mt-4 rounded-[10px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">What do you do?</p>
              <div role="radiogroup" aria-label="What do you do" className="mt-3 flex flex-wrap gap-2">
                {PERSONAS.map((p) => {
                  const on = picked?.slug === p.slug;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pick({ slug: p.slug, label: p.label, tag: p.tag })}
                      className={chipCls(on)}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT[p.color] || DOT.amber}`} aria-hidden="true" />
                      {p.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={openOther}
                  aria-expanded={otherOpen}
                  className={`${chipCls(false)} border-dashed text-muted`}
                >
                  <Search className="h-3.5 w-3.5" /> Something else
                </button>
              </div>

              {/* A long-tail pick shows as its own selected chip so it's never invisible. */}
              {picked && !PERSONAS.some((p) => p.slug === picked.slug) && (
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <span className={chipCls(true)}><Check className="h-3.5 w-3.5" strokeWidth={3} />{picked.label}</span>
                  {picked.pending && <span className="text-xs text-muted">Pending review</span>}
                </p>
              )}

              {otherOpen && (
                <div className="onb-rise mt-4 border-t border-black/5 pt-4">
                  <label htmlFor="cat-search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                    Search all categories
                  </label>
                  <input
                    id="cat-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && showAdd) addCustom(); }}
                    placeholder="e.g. Yoga instructor, Astrologer, Lawyer"
                    autoComplete="off"
                    autoFocus
                    className="w-full rounded-[6px] border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!categories && <PetalSpinner size={28} />}
                    {matches.map((c) => (
                      <button key={c.slug} type="button" onClick={() => pick({ slug: c.slug, label: c.label })} className={chipCls(picked?.slug === c.slug)}>
                        {c.label}
                      </button>
                    ))}
                    {showAdd && (
                      <button
                        type="button"
                        onClick={addCustom}
                        disabled={adding}
                        data-testid="add-custom-row"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-warning-fg/30 bg-warning-bg px-3.5 py-2 text-sm font-medium text-warning-fg disabled:opacity-60"
                      >
                        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
                        Add “{query.trim()}”
                      </button>
                    )}
                    {categories && !matches.length && !showAdd && (
                      <p className="text-sm text-muted">No categories match your search.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success-fg" /> Live preview
            </p>
            <LivePreviewCard {...preview} />
            <p className="mt-3 text-center text-xs text-muted">This is exactly what guests will see.</p>
          </aside>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <span className="hidden text-sm text-muted sm:block">
            {picked ? 'Looking good. You can change both anytime.' : 'Pick what you do to continue.'}
          </span>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!picked || editing || saving}
            className="ml-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary-cta px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(150,13,50,0.18)] transition hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Looks good <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageStep;
