import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Video, MapPin, Repeat, Loader2, Sparkles, Users, MessageCircle, ShieldCheck, Link2, Copy, CheckCircle2 } from 'lucide-react';
import { saveOnboardingDetails, getOnboardingStatus, activateFreePlan } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import WhatsAppVerify from '../../components/whatsapp/WhatsAppVerify';
import LivePreviewCard from './LivePreviewCard';
import { personaLabelForSlug, personaTagForSlug } from './personas';
import PetalSpinner from '../../components/common/PetalSpinner';

const BOOKING_TYPES = [
  { id: 'online_only',  label: 'Online',      Icon: Video },
  { id: 'offline_only', label: 'In person',   Icon: MapPin },
  { id: 'both',         label: 'Both',        Icon: Repeat },
];

const PreviewStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const { user } = useAuth();

  const [bookingType, setBookingType] = useState(null);
  const [tagline, setTagline]         = useState('');
  const [city, setCity]               = useState('');
  const [waPhoneUi, setWaPhoneUi]     = useState({ country: '', number: '' });
  const [waVerified, setWaVerified]   = useState(false);
  const [saving, setSaving]           = useState(false);

  // Persona / photo / name are already on the profile — hydrate once so the
  // preview reflects what's actually stored, not what AuthContext happens to
  // have cached. Falls back gracefully to whatever we do have.
  const [profileSnap, setProfileSnap] = useState(null);
  useEffect(() => {
    let alive = true;
    getOnboardingStatus()
      .then(({ data }) => { if (alive) setProfileSnap(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const displayName = profileSnap?.name || user?.name || '';
  const photoUrl    = profileSnap?.profileImage || user?.profile_image || null;
  const personaLabel = useMemo(
    () => personaLabelForSlug(profileSnap?.primaryCategory),
    [profileSnap?.primaryCategory],
  );
  const personaTag = useMemo(
    () => personaTagForSlug(profileSnap?.primaryCategory),
    [profileSnap?.primaryCategory],
  );

  const canContinue = bookingType && !saving;

  const persist = async ({ whatsappSkipped } = {}) => {
    setSaving(true);
    try {
      await saveOnboardingDetails({
        booking_type: bookingType,
        tagline: tagline.trim() || undefined,
        location: city.trim() || undefined,
        ...(whatsappSkipped ? { whatsapp_skipped: true } : {}),
      });
      // Paywall deferred: every host goes live on the free plan and adds their
      // first service on the next screen. Upgrades live in the dashboard,
      // surfaced after first-booking value — not as a wall before it. (The /plan
      // screen still exists as a resume/upgrade entry, just not a forced step.)
      await activateFreePlan();
      navigate(`/vendor-register/${slug}/live`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save — try again.');
      setSaving(false);
    }
  };

  const handleWaVerified = () => {
    // Just mark verified — do NOT auto-advance. Auto-persisting here yanked the
    // host to the next step mid-form (e.g. before they finished the tagline).
    setWaVerified(true);
    toast.success('WhatsApp verified.');
  };

  const handleContinue = () => {
    if (!bookingType) {
      toast.error('Pick how you meet clients.');
      return;
    }
    persist({ whatsappSkipped: !waVerified });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy — copy it manually.');
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingStepper current={3} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </div>
    );
  }

  const waNumber = waPhoneUi.number ? `${waPhoneUi.country}${waPhoneUi.number.replace(/[^\d]/g, '')}` : '';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <OnboardingStepper current={3} />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">

          {/* ── Left: form ── */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tell guests about you</h1>
            <p className="mt-2 text-sm text-gray-500">
              Add a few details so guests know what to expect.
            </p>

            {/* Tagline */}
            <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <h2 className="text-sm font-semibold text-gray-900">
                  Your tagline <span className="font-normal text-gray-400">(optional)</span>
                </h2>
              </div>
              <p className="mt-1 text-xs text-gray-500">Say what you help people with in one sentence.</p>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 120))}
                placeholder="e.g. Helping first-time founders find product-market fit"
                className="fb-input mt-3 w-full"
                maxLength={120}
              />
              <p className="mt-1 text-xs text-gray-400">{tagline.length}/120</p>
            </section>

            {/* City — powers local search ("{profession} in {city}") for in-person hosts */}
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <h2 className="text-sm font-semibold text-gray-900">
                  Your city <span className="font-normal text-gray-400">(optional)</span>
                </h2>
              </div>
              <p className="mt-1 text-xs text-gray-500">Helps people nearby find you in search.</p>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value.slice(0, 60))}
                placeholder="e.g. Nagpur, Maharashtra"
                className="fb-input mt-3 w-full"
                maxLength={60}
              />
            </section>

            {/* Booking type */}
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <h2 className="text-sm font-semibold text-gray-900">How do you meet clients?</h2>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {BOOKING_TYPES.map(({ id, label, Icon }) => {
                  const on = bookingType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBookingType(id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-2 py-4 text-xs font-semibold transition ${
                        on ? 'border-primary bg-primary-light/60 text-primary-cta' : 'border-gray-200 text-gray-700 hover:border-primary/40'
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* WhatsApp */}
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" strokeWidth={2.5} />
                <h2 className="text-sm font-semibold text-gray-900">
                  Booking updates on WhatsApp
                </h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Optional</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Receive booking alerts and customer messages.</p>
              <div className="mt-3">
                <WhatsAppVerify
                  onVerified={handleWaVerified}
                  onPhoneChange={setWaPhoneUi}
                />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                <p className="text-xs leading-relaxed text-gray-500">
                  <span className="font-semibold text-gray-700">Why WhatsApp?</span> We use it for booking alerts and important customer updates. You control what gets sent, and can add or verify it later from your dashboard.
                </p>
              </div>
            </section>
          </div>

          {/* ── Right: live preview + public link ── */}
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
              whatsappNumber={waVerified ? waNumber : ''}
              tagline={tagline}
              photoUrl={photoUrl}
            />

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Link2 className="h-4 w-4 text-gray-400" strokeWidth={2.5} /> Your public link
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-500">
                  meeticulous.com/<span className="font-semibold text-primary-cta">{slug}</span>
                </span>
                <button
                  onClick={handleCopyLink}
                  aria-label="Copy link"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">This is the link you&apos;ll share with clients.</p>
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate(`/vendor-register/${slug}/category`)}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ← Back
          </button>
          <span className="hidden items-center gap-1.5 text-sm text-gray-500 sm:flex">
            <CheckCircle2 className="h-4 w-4 text-green-500" strokeWidth={2.5} />
            Your profile is taking shape
          </span>
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary px-7 py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> Saving…
              </span>
            ) : waVerified ? 'Continue →' : 'Continue without WhatsApp →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;
