// Notifications drawer (Kept, founder pick 2026-11-25): the bell opens a right-side
// drawer (full width on phones) with "Needs your attention" first — the action
// queue that used to sit on Today — then the notification feed. Reachable from
// every page; Today keeps one slim line that opens it.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarCheck2, Check, IndianRupee, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useLiveNotifications from '../../hooks/useLiveNotifications';
import { getNotifications, markAllNotificationsRead, markNotificationRead, getHostBookings, getMyKyc } from '../../services/api';
import { Button } from '../dashboard/ui';
import { cn } from '../dashboard/ui/cn';
import { Drawer, relDay } from '../dashboard/ui/v2';
import {
  buildQueue, readHandled, markHandled, HANDLED_EVENT, OPEN_NOTIFICATIONS_EVENT,
} from '../../utils/attentionQueue';

const KIND_ICON = { kyc: ShieldCheck, confirm: CalendarCheck2, unpaid: IndianRupee };
const SEEN_KEY = 'mt_notifications_seen';
const URGENCY = { now: ['Now', 'bg-error-bg text-error-fg'], today: ['Today', 'bg-warning-bg text-warning-fg'], this_week: ['This week', 'bg-neutral-100 text-muted'] };

export default function NotificationsDrawer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState('loading');
  const [queue, setQueue] = useState([]);
  const [handled, setHandled] = useState(readHandled);

  const loadNotifs = useCallback(() => {
    getNotifications('host')
      .then(({ data }) => { setNotifs(data.notifications || []); setUnread(data.unreadCount || 0); setStatus('ready'); })
      .catch(() => setStatus((s) => (s === 'loading' ? 'error' : s)));
  }, []);
  const loadQueue = useCallback(() => {
    Promise.all([
      getHostBookings().then(({ data }) => (Array.isArray(data) ? data : [])).catch(() => []),
      getMyKyc().then((r) => r?.data ?? null).catch(() => null),
    ]).then(([bk, kyc]) => setQueue(buildQueue(bk, kyc)));
  }, []);

  useEffect(() => { loadNotifs(); loadQueue(); }, [loadNotifs, loadQueue]);
  useEffect(() => { if (open) { loadNotifs(); loadQueue(); } }, [open, loadNotifs, loadQueue]);
  useLiveNotifications(user?.id, loadNotifs);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onHandled = () => setHandled(readHandled());
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
    window.addEventListener(HANDLED_EVENT, onHandled);
    return () => { window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen); window.removeEventListener(HANDLED_EVENT, onHandled); };
  }, []);

  const items = queue.filter((a) => !handled.includes(a.id));
  const badge = unread + items.length;
  const go = (to) => { setOpen(false); navigate(to); };

  // Blinker: the bell pulses while there is something the host hasn't looked at
  // yet, and stops the moment they open the drawer. "Seen" is a signature of what
  // was waiting at that moment (attention ids + newest unread update), stored per
  // browser, so a NEW item starts the pulse again.
  const signature = badge ? [...items.map((a) => a.id), notifs.find((n) => !n.read_at)?.id || ''].join('|') : '';
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } });
  const blink = badge > 0 && signature !== seen;
  useEffect(() => {
    if (!open || !signature) return;
    try { localStorage.setItem(SEEN_KEY, signature); } catch { /* per-session is fine */ }
    setSeen(signature);
  }, [open, signature]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={`Notifications${badge ? `, ${badge} waiting` : ''}`} aria-haspopup="dialog" aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-[12px] bg-white text-muted transition-colors hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <Bell className={cn('h-[19px] w-[19px]', blink && 'text-maroon')} strokeWidth={1.8} />
        {blink && (
          // Soft pulse behind the badge; off under reduced motion (the badge stays).
          <span aria-hidden="true" className="absolute -right-1 -top-1 h-5 w-5 animate-ping rounded-[8px] bg-maroon/60 motion-reduce:hidden" />
        )}
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-[8px] bg-maroon px-1 text-[11px] font-semibold tabular-nums text-white ring-2 ring-cream">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications"
        subtitle={items.length ? `${items.length} need${items.length > 1 ? '' : 's'} your attention` : 'All clear'} width="sm:w-[440px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="attention">
            <h3 id="attention" className="mb-3 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Needs your attention</h3>
            {items.length === 0 ? (
              <p className="mb-0 flex items-center gap-2 rounded-[16px] bg-cream p-4 text-[14px] font-medium text-success-fg">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> All clear. Nothing needs you right now.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((a) => {
                  const Icon = KIND_ICON[a.kind] || AlertTriangle;
                  const [word, cls] = URGENCY[a.urgency] || URGENCY.this_week;
                  return (
                    <li key={a.id} className="flex flex-col gap-3 rounded-[16px] bg-cream p-3.5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-maroon"><Icon className="h-5 w-5" strokeWidth={2} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="mb-0 flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold text-ink">
                            {a.title} <span className={cn('rounded-[6px] px-1.5 text-[11px] font-semibold', cls)}>{word}</span>
                          </p>
                          <p className="mb-0 mt-0.5 text-[13px] text-muted">{a.detail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-[52px]">
                        <Button size="sm" onClick={() => go(a.to)}>{a.cta}</Button>
                        <Button size="sm" variant="ghost" onClick={() => markHandled(a.id)}>Mark handled</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="updates">
            <div className="mb-2 flex items-center justify-between">
              <h3 id="updates" className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Updates</h3>
              {unread > 0 && (
                <button type="button" onClick={() => markAllNotificationsRead('host').then(loadNotifs).catch(() => {})}
                  className="rounded-[8px] px-2 py-1 text-[13px] font-semibold text-maroon transition hover:bg-pink-100">
                  Mark all read
                </button>
              )}
            </div>
            {status === 'loading' && notifs.length === 0 ? (
              <div className="flex flex-col gap-2" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="h-14 animate-pulse rounded-[14px] bg-neutral-100" />)}</div>
            ) : status === 'error' && notifs.length === 0 ? (
              <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">
                Couldn&apos;t load updates. <button type="button" onClick={loadNotifs} className="font-semibold text-maroon underline">Try again</button>
              </p>
            ) : notifs.length === 0 ? (
              <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">No updates yet. New bookings and payouts show up here.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <button type="button"
                      onClick={() => {
                        markNotificationRead(n.id).catch(() => {});
                        setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                        setUnread((u) => (n.read_at ? u : Math.max(0, u - 1)));
                        if (n.link) go(n.link);
                      }}
                      className="flex w-full items-start gap-3 rounded-[12px] px-2 py-3 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                      <span aria-hidden="true" className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-maroon')} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[14px] text-ink', !n.read_at && 'font-semibold')}>{n.title}</span>
                        {n.body && <span className="block text-[13px] text-muted">{n.body}</span>}
                        {n.created_at && <span className="block text-[12px] text-faint">{relDay(n.created_at)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Drawer>
    </>
  );
}
