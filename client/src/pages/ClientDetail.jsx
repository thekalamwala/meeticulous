import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Tag, Repeat, UserX, MessageSquare, Trash2, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { crmGetCustomer, crmGetNotes, crmAddNote, crmDeleteNote, svcGetAll } from '../services/api';
import {
  PageHeader, Card, Badge, StatusBadge, Button, Textarea, buttonClasses,
  EmptyState, ErrorState, SkeletonText, SkeletonCard, fmtMoney,
} from '../components/dashboard/ui';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Plain-text star glyphs — matches the existing CustomerReviews rating display,
// avoids pulling in another icon.
const Stars = ({ n }) => (
  <span className="text-primary text-sm tracking-tight" aria-label={`${n} out of 5`}>
    {'★'.repeat(n)}<span className="text-gray-200">{'★'.repeat(5 - n)}</span>
  </span>
);

const Meta = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
  </div>
);

const HistoryItem = ({ b, serviceMap }) => (
  <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-gray-800">{serviceMap[b.service_id] || 'Service'}</p>
      <p className="text-xs text-gray-400">{fmtDate(b.scheduled_at || b.created_at)}</p>
    </div>
    <div className="shrink-0 text-right">
      <p className="text-sm font-semibold text-gray-800">{fmtMoney(b.customer_total)}</p>
      <div className="mt-1"><StatusBadge status={b.status} /></div>
    </div>
  </div>
);

// Private notes — list + add + delete. Isolated so its own loading state
// doesn't block the rest of the detail page.
const NotesSection = ({ customerId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    crmGetNotes(customerId)
      .then(({ data }) => setNotes(data.notes || []))
      .catch(() => toast.error('Failed to load notes'))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await crmAddNote(customerId, trimmed);
      setBody('');
      load();
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await crmDeleteNote(customerId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      toast.error('Failed to delete note');
    }
  };

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <MessageSquare className="h-4 w-4 text-gray-400" /> Notes
      </h3>
      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a private note about this client…"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" disabled={saving || !body.trim()} className="sm:self-end">
          Add
        </Button>
      </form>
      {loading ? (
        <SkeletonText lines={3} />
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50/60 p-3">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-sm text-gray-700">{n.body}</p>
                <p className="mt-1 text-xs text-gray-400">{fmtDate(n.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                title="Delete note"
                className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

const ClientDetail = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [serviceMap, setServiceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gated, setGated] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setGated(false);
    Promise.all([
      crmGetCustomer(id),
      svcGetAll().catch(() => ({ data: [] })), // best-effort — enriches history with service titles
    ])
      .then(([detailRes, svcRes]) => {
        setCustomer(detailRes.data.customer);
        setHistory(detailRes.data.history || []);
        setReviews(detailRes.data.reviews || []);
        const map = {};
        (svcRes.data || []).forEach((s) => { map[s.id] = s.title; });
        setServiceMap(map);
      })
      .catch((err) => {
        if (err.response?.status === 403 && err.response?.data?.upgrade_required) setGated(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Client" />
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (gated) {
    return (
      <div>
        <PageHeader title="Customer" subtitle="Your customers" />
        <Card className="border-2 border-dashed border-primary/30 text-center">
          <div className="mb-3 text-3xl">🗂️</div>
          <h3 className="mb-1 font-semibold text-gray-900">Unlock Customers</h3>
          <p className="mb-4 text-sm text-gray-500">This is a Studio feature.</p>
          <Link to="/dashboard/upgrade" className={buttonClasses({ variant: 'primary' })}>
            Upgrade to Studio
          </Link>
        </Card>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div>
        <PageHeader title="Customer" />
        <ErrorState message="Couldn't load this customer." onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <Link to="/dashboard/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{customer.name || 'Unknown Client'}</h2>
              {customer.is_recurring && <Badge tone="primary"><Repeat className="h-3 w-3" />Recurring</Badge>}
              {customer.no_show_count > 0 && (
                <Badge tone="warning">
                  <UserX className="h-3 w-3" />
                  {customer.no_show_count} no-show{customer.no_show_count > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {customer.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
              {customer.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
            </div>
            {customer.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {customer.tags.map((t) => (
                  <Badge key={t} tone="neutral"><Tag className="h-3 w-3" />{t}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-2xl font-bold text-primary">{fmtMoney(customer.total_spent)}</p>
            <p className="text-xs text-gray-400">Total spent · {customer.bookings_count} bookings</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <Meta label="Client since" value={fmtDate(customer.first_booked_at)} />
          <Meta label="Last seen" value={fmtDate(customer.last_booking_at)} />
          <Meta
            label="Next upcoming"
            value={
              customer.next_upcoming_at ? (
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-gray-400" />{fmtDate(customer.next_upcoming_at)}</span>
              ) : '—'
            }
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Booking History</h3>
          {history.length === 0 ? (
            <EmptyState title="No bookings yet" description="This client's bookings will show up here." />
          ) : (
            <div>{history.map((b) => <HistoryItem key={b.id} b={b} serviceMap={serviceMap} />)}</div>
          )}

          {reviews.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reviews</h4>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-lg bg-gray-50/60 p-3">
                    <Stars n={r.rating} />
                    {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <NotesSection customerId={id} />
      </div>
    </div>
  );
};

export default ClientDetail;
