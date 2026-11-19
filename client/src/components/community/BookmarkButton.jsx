import { useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { savePost, unsavePost } from '../../services/communityApi';
import useRequireLogin from './useRequireLogin';
import useTermsGate from './useTermsGate';
import useReactionFx from './useReactionFx';

// Optimistic save, mirroring LikeButton: the flip and the ribbon play on the press, the
// request follows, and only the newest press is allowed to reconcile (see LikeButton for
// why there is no in-flight lock). Count hidden when zero.
export default function BookmarkButton({ id, saved, count }) {
  const [state, setState] = useState({ saved: !!saved, count: Number(count) || 0 });
  const seq = useRef(0);
  const requireLogin = useRequireLogin();
  const [guard, termsDialog] = useTermsGate();
  const { trigger, fxProps, layers } = useReactionFx('ribbon');

  const toggle = async () => {
    if (!requireLogin()) return;

    const next = { saved: !state.saved, count: Math.max(0, state.count + (state.saved ? -1 : 1)) };
    setState(next);
    if (next.saved) trigger(); // the ribbon unfurls on saving, not on un-saving
    seq.current += 1;
    const mine = seq.current;

    try {
      await guard(() => (next.saved ? savePost : unsavePost)(id));
    } catch (e) {
      if (mine !== seq.current) return; // a later press already decided the state
      setState({ saved: !next.saved, count: Math.max(0, next.count + (next.saved ? -1 : 1)) });
      if (!e?.cancelled) toast.error("Couldn't save that. Try again.");
    }
  };

  const n = state.count;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state.saved}
        aria-label={`${state.saved ? 'Saved' : 'Save'}${n ? `, ${n} ${n === 1 ? 'save' : 'saves'}` : ''}`}
        {...fxProps}
        className={`mt-btn mt-btn--ghost mt-btn--s mt-fx gap-2 font-medium ${state.saved ? 'text-maroon' : 'text-muted hover:text-maroon'}`}
      >
        {layers}
        <Bookmark size={16} aria-hidden="true" fill={state.saved ? 'currentColor' : 'none'} />
        {n > 0 && n}
      </button>
      {termsDialog}
    </>
  );
}
