// The pieces both notification surfaces draw: the bell's drawer (desktop) and the
// full-screen list (/dashboard/notifications). Moved out of NotificationsDrawer
// unchanged so the two can never look or behave differently.
import { AlertTriangle, CalendarCheck2, Check, IndianRupee, ShieldCheck } from 'lucide-react';
import { Button } from '../dashboard/ui';
import { cn } from '../dashboard/ui/cn';
import { relDay } from '../dashboard/ui/v2';
import { markHandled } from '../../utils/attentionQueue';

const KIND_ICON = { kyc: ShieldCheck, confirm: CalendarCheck2, unpaid: IndianRupee };
const URGENCY = { now: ['Now', 'bg-error-bg text-error-fg'], today: ['Today', 'bg-warning-bg text-warning-fg'], this_week: ['This week', 'bg-neutral-100 text-muted'] };

export const SectionTitle = ({ id, children, action }) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <h3 id={id} className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{children}</h3>
    {action}
  </div>
);

export const AttentionList = ({ items, onGo }) => (
  items.length === 0 ? (
    <p className="mb-0 flex items-center gap-2 rounded-[16px] bg-cream p-4 text-[14px] font-medium text-success-fg">
      <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> All clear. Nothing needs you right now.
    </p>
  ) : (
    <ul className="mb-0 flex list-none flex-col gap-2 p-0">
      {items.map((a) => {
        const Icon = KIND_ICON[a.kind] || AlertTriangle;
        const [word, cls] = URGENCY[a.urgency] || URGENCY.this_week;
        return (
          <li key={a.id} className="flex flex-col gap-3 rounded-[16px] bg-cream p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-maroon"><Icon className="h-5 w-5" strokeWidth={2} /></span>
              <div className="min-w-0 flex-1">
                <p className="mb-0 flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold text-ink">
                  {a.title} <span className={cn('rounded-[6px] px-1.5 text-[12px] font-semibold', cls)}>{word}</span>
                </p>
                <p className="mb-0 mt-0.5 text-[13px] text-muted">{a.detail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-[52px]">
              <Button size="sm" onClick={() => onGo(a.to)}>{a.cta}</Button>
              <Button size="sm" variant="ghost" onClick={() => markHandled(a.id)}>Mark handled</Button>
            </div>
          </li>
        );
      })}
    </ul>
  )
);

export const UpdateRow = ({ n, onOpen, time }) => (
  <button type="button" onClick={() => onOpen(n)}
    className="flex min-h-[56px] w-full items-start gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-cream active:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
    <span aria-hidden="true" className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-maroon')} />
    <span className="min-w-0 flex-1">
      <span className={cn('block text-[14px] text-ink', !n.read_at && 'font-semibold')}>{n.title}</span>
      {n.body && <span className="block text-[13px] text-muted">{n.body}</span>}
      {n.created_at && <span className="block text-[12px] text-faint">{time ? time(n.created_at) : relDay(n.created_at)}</span>}
    </span>
    {!n.read_at && <span className="sr-only">Unread</span>}
  </button>
);

export const UpdatesSkeleton = () => (
  <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading updates">
    {[0, 1, 2].map((i) => <span key={i} className="h-14 animate-pulse rounded-[14px] bg-neutral-100" />)}
  </div>
);

export const UpdatesError = ({ onRetry }) => (
  <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">
    Couldn&apos;t load updates. <button type="button" onClick={onRetry} className="font-semibold text-maroon underline">Try again</button>
  </p>
);

export const UpdatesEmpty = () => (
  <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">No updates yet. New bookings and payouts show up here.</p>
);
