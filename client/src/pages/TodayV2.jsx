// Today — dashboard_v2 graduation of the Host Lab "Today" onto the REAL Overview
// data (getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc). Opens on
// decisions: money you can act on, the queue of things waiting, today's bookings,
// then how it's going. Shown only on the flag-ON path (App picks it in Dashboard).
//
// The action queue is DERIVED from real state (pending confirmations, unpaid
// completed bookings, KYC) — no invented tasks. Revenue sparkline + delta are
// computed from the host's own paid bookings. "Where bookings came from" shows
// only when bookings actually carry a source; nothing is faked.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, Check, IndianRupee,
  MessageSquare, Share2, ShieldCheck, Video,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc } from '../services/api';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, Drawer, PageHeading, Panel, Sparkline, StatusPill, Tile, RankedBars,
  cn, inr, fmtTime, relDay, useLast,
} from '../components/dashboard/ui/v2';

const lower = (s) => String(s || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
const isPaid = (b) => lower(b.payment_status) === 'paid';
const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };

// Last 6 calendar months of paid revenue, oldest→newest. Pure, tested.
export const revenueSeries = (bookings, now = new Date()) => {
  const out = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const revenue = bookings
      .filter((b) => isPaid(b) && b.scheduled_at && monthKey(b.scheduled_at) === key)
      .reduce((n, b) => n + amountOf(b), 0);
    out.push({ month: d.toLocaleDateString('en-IN', { month: 'short' }), revenue });
  }
  return out;
};

// Real "needs you" items derived from bookings + kyc. Hardest first.
export const buildQueue = (bookings, kyc, now = Date.now()) => {
  const q = [];
  const kycStatus = lower(kyc?.status || kyc?.kyc_status);
  if (kycStatus && !['approved', 'verified'].includes(kycStatus)) {
    q.push({ id: 'kyc', kind: 'kyc', urgency: 'now', title: 'Verify to get paid', detail: 'Payouts are locked until verification is approved.', cta: 'Verify', to: '/dashboard/kyc' });
  }
  const pending = bookings.filter((b) => lower(b.status) === 'pending' && new Date(b.scheduled_at) > now - 86400000);
  if (pending.length) {
    q.push({ id: 'confirm', kind: 'confirm', urgency: 'now', title: `${pending.length} booking${pending.length > 1 ? 's' : ''} to confirm`, detail: pending.slice(0, 2).map((b) => b.guest_name || 'Guest').join(', '), cta: 'Review', to: '/dashboard/bookings' });
  }
  const unpaid = bookings.filter((b) => lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && ['completed', 'confirmed'].includes(lower(b.status)));
  if (unpaid.length) {
    const owed = unpaid.reduce((n, b) => n + amountOf(b), 0);
    q.push({ id: 'unpaid', kind: 'unpaid', urgency: 'today', title: `${unpaid.length} unpaid booking${unpaid.length > 1 ? 's' : ''}`, detail: `${inr(owed)} not yet collected`, cta: 'See', to: '/dashboard/bookings' });
  }
  return q;
};

const KIND_ICON = { kyc: ShieldCheck, confirm: CalendarCheck2, unpaid: IndianRupee };
const URGENCY = { now: ['Now', 'bg-error-bg text-error-fg'], today: ['Today', 'bg-warning-bg text-warning-fg'], this_week: ['This week', 'bg-neutral-100 text-ink/55'] };

const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };

const TodayV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = useCallback((to) => navigate(to), [navigate]);

  const [balance, setBalance] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [views, setViews] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [dismissed, setDismissed] = useState([]);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setStatus('loading');
    Promise.all([
      getPayoutBalance().catch(() => null),
      getHostBookings().then(({ data }) => (Array.isArray(data) ? data : [])),
      getMyProfileViews().then((r) => Number(r?.data?.views) || 0).catch(() => null),
      getMyKyc().then((r) => r?.data ?? null).catch(() => null),
    ])
      .then(([bal, bk, vw, k]) => { setBalance(bal?.data ?? null); setBookings(bk); setViews(vw); setKyc(k); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const series = useMemo(() => revenueSeries(bookings), [bookings]);
  const thisMonth = series.at(-1)?.revenue || 0;
  const lastMonth = series.at(-2)?.revenue || 0;
  const delta = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const upcoming = useMemo(() => bookings.filter((b) => lower(b.status) !== 'cancelled' && new Date(b.scheduled_at) > Date.now()).length, [bookings]);

  const queue = useMemo(() => buildQueue(bookings, kyc).filter((a) => !dismissed.includes(a.id)), [bookings, kyc, dismissed]);

  const todays = useMemo(() => {
    const t = new Date().toDateString();
    return bookings
      .filter((b) => b.scheduled_at && new Date(b.scheduled_at).toDateString() === t && lower(b.status) !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [bookings]);
  const openBooking = useLast(todays.find((b) => b.id === openId) || null);

  const sources = useMemo(() => {
    const by = {};
    for (const b of bookings) {
      const s = b.source && b.source !== 'manual_cash' ? b.source : null;
      if (!s) continue;
      by[s] = (by[s] || 0) + 1;
    }
    return Object.entries(by).map(([label, bookingsCount]) => ({ label, bookingsCount })).sort((a, b) => b.bookingsCount - a.bookingsCount).slice(0, 4);
  }, [bookings]);

  const money = (v) => (balance ? inr(v ?? 0) : '—');
  const held = (balance?.clearing || 0) + (balance?.pendingCompletion || 0);
  const firstName = (user?.name || 'there').trim().split(/\s+/)[0];

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2.5">
        <PageHeading title="Today" />
        <ErrorState message="Couldn't load your dashboard." onRetry={load} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PageHeading
        title="Today"
        sub={(
          <>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {user?.city ? ` · ${user.city}` : ''}
            {queue.length > 0 && <span className="text-warning-fg"> · {queue.length} waiting on you</span>}
          </>
        )}
      />

      {status === 'loading' ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile accent label="Ready to withdraw" value={money(balance?.available)} hint={`${money(held)} clearing or held`} onClick={() => go('/dashboard/payments/payouts')} />
          <Tile label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month"
            spark={series.some((s) => s.revenue > 0) ? <Sparkline values={series.map((s) => s.revenue)} /> : undefined}
            onClick={() => go('/dashboard/earnings')} />
          <Tile label="Upcoming" value={upcoming} hint="Not yet past" onClick={() => go('/dashboard/bookings')} />
          <Tile label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Public profile" onClick={() => go(user?.username ? `/${user.username}` : '/dashboard/profile')} />
        </div>
      )}

      {/* Needs you */}
      {status === 'ready' && (
        queue.length === 0 ? (
          <Panel title="Needs you">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-success-fg">
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.8} /> All clear. Nothing needs you right now.
            </p>
          </Panel>
        ) : (
          <Panel title="Needs you" subtitle={`${queue.length} waiting · hardest first`} flush>
            <ul className="divide-y-2 divide-neutral-200">
              {queue.map((a) => {
                const Icon = KIND_ICON[a.kind] || AlertTriangle;
                const [word, cls] = URGENCY[a.urgency];
                return (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-blush text-maroon"><Icon className="h-3.5 w-3.5" strokeWidth={2.4} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-bold leading-tight text-ink">{a.title}</span>
                        <span className={cn('rounded-full px-1.5 py-px text-[9.5px] font-bold', cls)}>{word}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-ink/55">{a.detail}</span>
                    </span>
                    <button type="button" onClick={() => go(a.to)} className="inline-flex h-7 shrink-0 items-center rounded-sm border-2 border-maroon px-2 text-[11px] font-bold text-maroon transition hover:bg-blush">{a.cta}</button>
                    <button type="button" onClick={() => setDismissed((d) => [...d, a.id])} aria-label={`Dismiss: ${a.title}`} title="Dismiss"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-xs text-ink/30 transition hover:bg-neutral-100 hover:text-ink/70"><Check className="h-3.5 w-3.5" strokeWidth={2.6} /></button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )
      )}

      <div className="grid gap-2.5 lg:grid-cols-[1.45fr_1fr]">
        {/* Today's timeline */}
        <Panel title="Today" subtitle={todays.length ? `${todays.length} booking${todays.length > 1 ? 's' : ''}` : 'Nothing booked today'}
          action={<Button size="sm" variant="ghost" onClick={() => go('/dashboard/bookings')}>All bookings <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>} flush>
          {status === 'loading' ? (
            <div className="p-3"><Skeleton className="h-10 w-full" /></div>
          ) : todays.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
              <CalendarX2 className="h-5 w-5 text-maroon/30" strokeWidth={1.8} />
              <p className="text-[12px] font-bold text-ink">A clear day</p>
              <p className="max-w-xs text-[11px] font-medium text-ink/55">Share your link if you'd rather it weren't.</p>
              {user?.username && <Button size="sm" className="mt-1" onClick={() => go('/dashboard/profile')}><Share2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Share your page</Button>}
            </div>
          ) : (
            <ul className="divide-y-2 divide-neutral-200">
              {todays.map((b) => {
                const past = new Date(b.scheduled_at) < new Date();
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
                      <span className={cn('w-[46px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                      <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                      <Avatar name={b.guest_name} size="h-7 w-7 text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name || 'Guest'}</span>
                        <span className="block truncate text-[11px] font-medium text-ink/55">{b.services?.title || 'Booking'}{b.services?.duration ? ` · ${b.services.duration} min` : ''}</span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 sm:flex">
                        <StatusPill status={lower(b.status)} />
                        {lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && <StatusPill status="unpaid" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-2.5">
          {sources.length > 0 && (
            <Panel title="Where bookings came from">
              <RankedBars rows={sources} valueKey="bookingsCount" labelKey="label" format={(v) => `${v} booked`} />
            </Panel>
          )}
          <Panel title="Recent bookings" flush>
            {bookings.length === 0 ? (
              <div className="p-3"><EmptyState title="No bookings yet" description="New bookings show up here." /></div>
            ) : (
              <ul className="divide-y-2 divide-neutral-200">
                {[...bookings].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-start gap-2 px-3 py-1.5">
                    <Avatar name={b.guest_name} size="h-6 w-6 text-[9px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] font-medium leading-snug text-ink/80">{b.guest_name || 'Guest'} · {b.services?.title || 'booking'}</span>
                      <span className="mt-px block text-[10px] font-semibold text-ink/40">{relDay(b.scheduled_at)} · {fmtTime(b.scheduled_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Drawer open={!!openId && !!openBooking} onClose={() => setOpenId(null)} title={openBooking?.guest_name || ''} subtitle={openBooking?.services?.title || ''}>
        {openBooking && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={lower(openBooking.status)} />
              {openBooking.payment_status && <StatusPill status={lower(openBooking.payment_status)} />}
            </div>
            <div className="rounded-sm border-2 border-neutral-200 p-3">
              <p className="text-[13px] font-bold text-maroon">{relDay(openBooking.scheduled_at)} · {fmtTime(openBooking.scheduled_at)}</p>
              {openBooking.services?.duration && <p className="mt-0.5 text-[11.5px] font-medium text-ink/55">{openBooking.services.duration} min</p>}
            </div>
            <dl className="grid grid-cols-2 gap-2.5 text-[11.5px]">
              {[['Amount', amountOf(openBooking) ? inr(amountOf(openBooking)) : 'Free'], ['Phone', openBooking.guest_phone || '—'], ['Email', openBooking.guest_email || '—']].map(([k, v]) => (
                <div key={k}><dt className="text-[9.5px] font-bold uppercase tracking-wide text-ink/40">{k}</dt><dd className="mt-0.5 truncate font-semibold text-ink/80">{v}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {openBooking.meet_link && <a href={openBooking.meet_link} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm"><Video className="h-3.5 w-3.5" strokeWidth={2.4} /> Join call</Button></a>}
              {waLink(openBooking.guest_phone)
                ? <a href={waLink(openBooking.guest_phone)} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5" strokeWidth={2.4} /> WhatsApp</Button></a>
                : null}
              <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); go('/dashboard/bookings'); }}>All bookings</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default TodayV2;
