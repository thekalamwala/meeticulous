import { useEffect, useState, useCallback } from 'react';
import { getSupportUnread } from '../services/api';
import { getSupabase } from '../services/supabaseClient';

// Live unread-reply count for the host sidebar / guest tab Chat badge. No polling:
// an initial fetch, then refetch when the thread's realtime channel pushes a new
// message or status, on window focus, and when SupportChat signals it marked the
// thread read (`support:unread-changed`). Server `user_unread` is the source of
// truth — we always refetch rather than trust a local counter.
export default function useSupportUnread() {
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    try {
      const { data } = await getSupportUnread();
      setCount(data?.count || 0);
      return data?.thread_id || null;
    } catch {
      return null; // never surface a badge error
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let chan = null;

    (async () => {
      const threadId = await refetch();
      if (cancelled || !threadId) return;
      const sb = await getSupabase();
      if (cancelled) return;
      chan = sb
        .channel(`support:thread:${threadId}`)
        .on('broadcast', { event: 'message' }, () => refetch())
        .on('broadcast', { event: 'status' }, () => refetch())
        .subscribe();
    })();

    const onFocus = () => refetch();
    const onRead = () => refetch();
    window.addEventListener('focus', onFocus);
    window.addEventListener('support:unread-changed', onRead);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('support:unread-changed', onRead);
      if (chan) getSupabase().then((sb) => sb.removeChannel(chan)).catch(() => {});
    };
  }, [refetch]);

  return count;
}
