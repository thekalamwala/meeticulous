import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CornerDownRight } from 'lucide-react';
import { createComment } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import useTermsGate from './useTermsGate';
import { errCode, errorCopy, fmtCount } from './communityErrors';

const MAX = 2000; // mirrors LIMITS.COMMENT in server/services/community/text.js

// Reply box. `parent` = the comment being answered (null = the post itself). `focusTick`
// bumps each time a Reply button is pressed so the box scrolls into view and takes focus.
// `onCreated(comment)` receives the saved comment so the page can append it without a refetch.
export default function CommentForm({ itemId, parent, focusTick = 0, onCreated, onCancel }) {
  const { user } = useAuth();
  const [guard, termsDialog] = useTermsGate();
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [banned, setBanned] = useState(false);
  const box = useRef(null);
  const root = useRef(null);

  useEffect(() => {
    if (!focusTick) return;
    root.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    box.current?.focus({ preventScroll: true });
  }, [focusTick]);

  const over = body.length > MAX;
  const ready = body.trim() && !over && !busy && !banned;
  const who = parent?.author?.profile_url ? `@${parent.author.profile_url.replace(/^\//, '')}` : parent?.author?.display_name;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr('');
    try {
      const { comment } = await guard(() => createComment(itemId, { body: body.trim(), ...(parent && { parent_id: parent.id }) }));
      analytics.track(EVENTS.COMMUNITY_REPLY_CREATED, { item: itemId });
      setBody('');
      onCreated(comment);
    } catch (e2) {
      if (!e2?.cancelled) {
        if (errCode(e2) === 'COMMUNITY_BANNED') setBanned(true);
        setErr(errorCopy(e2, user));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={root} onSubmit={submit} className="mt-replybox">
      {parent && (
        <div className="mt-field-foot">
          <span className="inline-flex items-center gap-2 text-xs text-muted"><CornerDownRight size={16} aria-hidden="true" />Replying to {who}</span>
          <button type="button" onClick={onCancel} className="mt-btn mt-btn--ghost mt-btn--s">Cancel</button>
        </div>
      )}
      <div className={`mt-field ${err ? 'mt-field--error' : ''}`}>
        <label className="mt-label" htmlFor="reply-body">Your reply</label>
        <div className="mt-input mt-input--textarea">
          <textarea ref={box} id="reply-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share what's worked for you" aria-describedby={err ? 'reply-err' : undefined} />
        </div>
        <div className="mt-field-foot">
          {err
            ? <span id="reply-err" role="alert" className="mt-hint mt-hint-row"><CircleAlert size={16} aria-hidden="true" />{err}</span>
            : <span className="mt-hint">Be kind. No phone numbers or emails.</span>}
          <span aria-live="polite" className={`mt-counter ${over ? 'mt-counter--over' : ''}`}>{fmtCount(body.length)} / {fmtCount(MAX)}</span>
        </div>
      </div>
      <div className="flex justify-end"><button type="submit" className="mt-btn" disabled={!ready}>Reply</button></div>
      {termsDialog}
    </form>
  );
}
