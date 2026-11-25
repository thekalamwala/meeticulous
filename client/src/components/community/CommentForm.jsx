import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CornerDownRight } from 'lucide-react';
import { createComment } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { useFeature } from '../../context/FeatureContext';
import { Avatar } from './AuthorChip';
import useMentionSuggest from './useMentionSuggest';
import useTermsGate from './useTermsGate';
import { errCode, errorCopy, fmtCount } from './communityErrors';

const MAX = 2000; // mirrors LIMITS.COMMENT in server/services/community/text.js
// The counter is noise until it can tell you something: show it only in the last stretch
// before the cap (or once you are over it).
const COUNTER_FROM = MAX - 200;

// Reply box. `parent` = the comment being answered (null = the post itself). `focusTick`
// bumps each time a Reply button is pressed so the box scrolls into view and takes focus.
// `onCreated(comment)` receives the saved comment so the page can append it without a refetch.
//
// At rest this is one pill. The label, hint, counter and Reply button only appear once you
// mean to write — five pieces of chrome in front of an empty box asked people to read the
// form before they had anything to say.
export default function CommentForm({ itemId, parent, focusTick = 0, onCreated, onSettle, onCancel }) {
  const { user } = useAuth();
  const v2 = useFeature('community_v2');
  const [guard, termsDialog] = useTermsGate();
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [banned, setBanned] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const root = useRef(null);
  const mention = useMentionSuggest({ value: body, setValue: setBody, inputRef: box });
  const bodyProps = v2
    ? { onChange: mention.onChange, onKeyDown: mention.onKeyDown, ...mention.aria }
    : { onChange: (e) => setBody(e.target.value) };

  useEffect(() => {
    if (!focusTick) return;
    setOpen(true);
    root.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    box.current?.focus({ preventScroll: true });
  }, [focusTick]);

  // Answering a specific comment is already an intent to write, so the box opens with it.
  useEffect(() => { if (parent) setOpen(true); }, [parent]);

  const over = body.length > MAX;
  const ready = body.trim() && !over && !busy && !banned;
  const who = parent?.author?.profile_url ? `@${parent.author.profile_url.replace(/^\//, '')}` : parent?.author?.display_name;
  // Keep the box open while there is a draft, an error or a reply target to lose.
  const collapse = () => { if (!body.trim() && !err && !parent) setOpen(false); };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setErr('');
    const text = body.trim();
    // Optimistic: drop the reply in now, reconcile with the server copy, roll back on failure.
    const tempId = `temp-${Date.now()}`;
    const temp = {
      id: tempId,
      body: text,
      author: {
        id: user?.id,
        display_name: user?.name || 'You',
        avatar_url: user?.profile_image || null,
        role: user?.role || 'host',
        badge: null,
        profile_url: user?.username ? `/${user.username}` : null,
      },
      created_at: new Date().toISOString(),
      like_count: 0,
      viewer: { liked: false },
      parent_id: parent?.id || null,
      pending: true,
    };
    onCreated(temp);
    setBody('');
    setOpen(false);
    setBusy(true);
    try {
      const { comment } = await guard(() => createComment(itemId, { body: text, ...(parent && { parent_id: parent.id }) }));
      analytics.track(EVENTS.COMMUNITY_REPLY_CREATED, { item: itemId });
      onSettle?.(tempId, comment);
    } catch (e2) {
      onSettle?.(tempId, null);
      setBody(text); // restore the draft (covers terms-gate cancel too)
      setOpen(true);
      if (!e2?.cancelled) {
        if (errCode(e2) === 'COMMUNITY_BANNED') setBanned(true);
        setErr(errorCopy(e2, user));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={root} onSubmit={submit} className={`mt-composer-inline ${open ? 'mt-composer-inline--open' : ''}`}>
      <Avatar author={{ display_name: user?.name, avatar_url: user?.profile_image, role: user?.role }} />
      {/* focusout on the wrapper, not the textarea: blurring straight onto the Reply button
          would otherwise unmount it before the click landed. */}
      <div
        className={`min-w-0 flex-1 ${err ? 'mt-field--error' : ''}`}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) collapse(); }}
      >
        {parent && (
          <div className="mt-field-foot mb-2">
            <span className="mt-post__meta inline-flex items-center gap-2"><CornerDownRight size={14} aria-hidden="true" />Replying to {who}</span>
            <button type="button" onClick={onCancel} className="mt-btn mt-btn--ghost mt-btn--s">Cancel</button>
          </div>
        )}
        <div className="mt-composer-inline__box">
          <label className="sr-only" htmlFor="reply-body">Your reply</label>
          <textarea
            ref={box}
            id="reply-body"
            rows={open ? 3 : 1}
            value={body}
            placeholder={parent ? 'Write a reply…' : 'Add a comment…'}
            aria-describedby={err ? 'reply-err' : undefined}
            onFocus={() => setOpen(true)}
            {...bodyProps}
          />
          {v2 && mention.list}
          {open && (
            <div className="mt-composer-inline__tools">
              {(body.length >= COUNTER_FROM || over) && (
                <span aria-live="polite" className={`mt-counter ${over ? 'mt-counter--over' : ''}`}>{fmtCount(body.length)} / {fmtCount(MAX)}</span>
              )}
              <button type="submit" className={`mt-btn mt-btn--s ${body.length >= COUNTER_FROM || over ? '' : 'ml-auto'}`} disabled={!ready}>Reply</button>
            </div>
          )}
        </div>
        {open && (
          <div className="mt-field-foot mt-2">
            {err
              ? <span id="reply-err" role="alert" className="mt-hint mt-hint-row"><CircleAlert size={16} aria-hidden="true" />{err}</span>
              : <span className="mt-hint">Be kind. No phone numbers or emails.</span>}
          </div>
        )}
      </div>
      {termsDialog}
    </form>
  );
}
