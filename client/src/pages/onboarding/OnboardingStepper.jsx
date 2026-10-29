import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// Shared top stepper for the 4 host-onboarding screens. Named nodes on sm+,
// a compact "Step N of 4" + segmented track on mobile. `current` is 1-indexed.
const STEPS = [
  { n: 1, label: 'Claim URL' },
  { n: 2, label: 'Category' },
  { n: 3, label: 'Profile' },
  { n: 4, label: 'Go live' },
];

// Truthful right-rail hint per step — no "almost there" on step 1.
const HINT = { 1: 'Getting started', 2: 'Halfway there', 3: 'Almost there', 4: 'Last step' };

const OnboardingStepper = ({ current }) => {
  const step = Math.min(Math.max(current, 1), STEPS.length);
  const percent = Math.round((step / STEPS.length) * 100);

  // Exit door: reverses the in-progress hosting upgrade so a guest who opened
  // onboarding and changed their mind isn't left stuck as a half-host (which
  // would force them back into /vendor-register on every login). Server refuses
  // this once onboarding is complete, so a live host can never demote by mistake.
  const navigate = useNavigate();
  // Tolerate a missing AuthProvider: the step-page unit tests render the stepper
  // bare (no context), and this is presentational chrome — never crash the whole
  // onboarding screen just because the exit door can't wire up. `?.` keeps the
  // button inert in that case; in the real app the provider is always present.
  const { cancelHosting } = useAuth() || {};
  const [leaving, setLeaving] = useState(false);
  const exitHosting = async () => {
    if (leaving || !cancelHosting) return;
    setLeaving(true);
    try {
      await cancelHosting();
      navigate('/user/my-bookings', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not exit hosting');
      setLeaving(false);
    }
  };

  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:py-3.5">
        {/* Brandmark */}
        <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white select-none">
          S
        </div>

        {/* ── Desktop: named nodes ── */}
        <ol className="hidden sm:flex flex-1 items-center">
          {STEPS.map(({ n, label }, i) => {
            const done = n < step;
            const active = n === step;
            return (
              <li key={n} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      done
                        ? 'bg-primary text-white'
                        : active
                        ? 'bg-primary text-white ring-4 ring-primary-light'
                        : 'border border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                  </span>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      active ? 'text-gray-900' : done ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className="mx-3 h-px flex-1 bg-gray-200">
                    <span
                      className={`block h-px bg-primary transition-all duration-300 ${done ? 'w-full' : 'w-0'}`}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* ── Mobile: compact label + segmented track ── */}
        <div className="flex-1 sm:hidden">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {STEPS[step - 1].label}
            </p>
            <p className="text-xs font-medium text-gray-500">Step {step} of {STEPS.length}</p>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map(({ n }) => (
              <span key={n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                <span className={`block h-full rounded-full bg-primary ${n <= step ? 'w-full' : 'w-0'}`} />
              </span>
            ))}
          </div>
        </div>

        {/* Right rail — progress readout (desktop only) */}
        <div className="hidden sm:flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-medium text-gray-500">{HINT[step]}</span>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-sm font-bold tabular-nums text-gray-900">{percent}%</span>
          </div>
        </div>

        {/* Exit door — leave onboarding and go back to browsing as a guest.
            Reverses the hosting upgrade so the account isn't trapped as a half-host. */}
        <button
          type="button"
          onClick={exitHosting}
          disabled={leaving}
          title="Exit — keep browsing as a guest"
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <X size={15} />
          <span className="hidden sm:inline">{leaving ? 'Exiting…' : 'Exit'}</span>
        </button>
      </div>
    </div>
  );
};

export default OnboardingStepper;
