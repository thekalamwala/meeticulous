// "Send feedback" — the old /dashboard/feedback page as one option on Help
// (founder call, 2026-11-26). Same API (POST /feedback, GET /feedback/mine) and
// the same fields; it now opens as a sheet, and your past feedback (with our
// replies) sits under the form.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { submitFeedback, getMyFeedback } from '../../services/api';
import { Button, Select } from '../../components/dashboard/ui';
import KeptSheet from '../../components/dashboard/ui/KeptSheet';
import { relDay } from '../../components/dashboard/ui/v2';
import { cn } from '../../components/dashboard/ui/cn';

const TYPES = [
  { v: 'idea', label: 'Idea' },
  { v: 'bug', label: 'Something broke' },
  { v: 'complaint', label: 'Complaint' },
  { v: 'praise', label: 'Praise' },
  { v: 'other', label: 'Other' },
];
const AREAS = [
  ['booking', 'Bookings'], ['payments', 'Payments'], ['dashboard', 'Dashboard'],
  ['profile', 'My page'], ['availability', 'Schedule'], ['other', 'Something else'],
];
const STATUS = { new: 'Sent', reviewing: 'Reading it', planned: 'Planned', shipped: 'Shipped', declined: 'Not planned' };

export const useMyFeedback = () => {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const load = useCallback(() => {
    getMyFeedback()
      .then(({ data }) => setState({ status: 'ready', items: data?.feedback || [] }))
      .catch(() => setState((s) => ({ ...s, status: s.items.length ? 'ready' : 'error' })));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
};

export default function FeedbackSheet({ open, onClose, feedback }) {
  const [type, setType] = useState('idea');
  const [area, setArea] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!body.trim()) { toast.error('Write a line or two first.'); return; }
    setSaving(true);
    try {
      await submitFeedback({ type, area: area || undefined, subject: subject || undefined, body,
        context: { page_url: window.location.href, user_agent: navigator.userAgent } });
      toast.success('Thanks. We read every one.');
      setSubject(''); setBody(''); setArea(''); setType('idea');
      feedback?.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send. Try again.');
    } finally { setSaving(false); }
  };

  return (
    <KeptSheet open={open} onClose={onClose} title="Send feedback" sub="What works, what doesn't, what you'd love to see."
      footer={<Button type="submit" form="feedback-form" className="w-full" disabled={saving}>{saving ? 'Sending…' : 'Send feedback'}</Button>}>
      <form id="feedback-form" onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-[13.5px] font-semibold text-ink">What is it?</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.v} type="button" onClick={() => setType(t.v)} aria-pressed={type === t.v}
                className={cn('min-h-[40px] rounded-[10px] px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
                  type === t.v ? 'bg-maroon text-white' : 'bg-cream text-muted hover:bg-blush hover:text-maroon')}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="fb-area" className="mb-1.5 block text-[13.5px] font-semibold text-ink">About <span className="font-normal text-muted">(optional)</span></label>
          <Select id="fb-area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Choose one</option>
            {AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="fb-subject" className="mb-1.5 block text-[13.5px] font-semibold text-ink">Title <span className="font-normal text-muted">(optional)</span></label>
          <div className="mt-input"><input id="fb-subject" type="text" enterKeyHint="next" maxLength={160}
            value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="In a few words" /></div>
        </div>
        <div>
          <label htmlFor="fb-body" className="mb-1.5 block text-[13.5px] font-semibold text-ink">Your feedback</label>
          <div className="mt-input mt-input--textarea"><textarea id="fb-body" maxLength={4000} rows={5}
            value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell us what happened, or what you'd like." /></div>
        </div>
      </form>

      <section aria-labelledby="fb-mine" className="mt-6">
        <h3 id="fb-mine" className="mb-2 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">What you've sent</h3>
        {feedback?.status === 'loading' ? (
          <div className="flex flex-col gap-2" aria-busy="true">{[0, 1].map((i) => <span key={i} className="h-16 animate-pulse rounded-[16px] bg-neutral-100" />)}</div>
        ) : feedback?.status === 'error' ? (
          <p className="mb-0 rounded-[16px] bg-cream p-4 text-[13.5px] text-muted">
            Couldn&apos;t load your past feedback. <button type="button" onClick={feedback.reload} className="font-semibold text-maroon underline">Try again</button>
          </p>
        ) : !feedback?.items?.length ? (
          <p className="mb-0 rounded-[16px] bg-cream p-4 text-[13.5px] text-muted">Nothing yet. What you send shows up here, with our reply.</p>
        ) : (
          <ul className="mb-0 flex list-none flex-col gap-2 p-0">
            {feedback.items.map((f) => (
              <li key={f.id} className="rounded-[16px] bg-cream p-3.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{f.subject || TYPES.find((t) => t.v === f.type)?.label || 'Feedback'}</span>
                  <span className="shrink-0 rounded-[8px] bg-white px-2 py-0.5 text-[12px] font-semibold text-muted">{STATUS[f.status] || 'Sent'}</span>
                </div>
                {f.created_at && <p className="mb-0 mt-0.5 text-[12px] text-faint">{relDay(f.created_at)}</p>}
                <p className="mb-0 mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13px] text-muted">{f.body}</p>
                {f.admin_response && (
                  <p className="mb-0 mt-2 rounded-[12px] bg-white p-2.5 text-[13px] text-ink">
                    <span className="font-semibold text-maroon">Our reply: </span>{f.admin_response}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </KeptSheet>
  );
}
