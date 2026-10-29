import { useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { getNotificationChannel } from '../services/api';

// Live in-app notifications: subscribe to the recipient's realtime topic and call
// `onPing` whenever the server broadcasts a new notification, so an open bell
// updates instantly instead of only on next poll/open. Same broadcast mechanism
// as support chat (display-only — the caller refetches the feed, which stays the
// source of truth). No-op until a userId is known.
//
// The topic is HMAC-derived server-side (not the raw user id), so we fetch it
// from an authed endpoint rather than build `notif:user:<id>` locally — a raw id
// is no longer enough to subscribe to someone's channel.
export default function useLiveNotifications(userId, onPing) {
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let chan = null;

    (async () => {
      let topic;
      try { ({ data: { topic } = {} } = await getNotificationChannel()); }
      catch { return; } // no channel → fall back to poll-on-open + focus
      if (cancelled || !topic) return;
      const sb = await getSupabase();
      if (cancelled) return;
      chan = sb
        .channel(topic)
        .on('broadcast', { event: 'notification' }, () => { onPing(); })
        .subscribe();
    })();

    // Also refetch on window focus — cheap catch-up for anything missed while hidden.
    const onFocus = () => onPing();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      if (chan) getSupabase().then((sb) => sb.removeChannel(chan)).catch(() => {});
    };
  }, [userId, onPing]);
}
