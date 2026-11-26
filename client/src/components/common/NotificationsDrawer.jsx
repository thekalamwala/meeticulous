// Notifications drawer (Kept, founder pick 2026-11-25): the bell opens a right-side
// drawer with "Needs your attention" first — the action queue that used to sit on
// Today — then the latest updates and a "See all" link to /dashboard/notifications.
// On phones (2026-11-26) the bell opens that full-screen list instead. Reachable
// from every page; Today keeps one slim line that opens it.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useHostNotifications from '../../hooks/useHostNotifications';
import useIsMobile from '../../hooks/useIsMobile';
import { cn } from '../dashboard/ui/cn';
import { Drawer } from '../dashboard/ui/v2';
import { OPEN_NOTIFICATIONS_EVENT } from '../../utils/attentionQueue';
import {
  AttentionList, SectionTitle, UpdateRow, UpdatesEmpty, UpdatesError, UpdatesSkeleton,
} from './NotificationParts';

export default function NotificationsDrawer() {
  const navigate = useNavigate();
  // Kept (2026-11-26): on a phone the bell opens the full-screen list; the drawer
  // is the desktop surface, with a "See all" link to that same list.
  const phone = useIsMobile('(max-width: 1023px)');
  const [open, setOpen] = useState(false);
  const { notifs, unread, status, items, badge, blink, markSeen, loadNotifs, reload, markRead, markAll } = useHostNotifications();

  useEffect(() => { if (open) reload(); }, [open, reload]);
  useEffect(() => {
    const onOpen = () => (phone ? navigate('/dashboard/notifications') : setOpen(true));
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
  }, [phone, navigate]);

  const go = (to) => { setOpen(false); navigate(to); };
  const onBell = () => (phone ? navigate('/dashboard/notifications') : setOpen(true));

  // Blinker: pulses while something is waiting that the host hasn't looked at;
  // opening the drawer (or the full list) marks it seen. See useHostNotifications.
  useEffect(() => { if (open) markSeen(); }, [open, markSeen]);

  return (
    <>
      <button type="button" onClick={onBell}
        aria-label={`Notifications${badge ? `, ${badge} waiting` : ''}`} aria-haspopup={phone ? undefined : 'dialog'} aria-expanded={phone ? undefined : open}
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
            <SectionTitle id="attention">Needs your attention</SectionTitle>
            <AttentionList items={items} onGo={go} />
          </section>

          <section aria-labelledby="updates">
            <SectionTitle id="updates" action={unread > 0 && (
              <button type="button" onClick={markAll}
                className="rounded-[8px] px-2 py-1 text-[13px] font-semibold text-maroon transition hover:bg-pink-100">
                Mark all read
              </button>
            )}>Updates</SectionTitle>
            {status === 'loading' && notifs.length === 0 ? <UpdatesSkeleton />
              : status === 'error' && notifs.length === 0 ? <UpdatesError onRetry={loadNotifs} />
                : notifs.length === 0 ? <UpdatesEmpty />
                  : (
                    <ul className="-mx-2 mb-0 flex list-none flex-col p-0">
                      {notifs.slice(0, 8).map((n) => (
                        <li key={n.id}><UpdateRow n={n} onOpen={(x) => { markRead(x); if (x.link) go(x.link); }} /></li>
                      ))}
                    </ul>
                  )}
            <Link to="/dashboard/notifications" onClick={() => setOpen(false)}
              className="mt-2 flex min-h-[44px] items-center justify-between rounded-[12px] px-2 text-[14px] font-semibold text-maroon transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
              See all notifications <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </Drawer>
    </>
  );
}
