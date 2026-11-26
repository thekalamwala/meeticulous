// Settings → Integrations (Kept). Only Google Calendar is real: connecting is the
// existing OAuth redirect (getGoogleAuthUrl) and connected state rides on
// user.google_calendar_connected. There is no disconnect endpoint, so a connected
// calendar points the host at Google to revoke access (same as before).
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { getGoogleAuthUrl } from '../../services/api';
import { Button } from '../../components/dashboard/ui';
import { Panel } from '../../components/dashboard/ui/v2';
import SettingsShell from './SettingsShell';

// Names only: these have no backend. Shown so a host knows we heard them.
const SOON = ['Zoom', 'Outlook Calendar', 'Apple Calendar', 'Zapier', 'Meta Pixel', 'Zoho CRM'];

export default function IntegrationsPane() {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const [going, setGoing] = useState(false);
  const connected = !!user?.google_calendar_connected;

  const connect = () => {
    setGoing(true);
    getGoogleAuthUrl()
      .then(({ data }) => { window.location.href = data.url; })
      .catch(() => { setGoing(false); toast.error('Could not reach Google. Try again.'); });
  };

  return (
    <SettingsShell pane="integrations" sub="Tools Meeticulous works with.">
      {flags.google_calendar !== false && (
        <Panel>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon"><CalendarDays className="h-5 w-5" strokeWidth={1.9} /></span>
            <div className="min-w-0 flex-1">
              <p className="mb-0 truncate text-[15px] font-semibold text-ink lg:text-[16px]">Google Calendar</p>
              <p className="mb-0 mt-0.5 text-[13px] text-muted lg:text-[14px]">
                {connected
                  ? 'Connected. Bookings land on your calendar and online ones get a Google Meet link.'
                  : 'Put bookings on your calendar and give online ones a Google Meet link.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 pl-0 sm:pl-14">
            {connected ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-success-fg"><Check className="h-4 w-4" strokeWidth={2.6} /> Connected</span>
                <p className="mb-0 w-full text-[12.5px] text-muted lg:text-[13px]">To disconnect, remove Meeticulous from your Google account&apos;s third-party access.</p>
              </>
            ) : (
              <Button size="sm" onClick={connect} disabled={going}>{going ? 'Opening Google…' : 'Connect Google Calendar'}</Button>
            )}
          </div>
        </Panel>
      )}

      <Panel title="Coming later" subtitle="Need one of these sooner? Tell us from Help.">
        <ul className="mb-0 flex list-none flex-wrap gap-2 p-0">
          {SOON.map((n) => (
            <li key={n} className="rounded-[8px] bg-cream px-2.5 py-1 text-[13px] font-medium text-muted">{n}</li>
          ))}
        </ul>
      </Panel>
    </SettingsShell>
  );
}
