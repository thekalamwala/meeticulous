// client/src/pages/admin/Guest360Detail.jsx
// Per-guest 360 (read-only) — one screen aggregating everything about a person
// who books: identity, bookings across all hosts, spend, reviews they left,
// support threads, marketing/consent status, and a merged timeline. Write actions
// are a later phase; this deep-links to Host 360 for the hosts they booked with.
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  adminGuest360Get, adminGuest360Notes, adminGuest360AddNote,
  adminGuest360DeleteNote, adminGuest360Email, adminGuest360Suspend,
} from '../../services/api';
import { Card, Btn, Badge } from '../../components/admin/ui';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtPhone = (p) => (p ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : null);

const FLAG_LABEL = {
  high_cancellation: 'High cancellation rate',
  repeat_no_show: 'Repeat no-shows',
  repeat_refunds: 'Repeat refunds',
  marketing_suppressed: 'Marketing suppressed',
};

const STATUS_TONE = {
  completed: 'bg-emerald-50 text-emerald-700',
  confirmed: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
  no_show: 'bg-red-50 text-red-600',
};

const Stat = ({ label, value, tone }) => (
  <Card className="rounded-2xl p-4">
    <p className={`text-2xl font-bold ${tone || 'adm-t1'}`}>{value}</p>
    <p className="text-[11px] uppercase tracking-wide adm-t3 mt-1">{label}</p>
  </Card>
);

const Section = ({ title, count, children }) => (
  <Card className="rounded-2xl p-4">
    <h3 className="text-[13px] font-semibold adm-t1 mb-3">{title}{count != null ? ` · ${count}` : ''}</h3>
    {children}
  </Card>
);

const Guest360Detail = () => {
  const { key } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await adminGuest360Get(decodeURIComponent(key));
        if (live) setData(res.data);
      } catch (e) {
        if (live) setErr(e?.response?.status === 404 ? 'Guest not found.' : 'Failed to load guest.');
      }
    })();
    return () => { live = false; };
  }, [key]);

  // ── Phase 3 write actions ──
  const [notes, setNotes] = useState([]);
  const [noteBody, setNoteBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const loadNotes = useCallback(async () => {
    try { const r = await adminGuest360Notes(decodeURIComponent(key)); setNotes(r.data.notes || []); } catch { /* notes non-fatal */ }
  }, [key]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    const b = noteBody.trim(); if (!b) return;
    setBusy(true);
    try { await adminGuest360AddNote(decodeURIComponent(key), b); setNoteBody(''); await loadNotes(); toast.success('Note added'); }
    catch { toast.error('Failed to add note'); } finally { setBusy(false); }
  };
  const delNote = async (id) => {
    try { await adminGuest360DeleteNote(decodeURIComponent(key), id); await loadNotes(); }
    catch { toast.error('Failed to delete note'); }
  };
  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return toast.error('Subject and body are required');
    setBusy(true);
    try {
      const r = await adminGuest360Email(decodeURIComponent(key), { subject: emailSubject, body: emailBody });
      toast.success(`Emailed ${r.data.to}`); setEmailOpen(false); setEmailSubject(''); setEmailBody('');
    } catch (e) { toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Send failed'); }
    finally { setBusy(false); }
  };
  const toggleSuspend = async (suspend) => {
    if (suspend && !window.confirm('Suspend this guest’s account? Their sessions are revoked immediately.')) return;
    setBusy(true);
    try { await adminGuest360Suspend(decodeURIComponent(key), { suspend }); toast.success(suspend ? 'Guest suspended' : 'Guest unsuspended'); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };

  if (err) return (
    <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">
      {err}<div className="mt-3"><Btn size="sm" variant="outline" onClick={() => navigate('/admin/guest360')}>Back to Guest 360°</Btn></div>
    </div>
  );
  if (!data) return <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">Loading…</div>;

  const { guest, red_flags = [], hosts_booked = [], bookings = [], reviews = [], support = [], marketing, timeline = [] } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-emerald-500">
            {(guest.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold adm-t1">{guest.name}</h1>
              {guest.has_account
                ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Registered</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Guest</span>}
            </div>
            <p className="text-[13px] adm-t3">{fmtPhone(guest.phone) || guest.email || '—'}{guest.phone && guest.email ? ` · ${guest.email}` : ''}</p>
          </div>
        </div>
        <Btn size="sm" variant="outline" onClick={() => navigate('/admin/guest360')}>← All guests</Btn>
      </div>

      {red_flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {red_flags.map((f) => (
            <span key={f} className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-600">⚠ {FLAG_LABEL[f] || f}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" onClick={() => setEmailOpen(true)} disabled={!guest.email}
          title={guest.email ? '' : 'No email on file for this guest'}>Email guest</Btn>
        {guest.phone && (
          <a href={`https://wa.me/91${guest.phone}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border adm-border px-3 py-1.5 text-[13px] adm-t2 hover:border-emerald-500 hover:text-emerald-600 transition">WhatsApp</a>
        )}
        {guest.has_account && (
          <Btn size="sm" variant="outline" onClick={() => toggleSuspend(true)} disabled={busy}>Suspend account</Btn>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Bookings" value={guest.bookings} />
        <Stat label="Spent" value={inr(guest.spent)} />
        <Stat label="Completed" value={guest.completed} tone="text-emerald-600" />
        <Stat label="Cancelled" value={guest.cancelled} tone={guest.cancelled ? 'text-red-600' : 'adm-t1'} />
        <Stat label="No-shows" value={guest.no_show} tone={guest.no_show ? 'text-red-600' : 'adm-t1'} />
        <Stat label="Refunded" value={guest.refunded} tone={guest.refunded ? 'text-amber-600' : 'adm-t1'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bookings */}
        <Section title="Bookings" count={bookings.length}>
          {bookings.length === 0 ? <p className="text-[12px] adm-t3">No bookings.</p> : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 border-b adm-border pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13px] adm-t1 truncate">{b.service?.title || 'Service'}</p>
                    <p className="text-[11px] adm-t3">
                      {fmtDate(b.scheduled_at)}
                      {b.host?.id && <> · with <Link to={`/admin/host360/${b.host.id}`} className="text-[#2E1065] hover:underline">{b.host.name || 'host'}</Link></>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] adm-t2 font-medium">{inr(b.customer_total)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_TONE[b.status] || 'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Hosts booked with */}
        <Section title="Hosts booked with" count={hosts_booked.length}>
          {hosts_booked.length === 0 ? <p className="text-[12px] adm-t3">None.</p> : (
            <div className="flex flex-wrap gap-2">
              {hosts_booked.map((h) => (
                <Link key={h.id} to={`/admin/host360/${h.id}`}
                  className="text-[12px] px-2.5 py-1 rounded-full border adm-border adm-t2 hover:border-[#2E1065] hover:text-[#2E1065] transition">
                  {h.name || h.username || 'host'}
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Reviews left */}
        <Section title="Reviews left" count={reviews.length}>
          {reviews.length === 0 ? <p className="text-[12px] adm-t3">No reviews written.</p> : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r.id} className="border-b adm-border pb-2 last:border-0 last:pb-0">
                  <p className="text-[12px] adm-t1">{'★'.repeat(r.rating)}<span className="adm-t3">{'★'.repeat(5 - r.rating)}</span>
                    {r.host_name && <span className="adm-t3"> · {r.host_name}</span>}</p>
                  {r.comment && <p className="text-[12px] adm-t2 mt-0.5">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Marketing + Support */}
        <Section title="Consent & support">
          <div className="space-y-2 text-[12px]">
            {marketing ? (
              <>
                <div className="flex items-center gap-2"><span className="adm-t3 w-28">Contact type</span><span className="adm-t1">{marketing.contact_type || '—'}</span></div>
                <div className="flex items-center gap-2"><span className="adm-t3 w-28">Email</span>{marketing.email_suppressed ? <Badge tone="red">Suppressed</Badge> : <span className="adm-t1">OK</span>}</div>
                <div className="flex items-center gap-2"><span className="adm-t3 w-28">WhatsApp</span>{marketing.whatsapp_suppressed ? <Badge tone="red">Suppressed</Badge> : <span className="adm-t1">OK</span>}</div>
                <div className="flex items-center gap-2"><span className="adm-t3 w-28">Do not contact</span>{marketing.do_not_contact ? <Badge tone="red">Yes</Badge> : <span className="adm-t1">No</span>}</div>
              </>
            ) : <p className="adm-t3">Not in the marketing contacts list.</p>}
            <div className="flex items-center gap-2 pt-1 border-t adm-border mt-2">
              <span className="adm-t3 w-28">Support threads</span><span className="adm-t1">{support.length}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Timeline */}
      <Section title="Timeline" count={timeline.length}>
        {timeline.length === 0 ? <p className="text-[12px] adm-t3">No activity yet.</p> : (
          <div className="space-y-2">
            {timeline.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-[12px]">
                <span className="adm-t3 w-24 shrink-0">{fmtDateTime(e.ts)}</span>
                <span className="adm-t1">{e.label}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Admin notes */}
      <Section title="Internal notes" count={notes.length}>
        <div className="flex gap-2 mb-3">
          <input className="fb-input text-sm flex-1" value={noteBody} onChange={(e) => setNoteBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }} placeholder="Add a note (only admins see this)…" />
          <Btn size="sm" onClick={addNote} disabled={busy || !noteBody.trim()}>Add</Btn>
        </div>
        {notes.length === 0 ? <p className="text-[12px] adm-t3">No notes yet.</p> : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 border-b adm-border pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] adm-t1 whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="text-[11px] adm-t3 mt-0.5">{n.admin_email || 'admin'} · {fmtDateTime(n.created_at)}</p>
                </div>
                <button onClick={() => delNote(n.id)} className="text-[12px] text-red-500 shrink-0 hover:underline">Delete</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Email modal */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEmailOpen(false)}>
          <div className="adm-card rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b adm-border">
              <p className="text-sm font-semibold adm-t1">Email {guest.name}</p>
              <button onClick={() => setEmailOpen(false)} className="adm-t3 text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[12px] adm-t3">To: {guest.email}</p>
              <input className="fb-input text-sm w-full" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" />
              <textarea className="fb-input text-sm w-full font-sans" rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Message…" />
              <div className="flex justify-end gap-2">
                <Btn size="sm" variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Btn>
                <Btn size="sm" onClick={sendEmail} disabled={busy}>{busy ? 'Sending…' : 'Send email'}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Guest360Detail;
