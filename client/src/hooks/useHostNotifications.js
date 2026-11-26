// The host's notifications + "Needs your attention" queue, in one place.
// Lifted out of NotificationsDrawer (no logic change) so the bell's drawer and
// the full-screen /dashboard/notifications list read the same state the same way.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useLiveNotifications from './useLiveNotifications';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead, getHostBookings, getMyKyc,
} from '../services/api';
import { buildQueue, readHandled, HANDLED_EVENT } from '../utils/attentionQueue';

const SEEN_KEY = 'mt_notifications_seen';
const SEEN_EVENT = 'dash:notifications-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };

export default function useHostNotifications() {
  const { user } = useAuth();
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
  const reload = useCallback(() => { loadNotifs(); loadQueue(); }, [loadNotifs, loadQueue]);

  useEffect(() => { reload(); }, [reload]);
  useLiveNotifications(user?.id, loadNotifs);
  useEffect(() => {
    const onHandled = () => setHandled(readHandled());
    window.addEventListener(HANDLED_EVENT, onHandled);
    return () => window.removeEventListener(HANDLED_EVENT, onHandled);
  }, []);

  const items = queue.filter((a) => !handled.includes(a.id));

  // Optimistic: the row reads as read at once; the server call is fire-and-forget.
  const markRead = (n) => {
    markNotificationRead(n.id).catch(() => {});
    setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => (n.read_at ? u : Math.max(0, u - 1)));
  };
  const markAll = () => markAllNotificationsRead('host').then(loadNotifs).catch(() => {});

  // "Seen" (the bell's blinker): a signature of what was waiting when the host last
  // looked (attention ids + newest unread update), stored per browser, so a NEW
  // item starts the pulse again. Shared through an event so the bell stops blinking
  // the moment the full-screen list is opened too.
  const badge = unread + items.length;
  const signature = badge ? [...items.map((a) => a.id), notifs.find((n) => !n.read_at)?.id || ''].join('|') : '';
  const [seen, setSeen] = useState(readSeen);
  useEffect(() => {
    const onSeen = () => setSeen(readSeen());
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, []);
  const markSeen = useCallback(() => {
    if (!signature) return;
    try { localStorage.setItem(SEEN_KEY, signature); } catch { /* per-session is fine */ }
    setSeen(signature);
    window.dispatchEvent(new CustomEvent(SEEN_EVENT));
  }, [signature]);

  return { notifs, unread, status, items, badge, blink: badge > 0 && signature !== seen, markSeen, loadNotifs, reload, markRead, markAll };
}
