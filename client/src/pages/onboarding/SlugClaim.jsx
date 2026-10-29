import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { checkOnboardingSlug, claimOnboardingSlug } from '../../services/api';
import OnboardingStepper from './OnboardingStepper';
import useOnboardingGuard from './useOnboardingGuard';
import PetalSpinner from '../../components/common/PetalSpinner';

const URL_TIPS = [
  'Keep it short and easy to remember',
  'Use your name or brand',
  'Avoid numbers and special characters',
];

/**
 * SlugClaim — Step 1 of the Google-first onboarding flow.
 *
 * Route: /vendor-register/:slug/claim
 * Guard: useOnboardingGuard() checks server state and redirects if the host
 *        is on the wrong step or already complete.
 * Pre-fill: the :slug URL param is the auto-username assigned after Google
 *           OAuth, so the host sees a sensible default immediately.
 *
 * HARD RULE: ≤100vh, no page scroll.
 */
const SlugClaim = () => {
  const { slug: urlSlug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();

  const [slug, setSlug] = useState(urlSlug || '');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [unavailableReason, setUnavailableReason] = useState(null); // 'taken'|'reserved'|'invalid'|'blocked'|null
  const [tooShort, setTooShort] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);

  // On mount (and if urlSlug changes after a redirect), check availability of
  // the pre-filled slug so the host sees immediate feedback without typing.
  useEffect(() => {
    if (urlSlug) {
      setSlug(urlSlug);
      triggerCheck(urlSlug);
    }
    // triggerCheck is stable (doesn't need the dep); urlSlug is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSlug]);

  const checkSlug = useCallback(async (value) => {
    const len = value.length;
    if (len < 3) {
      setChecking(false);
      setAvailable(false);
      setUnavailableReason(null);
      setTooShort(len > 0 && len < 3);
      return;
    }
    setTooShort(false);

    const isValid = /^[a-z0-9-]+$/.test(value);
    if (!isValid) {
      setChecking(false);
      setAvailable(false);
      setUnavailableReason('invalid');
      return;
    }

    const seq = ++requestSeq.current;
    setChecking(true);
    try {
      const { data } = await checkOnboardingSlug(value);
      if (seq === requestSeq.current) {
        setAvailable(data.available);
        setUnavailableReason(data.available ? null : (data.reason || 'taken'));
      }
    } catch {
      if (seq === requestSeq.current) {
        // A network/500 blip is NOT "taken" — don't block with a wrong reason.
        setAvailable(false);
        setUnavailableReason('error');
      }
    } finally {
      if (seq === requestSeq.current) setChecking(false);
    }
  }, []);

  const triggerCheck = (value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) { setChecking(false); setAvailable(null); setTooShort(false); return; }
    setChecking(true);
    setAvailable(null);
    debounceRef.current = setTimeout(() => checkSlug(value), 350);
  };

  const handleChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    setSlug(value);
    triggerCheck(value);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleClaim = async () => {
    if (!slug || !available) {
      toast.error('Please choose an available URL');
      return;
    }
    setClaiming(true);
    try {
      await claimOnboardingSlug(slug);
      navigate(`/vendor-register/${slug}/category`);
    } catch (err) {
      // Server sends { message }, not { error } — read message first (audit P2-10)
      // so the real reason ("Slug already taken") surfaces instead of a generic axios string.
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Could not claim this slug. Try another.';
      toast.error(msg);
      setAvailable(false);
    } finally {
      setClaiming(false);
    }
  };

  // Minimal loading state while guard runs server check
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingStepper current={1} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </div>
    );
  }

  const canContinue = available && !checking && !claiming;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <OnboardingStepper current={1} />

      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Claim your URL</h1>
        <p className="mt-2 text-sm text-gray-500">
          This is where guests will book you. You can change it later.
        </p>

        <div className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <label htmlFor="slug-input" className="block text-sm font-semibold text-gray-900">
            Your URL
          </label>

          {/* Responsive flex row — no hardcoded px padding */}
          <div className="mt-2 flex items-center overflow-hidden rounded-xl border-2 border-gray-200 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-light">
            <span
              className="flex-shrink-0 select-none whitespace-nowrap border-r border-gray-200 bg-gray-50 px-3 py-3 text-sm font-medium text-gray-500"
              aria-hidden="true"
            >
              meeticulous.com/
            </span>
            <div className="relative flex flex-1 items-center">
              <input
                id="slug-input"
                type="text"
                className="w-full bg-white px-3 py-3 text-sm font-medium focus:outline-none"
                placeholder="yourslug"
                value={slug}
                onChange={handleChange}
                maxLength={30}
                autoFocus
                aria-describedby="slug-hint"
              />
              {/* Availability indicator */}
              <div className="absolute right-3 flex-shrink-0">
                {checking && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                {!checking && available === true && (
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Available">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {!checking && available === false && slug && (
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Not available">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Feedback messages — only one shows at a time */}
          <div id="slug-hint" className="mt-2 min-h-[1.25rem]">
            {slug && tooShort && (
              <p className="text-sm text-amber-600">Minimum 3 characters.</p>
            )}
            {slug && !tooShort && available === false && !checking && unavailableReason === 'reserved' && (
              <p className="text-sm text-red-500">This URL is reserved and cannot be used.</p>
            )}
            {slug && !tooShort && available === false && !checking && unavailableReason === 'invalid' && (
              <p className="text-sm text-red-500">Only lowercase letters, numbers, and hyphens are allowed.</p>
            )}
            {slug && !tooShort && available === false && !checking && unavailableReason === 'blocked' && (
              <p className="text-sm text-red-500">This URL isn&apos;t available. Try another.</p>
            )}
            {slug && !tooShort && available === false && !checking && unavailableReason === 'error' && (
              <p className="text-sm text-amber-600">Couldn&apos;t check that URL right now. Check your connection and try again.</p>
            )}
            {slug && !tooShort && available === false && !checking && (!unavailableReason || unavailableReason === 'taken') && (
              <p className="text-sm text-red-500">This URL is taken. Try another.</p>
            )}
            {slug && available === true && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <Check className="h-4 w-4" strokeWidth={3} /> This URL is available.
              </p>
            )}
          </div>
        </div>

        {/* Tips card */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span aria-hidden="true">💡</span> Tips for a great URL
          </p>
          <ul className="mt-3 space-y-2">
            {URL_TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/vendor-register')}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ← Back
          </button>
          <button
            onClick={handleClaim}
            disabled={!canContinue}
            className="btn-primary px-7 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {claiming ? 'Claiming…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlugClaim;
