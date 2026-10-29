import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Loader2, LayoutGrid } from 'lucide-react';
import { saveOnboardingPersona, getOnboardingStatus } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import LivePreviewCard from './LivePreviewCard';
import { PERSONAS } from './personas';
import PetalSpinner from '../../components/common/PetalSpinner';

// One hue per persona (multicolour picker). Static class strings so Tailwind's
// JIT keeps them — do NOT build these class names dynamically.
const COLOR = {
  amber:   { chip: 'bg-amber-100 text-amber-600',     pill: 'bg-amber-50 text-amber-700 ring-amber-200/70' },
  blue:    { chip: 'bg-blue-100 text-blue-600',       pill: 'bg-blue-50 text-blue-700 ring-blue-200/70' },
  rose:    { chip: 'bg-rose-100 text-rose-600',       pill: 'bg-rose-50 text-rose-700 ring-rose-200/70' },
  cyan:    { chip: 'bg-cyan-100 text-cyan-600',       pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200/70' },
  red:     { chip: 'bg-red-100 text-red-600',         pill: 'bg-red-50 text-red-700 ring-red-200/70' },
  emerald: { chip: 'bg-emerald-100 text-emerald-600', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
  violet:  { chip: 'bg-violet-100 text-violet-600',   pill: 'bg-violet-50 text-violet-700 ring-violet-200/70' },
  teal:    { chip: 'bg-teal-100 text-teal-600',       pill: 'bg-teal-50 text-teal-700 ring-teal-200/70' },
  fuchsia: { chip: 'bg-fuchsia-100 text-fuchsia-600', pill: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200/70' },
  indigo:  { chip: 'bg-indigo-100 text-indigo-600',   pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70' },
  sky:     { chip: 'bg-sky-100 text-sky-600',         pill: 'bg-sky-50 text-sky-700 ring-sky-200/70' },
  lime:    { chip: 'bg-lime-100 text-lime-700',       pill: 'bg-lime-50 text-lime-700 ring-lime-200/70' },
};

const PersonaStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const { user } = useAuth() || {};

  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Hydrate name/photo so the live preview reflects the real Google profile.
  const [profileSnap, setProfileSnap] = useState(null);
  useEffect(() => {
    let alive = true;
    getOnboardingStatus().then(({ data }) => { if (alive) setProfileSnap(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const selected = PERSONAS.find((p) => p.id === selectedId) || null;
  const displayName = profileSnap?.name || user?.name || '';
  const photoUrl = profileSnap?.profileImage || user?.profile_image || null;

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveOnboardingPersona(selected.slug);
      navigate(`/vendor-register/${slug}/preview`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save — please try again');
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingStepper current={2} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <OnboardingStepper current={2} />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">

          {/* ── Left: persona picker ── */}
          <div>
            <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-cta">
              Step 2 of 4
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Tell us what you do.
            </h1>
            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              We&apos;ll tailor your Meeticulous page around it.
            </p>

            <p className="mb-3 mt-7 text-sm font-semibold text-gray-900">Choose your category</p>
            <div
              role="radiogroup"
              aria-label="Choose your persona"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {PERSONAS.map(({ id, label, tag, desc, color, Icon }) => {
                const isSel = selectedId === id;
                const c = COLOR[color] || COLOR.amber;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => setSelectedId(id)}
                    className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      isSel
                        ? 'border-primary bg-primary-light/25 shadow-sm ring-2 ring-primary-light'
                        : 'border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm'
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.chip}`}>
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold leading-tight text-gray-900">
                        {label}
                      </span>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c.pill}`}>
                        {tag}
                      </span>
                      <span className="mt-1.5 block text-xs leading-snug text-gray-500">{desc}</span>
                    </span>
                    {isSel && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Escape hatch */}
            <button
              onClick={() => navigate(`/vendor-register/${slug}/category/all`)}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left text-sm text-gray-600 transition hover:border-primary/40 hover:text-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <LayoutGrid className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-gray-900">Looking for something else?</span>
                <span className="mt-0.5 flex items-center gap-1 font-semibold text-primary">
                  Explore all categories <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          </div>

          {/* ── Right: live preview ── */}
          <aside className="lg:sticky lg:top-24">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live preview
            </p>
            <LivePreviewCard
              displayName={displayName}
              slug={slug}
              personaLabel={selected?.label}
              personaTag={selected?.tag}
              photoUrl={photoUrl}
            />
            <p className="mt-3 text-center text-xs text-gray-400">
              Your category shapes how guests discover you. You can change it anytime.
            </p>
          </aside>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate(`/vendor-register/${slug}/claim`)}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ← Back
          </button>
          <span className="hidden text-sm text-gray-500 sm:block">You can change this anytime</span>
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="btn-primary px-7 py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> Saving…
              </span>
            ) : (
              'Continue →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonaStep;
