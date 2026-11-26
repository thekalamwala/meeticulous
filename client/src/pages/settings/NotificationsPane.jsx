// Settings → Notifications (Kept). Honest, no toggles (founder call, 2026-11-26):
// there is no per-host preference store yet, so this screen says what we send and
// where, instead of drawing switches that would change nothing.
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Mail, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Panel } from '../../components/dashboard/ui/v2';
import SettingsShell from './SettingsShell';

const CHANNELS = (user) => [
  { icon: Mail, label: 'Email', value: user?.email ? `To ${user.email}` : 'No email on your account yet' },
  { icon: Bell, label: 'In the app', value: 'The bell at the top of every page' },
  { icon: MessageCircle, label: 'WhatsApp', value: 'Not switched on yet. We will tell you when it is.' },
];

const WHAT = [
  ['Bookings', 'New, rescheduled and cancelled bookings, and reminders before each one.'],
  ['Money', 'Payments received and payouts sent to your bank.'],
  ['Your account', 'Verification, your plan and anything that needs your attention.'],
];

export default function NotificationsPane() {
  const { user } = useAuth();
  return (
    <SettingsShell pane="notifications" sub="What we tell you about, and where.">
      <Panel title="Where we reach you">
        <ul className="mb-0 list-none divide-y divide-neutral-200/70 p-0">
          {CHANNELS(user).map(({ icon: Icon, label, value }) => (
            <li key={label} className="flex min-h-[56px] items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-blush text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{label}</span>
                <span className="block truncate text-[12.5px] text-muted lg:text-[13px]">{value}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What we send">
        <ul className="mb-0 flex list-none flex-col gap-3 p-0">
          {WHAT.map(([t, d]) => (
            <li key={t}>
              <p className="mb-0 text-[14px] font-semibold text-ink lg:text-[15px]">{t}</p>
              <p className="mb-0 mt-0.5 text-[13px] text-muted lg:text-[14px]">{d}</p>
            </li>
          ))}
        </ul>
        <p className="mb-0 mt-4 rounded-[16px] bg-cream p-3.5 text-[13px] text-muted lg:text-[14px]">
          You can&apos;t switch these off one by one yet. They are the messages you need to run your bookings.
        </p>
      </Panel>

      <Link to="/dashboard/notifications"
        className="flex min-h-[56px] items-center gap-3 rounded-[24px] bg-white px-5 py-3 text-left transition-colors hover:bg-pink-50 active:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-maroon">See all notifications</span>
          <span className="block truncate text-[12.5px] text-muted lg:text-[13px]">Everything the bell has shown you, by day</span>
        </span>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
      </Link>
    </SettingsShell>
  );
}
