import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { like, unlike } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import useRequireLogin from './useRequireLogin';
import useTermsGate from './useTermsGate';

// Optimistic like: flip now, roll back if the API call fails. Logged out -> login.
// Logged in but terms not accepted -> the gate catches COMMUNITY_TERMS_REQUIRED and
// pops TermsDialog; Accept retries the like once, "Not now" rolls the flip back.
export default function LikeButton({ targetType, id, liked, count }) {
  const [state, setState] = useState({ liked: !!liked, count: Number(count) || 0 });
  const busy = useRef(false);
  const requireLogin = useRequireLogin();
  const [guard, termsDialog] = useTermsGate();

  const toggle = async () => {
    if (!requireLogin() || busy.current) return;
    busy.current = true;
    const prev = state;
    const next = { liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) };
    setState(next);
    try {
      await guard(() => (next.liked ? like : unlike)(targetType, id));
      if (next.liked) analytics.track(EVENTS.COMMUNITY_LIKED, { target_type: targetType });
    } catch (e) {
      setState(prev);
      // {cancelled:true} = user dismissed the terms dialog; nothing was written, stay quiet.
      if (!e?.cancelled) toast.error("Couldn't save that. Try again.");
    } finally {
      busy.current = false;
    }
  };

  const n = state.count;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state.liked}
        aria-label={`${state.liked ? 'Liked' : 'Like'}, ${n} ${n === 1 ? 'like' : 'likes'}`}
        className={`mt-btn mt-btn--ghost mt-btn--s gap-2 font-medium ${state.liked ? 'text-maroon' : 'text-muted hover:text-maroon'}`}
      >
        <Heart size={16} aria-hidden="true" fill={state.liked ? 'currentColor' : 'none'} />
        {n}
      </button>
      {termsDialog}
    </>
  );
}
