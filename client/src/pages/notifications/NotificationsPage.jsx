// /dashboard/notifications (Kept) — every update, grouped by day. On phones the
// bell opens this; on desktop the bell's drawer links here ("See all").
// Same data and actions as the drawer (useHostNotifications + NotificationParts).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import useHostNotifications from '../../hooks/useHostNotifications';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { fmtTime } from '../../components/dashboard/ui/v2';
import {
  AttentionList, SectionTitle, UpdateRow, UpdatesEmpty, UpdatesError, UpdatesSkeleton,
} from '../../components/common/NotificationParts';

const dayKey = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayLabel = (key) => {
  const today = dayKey(Date.now());
  if (key === today) return 'Today';
  if (key === today - 86_400_000) return 'Yesterday';
  const d = new Date(key);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

export const groupByDay = (list) => {
  const groups = [];
  for (const n of list) {
    const key = n.created_at ? dayKey(n.created_at) : 0;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: key ? dayLabel(key) : 'Earlier', items: [] }));
    g.items.push(n);
  }
  return groups;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifs, unread, status, items, loadNotifs, reload, markRead, markAll, markSeen } = useHostNotifications();
  useRegisterRefresh(reload);
  useEffect(() => { markSeen(); }, [markSeen]);

  const groups = groupByDay(notifs);

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      {/* Phone: a pushed screen, so it gets a way back (the bell is how you came). */}
      <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
        className="-mb-3 -ml-2 inline-flex min-h-[44px] w-fit items-center gap-0.5 rounded-[12px] pl-1 pr-3 text-[15px] font-semibold text-maroon active:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose lg:hidden">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /> Back
      </button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon lg:text-[34px]">Notifications</h1>
          <p className="mb-0 mt-1.5 text-[14px] text-muted lg:text-[15px]">
            {unread > 0 ? `${unread} unread` : status === 'ready' ? 'You are up to date.' : 'Bookings, payments and your account.'}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAll}
            className="min-h-[44px] rounded-[12px] px-3 text-[14px] font-semibold text-maroon transition-colors hover:bg-pink-50 active:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
            Mark all read
          </button>
        )}
      </header>

      {items.length > 0 && (
        <section aria-labelledby="n-attention" className="rounded-[24px] bg-white p-4 lg:p-5">
          <SectionTitle id="n-attention">Needs your attention</SectionTitle>
          <AttentionList items={items} onGo={navigate} />
        </section>
      )}

      {status === 'loading' && notifs.length === 0 ? (
        <section className="rounded-[24px] bg-white p-4 lg:p-5"><UpdatesSkeleton /></section>
      ) : status === 'error' && notifs.length === 0 ? (
        <UpdatesError onRetry={loadNotifs} />
      ) : notifs.length === 0 ? (
        <UpdatesEmpty />
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`day-${g.key}`}>
            <h2 id={`day-${g.key}`} className="mb-2 px-1 text-[13px] font-semibold text-muted lg:text-[14px]">{g.label}</h2>
            <ul className="mb-0 flex list-none flex-col rounded-[24px] bg-white p-2 lg:p-3">
              {g.items.map((n) => (
                <li key={n.id}>
                  <UpdateRow n={n} time={fmtTime} onOpen={(x) => { markRead(x); if (x.link) navigate(x.link); }} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
