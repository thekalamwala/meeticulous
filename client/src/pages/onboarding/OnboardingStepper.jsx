import { X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ConfirmSheet from '../../components/dashboard/ui/ConfirmSheet';

// Shared top bar for the 3 host-onboarding screens. `current` is 1-indexed
// (1 = Your page, 2 = First service, 3 = Live).
//
// Endowed progress: Google sign-in is real work already done, so it renders as
// the first, already-filled segment — the host starts ~25% in, not at zero.
const STEPS = ['Your page', 'First service', 'Live'];
const HINT = {
  1: 'Signed in with Google. 2 quick steps left.',
  2: 'One step from bookable.',
  3: 'All set',
};

export const Wordmark = ({ className = '' }) => (
  <span className={`inline-flex select-none items-center gap-1.5 font-heading text-lg font-extrabold tracking-tight text-ink ${className}`}>
    Meeticulous<span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
  </span>
);

const OnboardingStepper = ({ current }) => {
  const step = Math.min(Math.max(current, 1), STEPS.length);
  const label = step === 3 ? 'Done · You’re live' : `Step ${step} of 2 · ${STEPS[step - 1]}`;

  // Exit door: reverses the in-progress hosting upgrade so a guest who opened
  // onboarding and changed their mind isn't left stuck as a half-host (which
  // would force them back into /vendor-register on every login). Server refuses
  // this once onboarding is complete, so a live host can never demote by mistake.
  const navigate = useNavigate();
  // Tolerate a missing AuthProvider: the step-page unit tests render the stepper
  // bare (no context), and this is presentational chrome — never crash the whole
  // onboarding screen just because the exit door can't wire up.
  const { cancelHosting } = useAuth() || {};
  const [confirm, setConfirm] = useState(false);
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
    <div className="sticky top-0 z-30 border-b border-black/5 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 sm:gap-6 sm:px-8">
        <Wordmark className="hidden sm:inline-flex" />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-ink">{label}</span>
            <span className="hidden text-muted sm:inline">{HINT[step]}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {/* Segment 0 = Google (always done), then one per step. */}
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                <span
                  className={`block h-full rounded-full bg-primary transition-all duration-500 ease-out ${
                    i < step || (step === 3 && i === 3) ? 'w-full' : 'w-0'
                  }`}
                />
              </span>
            ))}
          </div>
        </div>

        {step < 3 && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={leaving}
            className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-xs font-medium text-muted transition-colors hover:bg-sand hover:text-ink disabled:opacity-50"
          >
            <X size={15} /> {leaving ? 'Exiting…' : 'Exit'}
          </button>
        )}
      </div>

      <ConfirmSheet
        open={confirm}
        title="Stop setting up?"
        message="You can come back anytime and pick up where you left off. You’ll keep browsing as a guest."
        confirmLabel="Exit setup"
        cancelLabel="Keep going"
        busy={leaving}
        onConfirm={exitHosting}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
};

export default OnboardingStepper;
