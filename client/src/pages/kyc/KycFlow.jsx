import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useKyc } from '../../context/KycContext';
import { cn } from '../../components/dashboard/ui';

const STEPS = [
  { path: 'start', label: 'Personal' },
  { path: 'bank', label: 'Bank' },
  { path: 'address', label: 'Address' },
  { path: 'submitted', label: 'Done' },
];
const ORDER = STEPS.map((s) => s.path);

// Redirect to the first incomplete step if the user deep-links past their progress.
function Guard({ children }) {
  const { done } = useKyc();
  const { pathname } = useLocation();
  const cur = pathname.split('/').pop();

  const doneByStep = { start: done.personal, bank: done.bank, address: done.address };
  const seq = ['start', 'bank', 'address'];
  const target = seq.find((s) => !doneByStep[s]) || 'submitted';

  if (ORDER.indexOf(cur) > ORDER.indexOf(target)) {
    return <Navigate to={`/dashboard/kyc/flow/${target}`} replace />;
  }
  return children;
}

// Kept stepper: numbered 12px-radius chips on one white strip, the step name under
// each (visible on a phone too — it's the only place the host sees where they are).
function Stepper() {
  const { pathname } = useLocation();
  const cur = pathname.split('/').pop();
  const curIdx = ORDER.indexOf(cur);
  return (
    <ol aria-label="Steps" className="mb-5 grid grid-cols-4 gap-1 rounded-[20px] bg-white p-3 sm:mb-6">
      {STEPS.map((s, i) => {
        const state = i < curIdx ? 'done' : i === curIdx ? 'active' : 'todo';
        return (
          <li key={s.path} aria-current={state === 'active' ? 'step' : undefined} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'grid h-9 w-9 place-items-center rounded-[12px] text-[14px] font-semibold transition-colors duration-200',
                state === 'done' && 'bg-maroon text-white',
                state === 'active' && 'bg-blush text-maroon ring-2 ring-inset ring-maroon',
                state === 'todo' && 'bg-cream text-faint'
              )}
            >
              {state === 'done' ? <Check className="h-4 w-4" strokeWidth={2.6} /> : i + 1}
            </span>
            <span className={cn('text-[12px] sm:text-[13px]', state === 'active' ? 'font-semibold text-maroon' : 'text-muted')}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// NOTE: KycProvider is mounted in App.jsx ABOVE DashboardLayout, not here.
// DashboardLayout renders its children inside PageTransition, whose motion.div is
// keyed on the pathname — so anything below it unmounts once the exit animation
// finishes on every step navigation. Holding the flow state here wiped it on each
// Continue and <Guard> bounced the host back to step one.
export default function KycFlow() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl flex-col py-2 sm:py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="mb-0 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.035em] text-maroon sm:text-[30px]">Verification</h1>
        <Link to="/dashboard/kyc" className="inline-flex h-11 items-center rounded-[12px] px-3 text-[14px] font-semibold text-muted transition-colors hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">Cancel</Link>
      </div>
      <Stepper />
      <Guard>
        <div className="flex-1">
          <Outlet />
        </div>
      </Guard>
    </div>
  );
}
