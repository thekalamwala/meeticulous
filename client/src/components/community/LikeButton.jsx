import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { like, unlike } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import useRequireLogin from './useRequireLogin';
import useTermsGate from './useTermsGate';
import useReactionFx from './useReactionFx';

// Optimistic like. The flip and the animation happen on the press; the request goes out
// after and never gates either.
//
// There is deliberately no in-flight lock. A lock makes the button ignore you while the
// previous request finishes, which is exactly what makes a feed feel slow — tap-tap-tap
// and only the first one lands. Instead every press is numbered and only the newest press
// may reconcile: a response from an older press is dropped, so the state always settles on
// the last thing the person actually did.
export default function LikeButton({ targetType, id, liked, count }) {
  const [state, setState] = useState({ liked: !!liked, count: Number(count) || 0 });
  const seq = useRef(0);
  const requireLogin = useRequireLogin();
  const [guard, termsDialog] = useTermsGate();
  const { trigger, fxProps, layers } = useReactionFx('like');

  const toggle = async () => {
    if (!requireLogin()) return;

    const next = { liked: !state.liked, count: Math.max(0, state.count + (state.liked ? -1 : 1)) };
    setState(next);
    if (next.liked) trigger(); // the burst belongs to liking, not to taking it back
    seq.current += 1;
    const mine = seq.current;

    try {
      await guard(() => (next.liked ? like : unlike)(targetType, id));
      if (next.liked) analytics.track(EVENTS.COMMUNITY_LIKED, { target_type: targetType });
    } catch (e) {
      // A stale response can't speak for the current state — the person has pressed since.
      if (mine !== seq.current) return;
      setState({ liked: !next.liked, count: Math.max(0, next.count + (next.liked ? -1 : 1)) });
      // {cancelled:true} = user dismissed the terms dialog; nothing was written, stay quiet.
      if (!e?.cancelled) toast.error("Couldn't save that. Try again.");
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
        {...fxProps}
        className={`mt-btn mt-btn--ghost mt-btn--s mt-fx gap-2 font-medium ${state.liked ? 'text-maroon' : 'text-muted hover:text-maroon'}`}
      >
        {layers}
        <Heart size={16} aria-hidden="true" fill={state.liked ? 'currentColor' : 'none'} />
        {n}
      </button>
      {termsDialog}
    </>
  );
}
