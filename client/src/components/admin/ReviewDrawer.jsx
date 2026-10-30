import { useState, useEffect } from 'react';
import { Badge, Btn } from './ui';

// Side drawer for moderating one review. Shell mirrors SeoDrawer
// (backdrop + right panel + body-scroll-lock + sticky header).

const STATUS_TONE = { visible: 'ok', flagged: 'warn', hidden: 'danger' };
const DIR_LABEL = { guest_to_host: 'Guest → Host', host_to_guest: 'Host → Guest' };
const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const Stars = ({ n }) => (
  <span className="text-amber-500 text-base tracking-tight" title={`${n}/5`}>
    {'★'.repeat(n)}<span className="adm-t3">{'★'.repeat(Math.max(0, 5 - n))}</span>
  </span>
);
const Person = ({ p, label }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider adm-t3">{label}</p>
    <p className="font-medium adm-t2 truncate">{p?.name || '—'}</p>
    {p?.username && <p className="text-[11px] adm-t3 truncate">@{p.username}</p>}
  </div>
);

const ReviewDrawer = ({ review, busy, onClose, onModerate, onDelete }) => {
  const [note, setNote] = useState(review?.admin_note || '');
  const [confirmDel, setConfirmDel] = useState(false);

  // Re-sync note + reset delete confirm when the drawer switches reviews.
  useEffect(() => { setNote(review?.admin_note || ''); setConfirmDel(false); }, [review?.id]);

  // Lock page scroll while mounted so only the panel scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!review) return null;
  const r = review;
  const noteChanged = (note || '') !== (r.admin_note || '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b adm-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold adm-t1">Review · {r.reviewer?.name || '—'}</h2>
            <p className="text-[11px] adm-t3">{DIR_LABEL[r.direction] || r.direction}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 adm-t3 hover:bg-gray-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex items-center justify-between">
            <Stars n={r.rating} />
            <Badge tone={STATUS_TONE[r.status] || 'neutral'}><span className="capitalize">{r.status}</span></Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Person p={r.reviewer} label="Reviewer" />
            <Person p={r.subject} label="Subject" />
          </div>

          {r.service?.title && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider adm-t3">Service</p>
              <p className="adm-t2">{r.service.title}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider adm-t3">Comment</p>
            <p className="mt-1 adm-t2 whitespace-pre-wrap break-words">
              {r.comment || <span className="adm-t3">— no comment —</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div><p className="text-[10px] font-bold uppercase tracking-wider adm-t3">Created</p><p className="adm-t2">{fmt(r.created_at)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider adm-t3">Moderated</p><p className="adm-t2">{fmt(r.moderated_at)}</p></div>
          </div>

          {/* Admin note */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider adm-t3">Admin note</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Internal note (hosts never see this)…"
              className="mt-1 w-full rounded-lg border adm-border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#960D32]/30" />
            <Btn size="sm" variant="outline" disabled={busy || !noteChanged}
              onClick={() => onModerate(r, { admin_note: note })} className="mt-1.5">Save note</Btn>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t adm-border px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {r.status === 'flagged' ? (
              <Btn size="sm" variant="outline" disabled={busy} onClick={() => onModerate(r, { status: 'visible' })}>Unflag</Btn>
            ) : r.status !== 'hidden' && (
              <Btn size="sm" variant="outline" disabled={busy} onClick={() => onModerate(r, { status: 'flagged' })}>Flag</Btn>
            )}
            {r.status !== 'hidden' ? (
              <Btn size="sm" variant="outline" disabled={busy} onClick={() => onModerate(r, { status: 'hidden' })} className="!text-amber-600">Hide</Btn>
            ) : (
              <Btn size="sm" variant="outline" disabled={busy} onClick={() => onModerate(r, { status: 'visible' })}>Unhide</Btn>
            )}
            <div className="ml-auto">
              {confirmDel ? (
                <div className="flex gap-2">
                  <Btn size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDel(false)}>Cancel</Btn>
                  <Btn size="sm" variant="outline" disabled={busy} onClick={() => onDelete(r)} className="!text-red-600 !border-red-300">Confirm delete</Btn>
                </div>
              ) : (
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDel(true)} className="!text-red-600">Delete</Btn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewDrawer;
