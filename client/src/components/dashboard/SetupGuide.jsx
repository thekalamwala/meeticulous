// SetupGuide — "Finish setting up your page": the host's go-live path as a
// vertical progress rail + accordion (pattern founder-picked, 2026-11-25). One step open at
// a time; the first unfinished step opens by default with its one action. Hides
// itself once every step is done. Built for Today and Grow → Your page.
//
// Steps are derived from REAL state only (buildSetupSteps is pure and tested):
// a service exists, availability is saved, the page has a photo + bio, payouts are
// verified (or in review), and the booking link has been copied at least once.
import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from './ui';
import { cn } from './ui/cn';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export const buildSetupSteps = ({ hasService, availabilitySet, user, kyc, linkShared }) => {
  const kycStatus = String(kyc?.status || '').toLowerCase();
  const payoutsDone = ['approved', 'verified', 'submitted', 'pending'].includes(kycStatus);
  const held = Number(kyc?.pending_earnings) || 0;
  return [
    {
      key: 'service', done: !!hasService, title: 'Add what you sell',
      body: 'Sessions, products, courses or memberships. Guests book and pay from your page.',
      cta: hasService ? 'See your catalog' : 'Add a service', to: hasService ? '/dashboard/catalog' : '/dashboard/service/add-new',
    },
    {
      key: 'availability', done: !!availabilitySet, title: 'Set your availability',
      body: 'Pick the days and hours you take bookings. Connect Google Calendar so busy times block themselves.',
      cta: availabilitySet ? 'Edit hours' : 'Set availability', to: '/dashboard/availability',
    },
    {
      key: 'page', done: !!(user?.profile_image && user?.bio), title: 'Make your page yours',
      body: 'Add a photo, a short bio and your colours, so guests know who they are booking.',
      cta: 'Edit your page', to: '/dashboard/profile',
    },
    {
      key: 'payouts', done: payoutsDone, title: 'Set up payouts',
      body: held > 0 && !payoutsDone
        ? `${rupees(held)} is waiting. Verify your PAN and bank once and we'll release it.`
        : 'A one-time PAN and bank check, so paid bookings reach your account.',
      cta: payoutsDone ? 'See payouts' : 'Verify now', to: payoutsDone ? '/dashboard/payments/payouts' : '/dashboard/kyc',
    },
    {
      key: 'share', done: !!linkShared, title: 'Share your booking link',
      body: 'Put your link where your audience already is: bio, WhatsApp status, email signature.',
      cta: 'Copy booking link', action: 'copy',
    },
  ];
};

export default function SetupGuide({ steps, onGo, onCopy, title = 'Finish setting up your page', className = '' }) {
  const firstOpen = useMemo(() => steps.find((s) => !s.done)?.key ?? null, [steps]);
  const [open, setOpen] = useState(firstOpen);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    // Two columns on desktop: heading, count and mascot on the left, the checklist on
    // the right (founder call, 2026-11-25). On a phone the mascot sits beside the heading.
    <section aria-labelledby="setup-guide" className={cn('overflow-hidden rounded-[24px] bg-white lg:grid lg:grid-cols-[300px_1fr]', className)}>
      <div className="flex items-start justify-between gap-3 p-5 sm:p-6 lg:flex-col lg:justify-start">
        <div className="min-w-0">
          <h2 id="setup-guide" className="mb-0 font-display text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[22px]">{title}</h2>
          <p className="mb-0 mt-1 text-[13.5px] text-muted">{done} of {steps.length} done · a few minutes each</p>
        </div>
        <img src="/about/mascot-green.png" alt="" aria-hidden="true" className="h-16 w-16 shrink-0 object-contain lg:hidden" />
        {/* Desktop: the mascot fills whatever height the checklist leaves under the heading
            (founder call, 2026-11-25). Absolutely placed so it never makes the card taller. */}
        <div aria-hidden="true" className="relative mt-4 hidden min-h-[140px] w-full flex-1 lg:block">
          <img src="/about/mascot-green.png" alt="" className="absolute inset-0 h-full w-full object-contain object-left-bottom" />
        </div>
      </div>

      {/* Progress runs down the step markers as a vertical rail (founder call, 2026-11-25):
          each step's segment turns maroon once that step is done. */}
      <ul role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Setup progress"
        className="border-t border-neutral-200 lg:border-l lg:border-t-0">
        {steps.map((s, i) => {
          const isOpen = open === s.key;
          const act = () => (s.action === 'copy' ? onCopy?.() : onGo?.(s.to));
          return (
            <li key={s.key} className={cn('relative', i > 0 && 'border-t border-neutral-200', isOpen ? 'bg-white' : 'bg-cream/50')}>
              <span aria-hidden="true" className={cn('pointer-events-none absolute left-[30px] z-[1] w-1 sm:left-[34px]',
                i === 0 ? 'bottom-0 top-[26px]' : i === steps.length - 1 ? '-top-px h-[27px]' : '-top-px bottom-0',
                s.done ? 'bg-maroon' : 'bg-neutral-200')} />
              <button type="button" onClick={() => setOpen(isOpen ? null : s.key)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-none px-5 py-3.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose sm:px-6">
                {s.done
                  ? <span className="relative z-[2] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success-fg text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  : <span aria-hidden="true" className="relative z-[2] h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-neutral-300 bg-white" />}
                <span className={cn('min-w-0 flex-1 text-[15px]', s.done ? 'font-medium text-muted' : 'font-semibold text-ink')}>
                  {s.title}<span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span>
                </span>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-faint transition-transform', isOpen && 'rotate-180')} strokeWidth={2} />
              </button>
              {isOpen && (
                <div className="flex flex-col items-start gap-3 px-5 pb-4 pl-14 sm:px-6 sm:pl-[60px]">
                  <p className="mb-0 max-w-[52ch] text-[14px] text-muted">{s.body}</p>
                  <Button size="md" variant={s.done ? 'secondary' : 'primary'} onClick={act}>{s.cta}</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
