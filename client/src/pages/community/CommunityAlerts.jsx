import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/api';
import { getMe, updateCommunityPrefs } from '../../services/communityApi';
import { relTime } from '../../utils/relTime';
import { SITE_URL } from '../../utils/seo';
import CommunityLayout, { EmptyState, TITLE_SUFFIX } from './CommunityLayout';

const roleOf = (user) => (user?.is_host ? 'host' : 'guest');
// Community alerts only (mentions + replies); other in-app notices live in the main bell.
const isCommunity = (n) => typeof n.type === 'string' && n.type.startsWith('COMMUNITY');

export default function CommunityAlerts() {
  const { user } = useAuth();
  const role = roleOf(user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailOn, setEmailOn] = useState(true);
  const [savingPref, setSavingPref] = useState(false);

  useEffect(() => {
    let live = true;
    getNotifications(role)
      .then((res) => { if (live) setItems((res.data?.notifications || []).filter(isCommunity)); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    getMe().then((d) => { if (live) setEmailOn(d.member?.email_replies !== false); }).catch(() => {});
    return () => { live = false; };
  }, [role]);

  const markAll = () => {
    markAllNotificationsRead(role)
      .then(() => setItems((xs) => xs.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))))
      .catch(() => {});
  };
  const open = (n) => { if (!n.read_at) markNotificationRead(n.id).catch(() => {}); };
  const togglePref = () => {
    const next = !emailOn;
    setEmailOn(next);
    setSavingPref(true);
    updateCommunityPrefs({ email_replies: next })
      .then((d) => setEmailOn(d.email_replies !== false))
      .catch(() => setEmailOn(!next))
      .finally(() => setSavingPref(false));
  };

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <CommunityLayout active="alerts">
      <Seo title={`Alerts${TITLE_SUFFIX}`} canonical={`${SITE_URL}/community/alerts`} robots="noindex,follow" />
      <header className="flex items-center justify-between py-2">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-maroon">Alerts</h1>
        {hasUnread && <button type="button" onClick={markAll} className="mt-btn mt-btn--ghost mt-btn--s">Mark all read</button>}
      </header>

      <label className="mt-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">Email me about mentions &amp; replies</span>
          <span className="block text-xs text-muted">In-app alerts always show here.</span>
        </span>
        <input type="checkbox" checked={emailOn} disabled={savingPref} onChange={togglePref} className="h-5 w-5 shrink-0 accent-maroon" aria-label="Email me about mentions and replies" />
      </label>

      {loading ? (
        <div className="mt-card"><span className="text-sm text-muted">Loading…</span></div>
      ) : items.length === 0 ? (
        <EmptyState illo="mt-illo-group-light.svg" title="No alerts yet." text="When someone mentions you or replies to you, it shows up here." />
      ) : (
        items.map((n) => (
          <Link
            key={n.id}
            to={n.link || '/community'}
            onClick={() => open(n)}
            className={`mt-card no-underline ${!n.read_at ? 'mt-card--blush' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '0.75rem' }}
          >
            <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full bg-maroon/10 text-maroon"><Bell size={16} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{n.title}</span>
              {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
              <span className="block text-xs text-muted">{relTime(n.created_at)}</span>
            </span>
            {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-maroon" aria-label="Unread" />}
          </Link>
        ))
      )}
    </CommunityLayout>
  );
}
