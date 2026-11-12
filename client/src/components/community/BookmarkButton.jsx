import { useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { savePost, unsavePost } from '../../services/communityApi';
import useRequireLogin from './useRequireLogin';
import useTermsGate from './useTermsGate';

// Optimistic bookmark (save), mirroring LikeButton. Logged out -> login; terms
// gate pops TermsDialog and retries once on accept. Count hidden when zero.
export default function BookmarkButton({ id, saved, count }) {
  const [state, setState] = useState({ saved: !!saved, count: Number(count) || 0 });
  const busy = useRef(false);
  const requireLogin = useRequireLogin();
  const [guard, termsDialog] = useTermsGate();

  const toggle = async () => {
    if (!requireLogin() || busy.current) return;
    busy.current = true;
    const prev = state;
    const next = { saved: !prev.saved, count: Math.max(0, prev.count + (prev.saved ? -1 : 1)) };
    setState(next);
    try {
      await guard(() => (next.saved ? savePost : unsavePost)(id));
    } catch (e) {
      setState(prev);
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
        aria-pressed={state.saved}
        aria-label={`${state.saved ? 'Saved' : 'Save'}${n ? `, ${n} ${n === 1 ? 'save' : 'saves'}` : ''}`}
        className={`mt-btn mt-btn--ghost mt-btn--s gap-2 font-medium ${state.saved ? 'text-maroon' : 'text-muted hover:text-maroon'}`}
      >
        <Bookmark size={16} aria-hidden="true" fill={state.saved ? 'currentColor' : 'none'} />
        {n > 0 && n}
      </button>
      {termsDialog}
    </>
  );
}
