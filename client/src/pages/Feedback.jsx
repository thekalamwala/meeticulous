// client/src/pages/Feedback.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquarePlus } from 'lucide-react';
import { submitFeedback, getMyFeedback } from '../services/api';
import {
  PageHeader, Card, Section, Button, FormField, Select, Input, Textarea,
  StatusBadge, EmptyState, SkeletonCard, cn,
} from '../components/dashboard/ui';

const TYPES = [
  { v: 'idea', label: '💡 Idea' },
  { v: 'bug', label: '🐞 Bug' },
  { v: 'complaint', label: '😕 Complaint' },
  { v: 'praise', label: '🎉 Praise' },
  { v: 'other', label: 'Other' },
];
const AREAS = ['booking', 'payments', 'dashboard', 'profile', 'availability', 'other'];

export default function Feedback() {
  const [type, setType] = useState('idea');
  const [area, setArea] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const { data } = await getMyFeedback(); setItems(data.feedback || []); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return toast.error('Please write your feedback');
    setSaving(true);
    try {
      await submitFeedback({ type, area: area || undefined, subject: subject || undefined, body, context: { page_url: window.location.href, user_agent: navigator.userAgent } });
      toast.success('Thanks! We read every piece of feedback.');
      setSubject(''); setBody(''); setArea(''); setType('idea');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send feedback');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Feedback"
        subtitle="Tell us what's working, what's not, and what you'd love to see. We read everything."
      />

      <Card as="form" onSubmit={submit} className="mb-8 max-w-2xl space-y-4">
        <FormField label="What kind of feedback?" className="mb-0">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.v}
                onClick={() => setType(t.v)}
                aria-pressed={type === t.v}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  type === t.v
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Area" htmlFor="fb-area" hint="Optional" className="mb-0">
            <Select id="fb-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Choose an area…</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </FormField>
          <FormField label="Title" htmlFor="fb-subject" hint="Optional" className="mb-0">
            <Input id="fb-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="Short title" />
          </FormField>
        </div>

        <FormField label="Your feedback" htmlFor="fb-body" required className="mb-0">
          <Textarea id="fb-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} placeholder="Your feedback…" />
        </FormField>

        <Button type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send feedback'}
        </Button>
      </Card>

      <Section title="Your feedback" className="max-w-2xl">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="No feedback yet"
            description="Anything you send shows up here, along with our response."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((f) => (
              <Card as="li" key={f.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{f.subject || f.type}</span>
                  <StatusBadge status={f.status} />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{f.body}</p>
                {f.admin_response && (
                  <p className="mt-2 border-l-2 border-primary/40 pl-2 text-xs text-gray-500">
                    <span className="font-semibold">Team:</span> {f.admin_response}
                  </p>
                )}
              </Card>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
