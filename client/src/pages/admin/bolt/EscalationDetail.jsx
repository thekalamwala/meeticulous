// Bolt-escalation detail — transcript, replies, email/note reply, wa.me link,
// close/reopen. Extracted so BOTH the Escalations page AND the unified Support
// inbox render the same thing (no duplication). Fetches itself by id.
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminGetEscalation, adminReplyEscalation, adminUpdateEscalation } from '../../../services/api';
import { Badge } from '../../../components/admin/ui';
import { REASON_GROUPS } from '../../../utils/supportReasons';

const STATUS_TONE = { open: 'warn', replied: 'ok', closed: 'neutral' };
const RATING_EMOJI = { 1: '😠', 2: '😕', 3: '😐', 4: '🙂', 5: '🤩' };
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function EscalationDetail({ id, onBack, onChanged }) {
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState({ channel: 'email', body: '', busy: false });
  const [closeOpen, setCloseOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('');

  const load = useCallback(async () => {
    try { const { data } = await adminGetEscalation(id); setSel(data); }
    catch { toast.error('Could not open escalation'); }
  }, [id]);
  useEffect(() => { setReply({ channel: 'email', body: '', busy: false }); load(); }, [load]);

  const sendReply = async () => {
    const body = reply.body.trim();
    if (!body || reply.busy) return;
    setReply((r) => ({ ...r, busy: true }));
    try {
      await adminReplyEscalation(id, { channel: reply.channel, body });
      toast.success(reply.channel === 'email' ? 'Email sent' : reply.channel === 'whatsapp' ? 'WhatsApp reply logged' : 'Note saved');
      setReply({ channel: reply.channel, body: '', busy: false });
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Reply failed');
      setReply((r) => ({ ...r, busy: false }));
    }
  };

  const setEscalationStatus = async (status, reason) => {
    try {
      await adminUpdateEscalation(id, reason ? { status, reason_code: reason } : { status });
      toast.success(`Marked ${status}`);
      setSel((s) => ({ ...s, escalation: { ...s.escalation, status } }));
      setCloseOpen(false); setReasonCode('');
      onChanged?.();
    } catch { toast.error('Update failed'); }
  };

  if (!sel) return <div className="p-3 text-sm adm-t3">Loading…</div>;
  const e = sel.escalation;
  const wa = e.phone ? `https://wa.me/${String(e.phone).replace(/[^\d]/g, '')}` : null;

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm font-medium text-[#960D32]">← Back to inbox</button>
      <div className="space-y-4">
        <div className="rounded-xl border adm-border p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-[#FFF4EC] px-1.5 py-0.5 text-sm font-semibold text-[#2A1416]">{e.reference}</code>
            <Badge tone={STATUS_TONE[e.status] || 'neutral'}>{e.status}</Badge>
            <Badge tone="neutral">Tithi</Badge>
            {e.contact_verified && <Badge tone="ok">verified</Badge>}
            <span className="text-xs adm-t3">{fmtDateTime(e.created_at)}</span>
          </div>
          <p className="mb-2 text-sm font-semibold adm-t1">{e.summary || '—'}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs adm-t2">
            <div><span className="adm-t3">Who:</span> {e.logged_in ? `${e.name || '—'} · ${e.is_host ? 'Host' : 'Guest'}` : 'Anonymous'}</div>
            <div><span className="adm-t3">Channel:</span> {e.contact_channel || '—'}</div>
            <div><span className="adm-t3">Email:</span> {e.email || '—'}</div>
            <div><span className="adm-t3">Phone:</span> {e.phone || '—'}</div>
            <div><span className="adm-t3">Reason:</span> {e.reason || '—'}</div>
            <div><span className="adm-t3">Rating:</span> {e.rating ? `${RATING_EMOJI[e.rating]} ${e.rating}/5` : '—'}</div>
            <div className="truncate"><span className="adm-t3">Page:</span> {e.page_url || '—'}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg border adm-border px-2.5 py-1 text-xs font-medium text-[#25D366]">Reply on WhatsApp ↗</a>}
            {e.status !== 'closed' && <button onClick={() => setCloseOpen((v) => !v)} className="rounded-lg border adm-border px-2.5 py-1 text-xs adm-t2">Mark closed</button>}
            {e.status === 'closed' && <button onClick={() => setEscalationStatus('open')} className="rounded-lg border adm-border px-2.5 py-1 text-xs adm-t2">Reopen</button>}
          </div>
          {closeOpen && e.status !== 'closed' && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#faf9f7] px-3 py-2">
              <span className="text-xs font-medium adm-t2">Why did they need us?</span>
              <select value={reasonCode} onChange={(ev) => setReasonCode(ev.target.value)} className="rounded-lg border adm-border px-2 py-1 text-xs">
                <option value="">Reason (optional)…</option>
                {REASON_GROUPS.map((g) => (
                  <optgroup key={g.category} label={g.category}>
                    {g.items.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <button onClick={() => setEscalationStatus('closed', reasonCode)} className="rounded-lg bg-[#960D32] px-2.5 py-1 text-xs font-medium text-white">Close</button>
              <button onClick={() => { setCloseOpen(false); setReasonCode(''); }} className="text-xs adm-t3">Cancel</button>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide adm-t3">Transcript</p>
          <div className="space-y-1.5">
            {sel.transcript.length === 0 ? <p className="text-sm adm-t3">No transcript stored.</p> :
              sel.transcript.map((m, i) => (
                <div key={i} className={'rounded-lg p-2 text-xs ' + (m.role === 'user' ? 'bg-[#FFF4EC]' : 'border adm-border')}>
                  <span className="font-semibold adm-t2">{m.role === 'user' ? 'Visitor' : 'Tithi'}:</span> <span className="adm-t1">{m.content}</span>
                </div>
              ))}
          </div>
        </div>

        {sel.replies.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide adm-t3">Replies</p>
            <div className="space-y-1.5">
              {sel.replies.map((r) => (
                <div key={r.id} className="rounded-lg border adm-border p-2 text-xs">
                  <div className="mb-0.5 flex items-center gap-2 adm-t3">
                    <Badge tone={r.channel === 'note' ? 'neutral' : 'ok'}>{r.channel}{r.delivered ? ' · sent' : ''}</Badge>
                    <span>{r.sent_by || '—'}</span><span>·</span><span>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <p className="adm-t1 whitespace-pre-wrap">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border adm-border p-3">
          <div className="mb-2 flex gap-2">
            {['email', 'whatsapp', 'note'].map((ch) => {
              const disabled = (ch === 'email' && !e.email) || (ch === 'whatsapp' && !e.phone);
              const label = ch === 'email' ? 'Email reply' : ch === 'whatsapp' ? 'Log WhatsApp' : 'Internal note';
              return (
                <button key={ch} onClick={() => setReply((r) => ({ ...r, channel: ch }))} disabled={disabled}
                  className={'rounded-lg px-2.5 py-1 text-xs font-medium ' + (reply.channel === ch ? 'bg-[#960D32] text-white' : 'border adm-border adm-t2') + (disabled ? ' opacity-40' : '')}>
                  {label}
                </button>
              );
            })}
          </div>
          <textarea value={reply.body} onChange={(ev) => setReply((r) => ({ ...r, body: ev.target.value }))} rows={3}
            placeholder={reply.channel === 'email' ? `Reply to ${e.email || 'the visitor'}…` : reply.channel === 'whatsapp' ? 'Paste what you sent on WhatsApp (logs it to the thread)…' : 'Log an internal note (not sent to the visitor)…'}
            className="mb-2 w-full rounded-lg border adm-border px-3 py-2 text-sm" />
          <button onClick={sendReply} disabled={reply.busy || !reply.body.trim()}
            className="rounded-lg bg-[#960D32] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            {reply.busy ? 'Saving…' : reply.channel === 'email' ? 'Send email' : reply.channel === 'whatsapp' ? 'Log WhatsApp reply' : 'Save note'}
          </button>
          {reply.channel === 'email' && !e.email && <p className="mt-1 text-xs adm-t3">No verified email — use WhatsApp or a note.</p>}
          {reply.channel === 'whatsapp' && <p className="mt-1 text-xs adm-t3">Send the message via the "Reply on WhatsApp ↗" link above, then log it here for the record.</p>}
        </div>
      </div>
    </div>
  );
}
