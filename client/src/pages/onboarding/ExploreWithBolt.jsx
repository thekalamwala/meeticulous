import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PartyPopper, ArrowRight, Copy, Loader2, Rocket, Sparkles, Wand2 } from 'lucide-react';
import {
  markOnboardingComplete,
  svcCreate,
  hostGetCategories,
  listServiceCategories,
  getOnboardingStatus,
  aiGenerateListing,
} from '../../services/api';
import { BOLT_ENABLED } from '../../config/aiListing';
import { analytics } from '../../services/analytics';
import { EVENTS } from '../../services/analytics/events';
import { useAuth } from '../../context/AuthContext';
import { fireCelebration } from '../../utils/celebration';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import LivePreviewCard from './LivePreviewCard';
import { personaLabelForSlug, personaTagForSlug } from './personas';
import PetalSpinner from '../../components/common/PetalSpinner';
import ConfirmSheet from '../../components/dashboard/ui/ConfirmSheet';

// First-service durations — the common set; host refines everything else in the
// dashboard. Kept tiny on purpose: this screen exists to get ONE bookable
// service live, not to be the full ServiceForm.
const DURATIONS = [15, 30, 45, 60];

const ExploreWithBolt = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const { user } = useAuth() || {};
  const firedRef = useRef(false);

  // Interim fee-only mode: paid listings are disabled (mirrors ServiceForm).
  // Fail-safe true — server forces ₹0 regardless.
  const feeOnly = user?.fee_only_mode ?? true;

  // First-service mini-form state.
  const [title, setTitle]         = useState('');
  const [price, setPrice]         = useState('');
  const [duration, setDuration]   = useState(30);
  const [svcCats, setSvcCats]     = useState([]);   // [{ slug, name }]
  const [category, setCategory]   = useState('');
  const [publishing, setPublishing] = useState(false);
  const [skipping, setSkipping]   = useState(false);
  // Soft-gate: 2-in-3 stalled hosts finished here with zero services by tapping
  // the one-click skip. Now a deliberate confirm sits between tap and finish.
  const [confirmSkip, setConfirmSkip] = useState(false);

  // "Build with Bolt": one-line title → AI fills the real listing copy (and
  // suggests a duration/category). Stored so handlePublish sends the rich copy
  // instead of the title-as-description seed. Price stays the host's call — the
  // generator never invents money (server-side FABRICATION guard).
  const [aiBusy, setAiBusy]   = useState(false);
  const [aiCopy, setAiCopy]   = useState(null); // { short_description, long_description } | null

  const runBolt = async () => {
    if (!title.trim()) { toast.error('Type what your service is first, then Bolt writes it.'); return; }
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const { data } = await aiGenerateListing({ title: title.trim(), category: category || undefined, duration });
      const f = data?.fields || {};
      if (f.title) setTitle(f.title.slice(0, 60));
      if (f.short_description || f.long_description) {
        setAiCopy({ short_description: f.short_description || '', long_description: f.long_description || '' });
      }
      // Only snap the duration dropdown when the suggestion is one of its options,
      // so the <select> never shows a value it can't render.
      if (DURATIONS.includes(f.duration_minutes)) setDuration(f.duration_minutes);
      // Category only if it's in the host's profession list (dropdown-safe).
      if (f.category && svcCats.some((c) => c.slug === f.category)) setCategory(f.category);
      toast.success('Bolt wrote your listing — review and publish.');
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      if (status === 429) toast.error(msg || "You've used your AI writing for now — fill it in manually.");
      else if (status === 503) toast.error('AI writing is unavailable right now — fill it in manually.');
      else toast.error(msg || 'Bolt could not write that — try a clearer title.');
    } finally {
      setAiBusy(false);
    }
  };

  // Fire celebration + complete onboarding once on mount. Completing HERE (not
  // only on a button) means closing the tab still flips onboarding_completed —
  // markComplete is idempotent, so publishing/skip re-calling it is harmless.
  useEffect(() => {
    if (ready && !firedRef.current) {
      firedRef.current = true;
      fireCelebration();
      markOnboardingComplete().catch((error) => {
        const msg = error.response?.data?.message || '';
        if (/categor/i.test(msg)) navigate(`/vendor-register/${slug}/category`);
      });
    }
  }, [ready]);

  // Load the host's profession service-categories (same source as ServiceForm).
  // Empty list → profession has no sub-categories; the dropdown hides and the
  // service is created without one (server treats category as optional then).
  useEffect(() => {
    let alive = true;
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

  // Hydrate name / photo / persona / booking-mode so the live preview reflects
  // the page the host just built across the previous steps.
  const [profileSnap, setProfileSnap] = useState(null);
  useEffect(() => {
    let alive = true;
    getOnboardingStatus().then(({ data }) => { if (alive) setProfileSnap(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const displayName  = profileSnap?.name || user?.name || '';
  const photoUrl     = profileSnap?.profileImage || user?.profile_image || null;
  const personaLabel = personaLabelForSlug(profileSnap?.primaryCategory);
  const personaTag   = personaTagForSlug(profileSnap?.primaryCategory);
  const bookingType  = profileSnap?.bookingType || profileSnap?.booking_type || null;

  const publicUrl = `${window.location.origin}/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied — share it anywhere.');
    } catch {
      toast.error('Could not copy — long-press the URL to copy manually.');
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) { toast.error('Give your service a title.'); return; }
    if (svcCats.length && !category) { toast.error('Pick a category for your service.'); return; }
    setPublishing(true);
    try {
      // First service defaults to ONLINE so the host never hits the in-person
      // venue map-link requirement mid-onboarding. They can switch it to
      // in-person (and add the venue) later from the dashboard.
      await svcCreate({
        title:             title.trim(),
        // Rich copy from Bolt when the host used it; otherwise the title-seed
        // (unchanged legacy behaviour). Host refines everything in the dashboard.
        short_description: aiCopy?.short_description || title.trim(),
        description:       aiCopy?.long_description || title.trim(),
        service_type:      'online',
        meeting_mode:      'online',
        price:             feeOnly ? 0 : (parseFloat(price) || 0),
        duration,
        category:          category || null,
      });
      // Activation funnel: pairs with the server's service_published. Firing the
      // client counterpart with source:onboarding makes the
      // onboarding_completed → first-service drop-off directly measurable.
      analytics.track(EVENTS.SERVICE_PUBLISHED, { source: 'onboarding' });
      await markOnboardingComplete();
      toast.success('Service published — your page can take bookings now.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not publish — try again.');
      setPublishing(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      // Pairs with service_published {source:onboarding} so the skip rate is
      // finally measurable — the old one-click skip fired nothing.
      analytics.track(EVENTS.FIRST_SERVICE_SKIPPED, { source: 'onboarding' });
      await markOnboardingComplete();
      navigate('/dashboard');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to complete';
      toast.error(msg);
      if (/categor/i.test(msg)) navigate(`/vendor-register/${slug}/category`);
      setSkipping(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingStepper current={4} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </div>
    );
  }

  const busy = publishing || skipping;

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingStepper current={4} />

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        {/* Celebration header */}
        <div className="text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light ring-8 ring-primary-light/40">
            <PartyPopper className="h-8 w-8 text-primary" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            You&apos;re <span className="text-primary">live!</span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
            One last thing — add your first service so guests can actually book you.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">

          {/* ── Left: first-service form ── */}
          <div>
        {/* First-service mini-form — the money moment */}
        <div className="rounded-2xl border-2 border-primary/20 bg-primary-light/30 p-5 text-left sm:p-6">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">
              Service title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              placeholder="e.g. 1:1 Strategy Call"
              className="fb-input w-full"
              maxLength={60}
              autoFocus
            />
            {BOLT_ENABLED && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runBolt}
                  disabled={aiBusy || busy || !title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary-cta transition hover:border-primary hover:bg-primary-light/40 disabled:opacity-50"
                >
                  {aiBusy
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} /> Bolt is writing…</>
                    : <><Wand2 className="h-3.5 w-3.5" strokeWidth={2.5} /> {aiCopy ? 'Rewrite with Bolt' : 'Build with Bolt'}</>}
                </button>
                {aiCopy && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} /> Bolt wrote your description
                  </span>
                )}
                {!aiCopy && !aiBusy && (
                  <span className="text-xs text-gray-400">Let Bolt write the full description for you.</span>
                )}
              </div>
            )}
          </div>

          {svcCats.length > 0 && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="fb-input w-full"
              >
                {svcCats.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="fb-input w-full"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Price</label>
              {feeOnly ? (
                <div className="fb-input flex w-full items-center text-sm text-gray-500">Free</div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1999"
                    className="fb-input w-full pl-7"
                  />
                </div>
              )}
            </div>
          </div>
          {feeOnly && (
            <p className="mt-2.5 text-xs text-gray-500">
              Guests pay only Meeticulous&rsquo;s booking fee — you can add paid pricing later.
            </p>
          )}

          <button
            onClick={handlePublish}
            disabled={busy}
            className="btn-primary mt-5 w-full gap-2 py-3 disabled:opacity-50"
          >
            {publishing ? (
              <><Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} /> Publishing…</>
            ) : (
              <><Rocket className="h-5 w-5" strokeWidth={2} /> Publish service &amp; finish</>
            )}
          </button>
        </div>

        {/* Shareable URL card — publishing isn't enough; the host has to SHARE the link.
            This is the #1 activation step, so it gets a heading, not just a Copy button. */}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-3">
          <p className="mb-2 text-left text-sm font-semibold text-gray-800">
            Then share your link — it&rsquo;s where every booking starts.
          </p>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-left font-mono text-sm text-gray-600">{publicUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={2.5} /> Copy
            </button>
          </div>
        </div>

        {/* Escape hatch — never trap the host, but make leaving empty deliberate */}
        <button
          onClick={() => setConfirmSkip(true)}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-gray-500 transition hover:text-gray-800 disabled:opacity-50"
        >
          {skipping ? 'Finishing…' : 'Skip for now — I’ll add a service later'}
          {!skipping && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
        </button>
          </div>

          {/* ── Right: live preview of the finished page ── */}
          <aside className="lg:sticky lg:top-24">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live preview
            </p>
            <LivePreviewCard
              displayName={displayName}
              slug={slug}
              personaLabel={personaLabel}
              personaTag={personaTag}
              bookingType={bookingType}
              photoUrl={photoUrl}
              serviceTitle={title.trim()}
              serviceDuration={duration}
            />
            <p className="mt-3 text-center text-xs text-gray-400">
              Publish to make this page bookable. You can edit everything later.
            </p>
          </aside>

        </div>
      </div>

      <ConfirmSheet
        open={confirmSkip}
        title="Leave without a service?"
        message="Your page can’t take a single booking until it has a service. Adding one takes about a minute — and it’s the whole reason you’re here."
        confirmLabel="Skip anyway"
        cancelLabel="Add my service"
        danger
        busy={skipping}
        onConfirm={handleSkip}
        onClose={() => setConfirmSkip(false)}
      />
    </div>
  );
};

export default ExploreWithBolt;
