import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Clock, Loader2, Repeat, MapPin, Sparkles, Video } from 'lucide-react';
import {
  activateFreePlan,
  aiGenerateListing,
  getOnboardingStatus,
  hostGetCategories,
  listServiceCategories,
  saveOnboardingDetails,
  svcCreate,
} from '../../services/api';
import { BOLT_ENABLED } from '../../config/aiListing';
import { analytics } from '../../services/analytics';
import { EVENTS } from '../../services/analytics/events';
import { useAuth } from '../../context/AuthContext';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import LivePreviewCard from './LivePreviewCard';
import { DEFAULT_SUGGESTIONS, personaForSlug } from './personas';
import PetalSpinner from '../../components/common/PetalSpinner';

// First-service durations — the common set; host refines everything else in the
// dashboard. Kept tiny on purpose: this screen exists to get ONE bookable
// service live, not to be the full ServiceForm.
const DURATIONS = [15, 30, 45, 60];

const MODES = [
  { id: 'online_only',  label: 'Online',    Icon: Video },
  { id: 'offline_only', label: 'In person', Icon: MapPin },
  { id: 'both',         label: 'Both',      Icon: Repeat },
];

const chipCls = (on) =>
  `inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${
    on ? 'onb-pop border-primary bg-primary-light font-semibold text-primary' : 'border-black/10 bg-white text-ink hover:border-primary/40'
  }`;
const pillCls = (on) =>
  `flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[6px] border px-2 py-2.5 text-sm transition ${
    on ? 'onb-pop border-primary bg-primary-light font-semibold text-primary' : 'border-black/10 bg-white text-ink hover:border-primary/40'
  }`;
const card = 'rounded-[10px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]';
const fieldCls = 'w-full rounded-[6px] border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-primary focus:ring-2 focus:ring-primary/20';

/**
 * ServiceStep — screen 2 of the host onboarding ("First service").
 *
 * Replaces the old PreviewStep (tagline/city/booking-type/WhatsApp form) and
 * pulls the first-service form forward from the old /live screen, so the host
 * reaches a BOOKABLE page before we celebrate. WhatsApp OTP moved to the live
 * screen's optional checklist — it no longer sits on the critical path.
 *
 * Route: /vendor-register/:slug/preview (unchanged, so RESUME 3/4/5 → here).
 * Server order is unchanged: save-details (→5) → activate-free (→6) → service
 * create. onboarding_completed is still flipped only by mark-complete on /live.
 */
const ServiceStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const { user } = useAuth() || {};

  // Interim fee-only mode: paid listings are disabled (mirrors ServiceForm).
  // Fail-safe true — server forces ₹0 regardless.
  const feeOnly = user?.fee_only_mode ?? true;

  const [snap, setSnap] = useState(null);
  const [svcCats, setSvcCats] = useState([]); // [{ slug, name }]
  const [category, setCategory] = useState('');

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [bookingType, setBookingType] = useState('online_only');
  const [city, setCity] = useState('');
  const [tagline, setTagline] = useState('');
  const [showBio, setShowBio] = useState(false);
  const [pulse, setPulse] = useState(0);
  const bump = () => setPulse((n) => n + 1);

  // Bolt: one-line title → AI writes the real listing copy (and may suggest a
  // duration/category). Price stays the host's call — the generator never
  // invents money (server-side FABRICATION guard).
  const [aiBusy, setAiBusy] = useState(false);
  const [aiCopy, setAiCopy] = useState(null); // { short_description, long_description } | null
  const [busy, setBusy] = useState(null); // 'publish' | 'skip' | null

  useEffect(() => {
    let alive = true;
    getOnboardingStatus().then(({ data }) => { if (alive) setSnap(data); }).catch(() => {});
    // Host's profession service-categories (same source as ServiceForm). Empty
    // list → no sub-categories; the service is created without one.
    hostGetCategories()
      .then((h) => listServiceCategories(h.data?.primary_category || undefined).catch(() => ({ data: { categories: [] } })))
      .then((sc) => {
        if (!alive) return;
        const list = sc.data?.categories || [];
        setSvcCats(list);
        setCategory((c) => c || list[0]?.slug || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const persona = personaForSlug(snap?.primaryCategory);
  const suggestions = persona?.suggestions || DEFAULT_SUGGESTIONS;

  const runBolt = async (seedTitle = title) => {
    const t = seedTitle.trim();
    if (!t) { toast.error('Type what your service is first, then Bolt writes it.'); return; }
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const { data } = await aiGenerateListing({ title: t, category: category || undefined, duration });
      const f = data?.fields || {};
      if (f.title) setTitle(f.title.slice(0, 60));
      if (f.short_description || f.long_description) {
        setAiCopy({ short_description: f.short_description || '', long_description: f.long_description || '' });
      }
      // Only snap duration/category to values the pickers can show.
      if (DURATIONS.includes(f.duration_minutes)) setDuration(f.duration_minutes);
      if (f.category && svcCats.some((c) => c.slug === f.category)) setCategory(f.category);
      bump();
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      if (status === 429) toast.error(msg || "You've used your AI writing for now — your title works fine on its own.");
      else if (status === 503) toast.error('AI writing is unavailable right now — your title works fine on its own.');
      else toast.error(msg || 'Bolt could not write that — try a clearer title.');
    } finally {
      setAiBusy(false);
    }
  };

  const pickSuggestion = (s) => {
    setTitle(s);
    setAiCopy(null);
    bump();
    if (BOLT_ENABLED) runBolt(s);
  };

  // Shared by publish + skip: record the profile details and put the host on the
  // free plan (step → 6). Both are idempotent server-side, so a retry is safe.
  const saveProfile = async () => {
    await saveOnboardingDetails({
      booking_type: bookingType,
      tagline: tagline.trim() || undefined,
      location: city.trim() || undefined,
    });
    // Paywall deferred: every host goes live on the free plan. Upgrades live in
    // the dashboard, surfaced after first-booking value — not as a wall before it.
    await activateFreePlan();
  };

  const handlePublish = async () => {
    if (!title.trim()) { toast.error('Give your service a title.'); return; }
    if (svcCats.length && !category) { toast.error('Pick a category for your service.'); return; }
    setBusy('publish');
    try {
      await saveProfile();
      // First service defaults to ONLINE so the host never hits the in-person
      // venue map-link requirement mid-onboarding. They can switch it to
      // in-person (and add the venue) later from the dashboard.
      await svcCreate({
        title:             title.trim(),
        // Rich copy from Bolt when used; otherwise the title-seed. Host refines
        // everything in the dashboard.
        short_description: aiCopy?.short_description || title.trim(),
        description:       aiCopy?.long_description || title.trim(),
        service_type:      'online',
        meeting_mode:      'online',
        price:             feeOnly ? 0 : (parseFloat(price) || 0),
        duration,
        category:          category || null,
      });
      // Activation funnel: pairs with the server's service_published so the
      // onboarding → first-service drop-off is directly measurable.
      analytics.track(EVENTS.SERVICE_PUBLISHED, { source: 'onboarding' });
      navigate(`/vendor-register/${slug}/live`, { state: { published: true, title: title.trim() } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not publish — try again.');
      setBusy(null);
    }
  };

  const handleSkip = async () => {
    setBusy('skip');
    try {
      await saveProfile();
      analytics.track(EVENTS.FIRST_SERVICE_SKIPPED, { source: 'onboarding' });
      navigate(`/vendor-register/${slug}/live`, { state: { skipped: true } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save — try again.');
      setBusy(null);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas">
        <OnboardingStepper current={2} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center"><PetalSpinner size={48} /></div>
      </div>
    );
  }

  const preview = {
    displayName: snap?.name || '',
    photoUrl: snap?.profileImage || null,
    slug,
    personaLabel: persona?.label || null,
    personaTag: persona?.tag || null,
    tagline: tagline.trim(),
    bookingType,
    city: bookingType === 'online_only' ? '' : city.trim(),
    serviceTitle: title.trim(),
    serviceDuration: duration,
    showServiceSlot: true,
    pulseKey: pulse,
  };

  return (
    <div className="min-h-screen bg-canvas pb-32 font-sans text-ink">
      <OnboardingStepper current={2} />

      <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <div className="sticky top-[64px] z-20 mb-5 lg:hidden"><LivePreviewCard {...preview} compact /></div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="onb-rise">
            <h1 className="font-heading text-[clamp(28px,4.5vw,42px)] font-extrabold leading-[1.1] tracking-tight">
              What can people <span className="text-primary-cta">book</span> with you?
            </h1>
            <p className="mt-2.5 text-[15px] text-muted">
              Pick one to start{BOLT_ENABLED ? '. Bolt writes the description, you just check it.' : '. You can add more later.'}
            </p>

            {/* Title */}
            <section className={`${card} mt-7`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Popular for {persona?.plural || 'you'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => pickSuggestion(s)} className={chipCls(title.toLowerCase() === s.toLowerCase())}>{s}</button>
                ))}
              </div>

              <label htmlFor="svc-title" className="mb-1.5 mt-5 block text-xs font-semibold uppercase tracking-wider text-muted">
                Or name it yourself
              </label>
              <input
                id="svc-title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value.slice(0, 60)); setAiCopy(null); }}
                onBlur={() => bump()}
                placeholder="e.g. 1:1 Strategy Call"
                maxLength={60}
                className={fieldCls}
              />

              {BOLT_ENABLED && (
                <div className="mt-3 rounded-[6px] bg-sand p-3.5" aria-live="polite">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {aiBusy ? 'Bolt is writing your description…' : aiCopy ? 'Bolt wrote this. Edit anytime in your dashboard.' : 'Bolt can write the description for you'}
                  </p>
                  {aiBusy && (
                    <div className="mt-2.5 flex flex-col gap-2"><div className="onb-shimmer" /><div className="onb-shimmer w-11/12" /><div className="onb-shimmer w-3/5" /></div>
                  )}
                  {!aiBusy && aiCopy && (
                    <p className="onb-rise mt-2 line-clamp-4 text-sm text-ink/80">{aiCopy.short_description}</p>
                  )}
                  {!aiBusy && !aiCopy && (
                    <button
                      type="button"
                      onClick={() => runBolt()}
                      disabled={!title.trim() || !!busy}
                      className="mt-1 min-h-[36px] text-sm font-semibold text-primary-cta hover:opacity-80 disabled:opacity-40"
                    >
                      Write it with Bolt
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Details */}
            <section className={`${card} mt-4 flex flex-col gap-5`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">How long?</p>
                <div className="mt-2.5 flex gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" onClick={() => { setDuration(d); bump(); }} className={pillCls(duration === d)}>{d} min</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">How do you meet clients?</p>
                <div className="mt-2.5 flex gap-2">
                  {MODES.map(({ id, label, Icon }) => (
                    <button key={id} type="button" onClick={() => { setBookingType(id); bump(); }} className={pillCls(bookingType === id)}>
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
                {bookingType !== 'online_only' && (
                  <div className="onb-rise mt-3">
                    {/* City powers local search ("{profession} in {city}"). */}
                    <label htmlFor="city" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                      Your city <span className="font-normal normal-case tracking-normal">(people nearby find you)</span>
                    </label>
                    <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value.slice(0, 60))} onBlur={() => bump()} placeholder="e.g. Nagpur, Maharashtra" maxLength={60} className={fieldCls} />
                    <p className="mt-1.5 text-xs text-muted">This first service starts online. Add your venue to it from the dashboard.</p>
                  </div>
                )}
              </div>

              {svcCats.length > 1 && (
                <div>
                  <label htmlFor="svc-cat" className="text-xs font-semibold uppercase tracking-wider text-muted">Service type</label>
                  <select id="svc-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={`${fieldCls} mt-2.5`}>
                    {svcCats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {feeOnly ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  Free to book while you get started. Add paid pricing from your dashboard.
                </p>
              ) : (
                <div>
                  <label htmlFor="svc-price" className="text-xs font-semibold uppercase tracking-wider text-muted">Price</label>
                  <div className="relative mt-2.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span>
                    <input id="svc-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1999" className={`${fieldCls} pl-7`} />
                  </div>
                </div>
              )}

              {!showBio ? (
                <button type="button" onClick={() => setShowBio(true)} className="self-start text-sm font-semibold text-primary-cta hover:opacity-80">
                  + Add a one-line intro (optional)
                </button>
              ) : (
                <div className="onb-rise">
                  <label htmlFor="tagline" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">One-line intro</label>
                  <input id="tagline" type="text" value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 120))} placeholder="e.g. Helping first-time founders find product-market fit" maxLength={120} className={fieldCls} autoFocus />
                  <p className="mt-1 text-xs text-muted">{tagline.length}/120</p>
                </div>
              )}
            </section>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success-fg" /> Live preview
            </p>
            <LivePreviewCard {...preview} />
            <p className="mt-3 text-center text-xs text-muted">Guests can book this the moment you publish.</p>
          </aside>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => navigate(`/vendor-register/${slug}/claim`)} aria-label="Back" className="inline-flex min-h-[44px] items-center px-2 text-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleSkip} disabled={!!busy} className="min-h-[44px] px-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-50">
              {busy === 'skip' ? 'Saving…' : 'I’ll add a service later'}
            </button>
          </div>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!!busy || aiBusy}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary-cta px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(150,13,50,0.18)] transition hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {busy === 'publish' ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <>Publish my page <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceStep;
