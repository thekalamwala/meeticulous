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

function Stepper() {
  const { pathname } = useLocation();
  const cur = pathname.split('/').pop();
  const curIdx = ORDER.indexOf(cur);
  return (
    <ol className="mb-6 flex items-center justify-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const state = i < curIdx ? 'done' : i === curIdx ? 'active' : 'todo';
        return (
          <li key={s.path} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  state === 'done' && 'bg-primary text-white',
                  state === 'active' && 'bg-primary/10 text-primary ring-2 ring-primary',
                  state === 'todo' && 'bg-gray-100 text-gray-400'
                )}
              >
                {state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('mt-1 hidden text-xs sm:block', state === 'active' ? 'text-primary' : 'text-gray-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className={cn('h-px w-4 sm:w-8', i < curIdx ? 'bg-primary' : 'bg-gray-200')} />}
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
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl flex-col py-4">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Identity Verification</h1>
        <Link to="/dashboard/kyc" className="text-sm text-gray-400 hover:text-gray-600">Cancel</Link>
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
